// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Editor of a scenario (RF-STU-02, 03, 06, 07, 08, 09, 14): top bar with the scenario, the save
// state in words and "Guardar"; on the left the form, the visual editor of the diagram, the draft
// played and its answers (tabs "Formulario", "Diagrama", "Jugar" and "Respuestas"), on the right
// the YAML editor over the validation panel. The form and the diagram edit the text through the
// YAML editor, so all of them share one undo history. An issue of the
// panel goes to its field while the form is visible, and to its line of the YAML otherwise. The text is the source of
// truth and is saved as it is (ADR-0025 §2). A 409 means the file changed on disk: it is explained
// and nothing is overwritten (S8). "Descargar .zip" (RF-STU-14) packs the current text, notes.md and
// the generated files in the browser; right after creating a scenario (RF-STU-01) a notice says
// where it is and, without an author from git, asks for one. The unsaved text is copied to the
// browser's storage as it is written; opening the scenario with a copy that differs from the file
// offers to recover it.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@blueprint/ui/components/alert-dialog";
import { Button } from "@blueprint/ui/components/button";
import { ArrowLeftIcon, CircleCheckIcon, DownloadIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useBlocker, useLocation, useParams } from "react-router";
import { CreateResponseSchema, type CreateResponse } from "../../shared/api";
import {
  countFindings,
  isDraft,
  validateScenarioText,
  type StudioFinding,
} from "../../shared/validation";
import { api, ApiError } from "../api/client";
import { usePageTitle } from "../app/page-title";
import { isTokenError, reloadPage } from "../app/reload";
import { ValidationPanel } from "../validation/ValidationPanel";
import { useValidation } from "../validation/use-validation";
import { DraftTabs, type DraftTab } from "../preview/DraftTabs";
import { EditError, type EditCommand } from "../../shared/document-edit";
import { ScenarioForm, type ScenarioFormHandle } from "../form/ScenarioForm";
import { DiagramTab } from "../diagram/DiagramTab";
import {
  AUTOSAVE_DELAY_MS,
  clearLocalDraft,
  readLocalDraft,
  writeLocalDraft,
  type LocalDraft,
} from "./local-draft";
import { buildScenarioZip, downloadZip, type ScenarioZip } from "./scenario-zip";
import { useSharedContent } from "./use-shared-content";
import { YamlEditor, type YamlEditorHandle } from "./YamlEditor";

interface Opened {
  /** Text and hash of the file as it was read; `generation` recreates the editor on a reload. */
  yaml: string;
  hash: string;
  generation: number;
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  /** `skippedWithErrors`: a draft saved with errors, without regenerating the generated files. */
  | { kind: "saved"; regenerated: string[]; skippedWithErrors?: number }
  /** `token`: the session token is stale; only reloading the page gets a new one. */
  | { kind: "error"; message: string; line?: number; token: boolean }
  | { kind: "conflict" };

type Load =
  { kind: "loading" } | { kind: "failed"; message: string; token: boolean } | { kind: "ready" };

/** The result of creating this scenario, when the list just did it (router state, checked). */
const createdOf = (state: unknown, id: string): CreateResponse | undefined => {
  const created = CreateResponseSchema.safeParse(
    typeof state === "object" && state !== null && "created" in state ? state.created : undefined,
  );
  return created.success && created.data.id === id ? created.data : undefined;
};

export function EditorPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const location = useLocation();
  const [created, setCreated] = useState(() => createdOf(location.state, id));
  usePageTitle(id);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [opened, setOpened] = useState<Opened>({ yaml: "", hash: "", generation: 0 });
  const [text, setText] = useState("");
  /** Text that matches the file on disk, and its hash (the base of the next save, S8). */
  const [saved, setSaved] = useState({ text: "", hash: "" });
  /** notes.md of the folder, for the .zip. */
  const [notes, setNotes] = useState<string | null>(null);
  /** A .zip waiting for the author to confirm (unsaved changes, or no generated files). */
  const [pendingZip, setPendingZip] = useState<ScenarioZip>();
  const [downloaded, setDownloaded] = useState<string>();
  const downloadButton = useRef<HTMLButtonElement>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  /** A local copy of unsaved changes found when opening, until the author recovers or discards it. */
  const [recovery, setRecovery] = useState<LocalDraft & { stale: boolean }>();
  const editor = useRef<YamlEditorHandle>(null);
  const form = useRef<ScenarioFormHandle>(null);
  const [tab, setTab] = useState<DraftTab>("form");
  const { shared, error: sharedError } = useSharedContent();
  // Only once the file is there: never a result for the empty text before it loads.
  const validation = useValidation(text, id, load.kind === "ready" ? shared : undefined);
  const dirty = load.kind === "ready" && text !== saved.text;
  const ids = {
    yaml: useId(),
    help: useId(),
    validation: useId(),
    created: useId(),
    recovery: useId(),
  };

  /** Reads the file; the state starts as loading, and `reload` sets it before calling this. */
  const fetchFile = useCallback(() => {
    api.getScenario(id).then(
      (file) => {
        setOpened((previous) => ({
          yaml: file.yaml,
          hash: file.hash,
          generation: previous.generation + 1,
        }));
        setText(file.yaml);
        setSaved({ text: file.yaml, hash: file.hash });
        setNotes(file.notes);
        setSave({ kind: "idle" });
        const local = readLocalDraft(id);
        if (local !== undefined && local.text !== file.yaml) {
          setRecovery({ ...local, stale: local.baseHash !== file.hash });
        } else {
          setRecovery(undefined);
          clearLocalDraft(id);
        }
        setLoad({ kind: "ready" });
      },
      (error: unknown) =>
        setLoad({
          kind: "failed",
          message: error instanceof ApiError ? error.message : String(error),
          token: isTokenError(error),
        }),
    );
  }, [id]);
  useEffect(fetchFile, [fetchFile]);
  /** Reloads from disk: the unsaved changes are discarded, and so is their local copy. */
  const reload = () => {
    clearLocalDraft(id);
    setLoad({ kind: "loading" });
    fetchFile();
  };

  // The local copy follows the text: written a moment after the last change, removed when the
  // text is the file again. While a copy waits to be recovered, it is left alone.
  useEffect(() => {
    if (load.kind !== "ready" || recovery !== undefined) return;
    if (!dirty) {
      clearLocalDraft(id);
      return;
    }
    const timer = setTimeout(
      () => writeLocalDraft(id, { text, baseHash: saved.hash }),
      AUTOSAVE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [dirty, id, load.kind, recovery, saved.hash, text]);

  const recover = () => {
    if (recovery === undefined) return;
    // The editor starts over with the recovered text; the file is still the base of the save.
    setOpened((previous) => ({
      yaml: recovery.text,
      hash: previous.hash,
      generation: previous.generation + 1,
    }));
    setText(recovery.text);
    setRecovery(undefined);
  };
  /** A stale token: the text goes to the local copy right away, and the page reloads. */
  const reloadWithCopy = () => {
    if (dirty) writeLocalDraft(id, { text, baseHash: saved.hash });
    reloadPage();
  };
  const discard = () => {
    clearLocalDraft(id);
    setRecovery(undefined);
  };

  const onSave = useCallback(() => {
    if (load.kind !== "ready" || save.kind === "saving") return;
    const sent = text;
    setSave({ kind: "saving" });
    api.saveScenario(id, { yaml: sent, baseHash: saved.hash }).then(
      (result) => {
        clearLocalDraft(id);
        setSaved({ text: sent, hash: result.hash });
        setSave({
          kind: "saved",
          regenerated: result.regenerated,
          ...(result.generatedSkipped && shared !== undefined
            ? {
                skippedWithErrors: countFindings(validateScenarioText(sent, id, shared).findings)
                  .errors,
              }
            : {}),
        });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.code === "conflict") {
          setSave({ kind: "conflict" });
        } else {
          setSave({
            kind: "error",
            message: error instanceof Error ? error.message : String(error),
            token: isTokenError(error),
            ...(error instanceof ApiError && error.line !== undefined ? { line: error.line } : {}),
          });
        }
      },
    );
  }, [id, load.kind, save.kind, saved.hash, shared, text]);

  // Unsaved changes: the browser asks before closing or reloading the tab, and the app before
  // leaving the page.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  const download = (zip: ScenarioZip) => {
    downloadZip(zip);
    setDownloaded(t("editor.download.done", { file: zip.fileName }));
  };
  const onDownload = () => {
    if (shared === undefined) return;
    const zip = buildScenarioZip({ id, yaml: text, notes, catalog: shared.catalog });
    setDownloaded(undefined);
    // The author confirms when the .zip is not what is on disk, or misses the generated files.
    if (dirty || zip.missingGenerated) setPendingZip(zip);
    else download(zip);
  };

  const addAuthor = () => {
    setTab("form");
    // Once the form tab is visible.
    requestAnimationFrame(() => form.current?.focusPath(["authors"]));
  };

  const jump = (finding: StudioFinding) => {
    if (tab === "form" && finding.path.length > 0 && form.current?.focusPath(finding.path)) return;
    editor.current?.focusLine(finding.line, finding.column);
  };
  const title = validation.result?.scenario?.title ?? id;
  // ADR-0025, S10 as amended: a draft with errors is saved anyway, without the generated files.
  const draftWithErrors =
    isDraft(validation.result) && countFindings(validation.result?.findings ?? []).errors > 0;
  const editText = (commands: readonly EditCommand[], isolate: boolean) => {
    if (editor.current === null) throw new EditError("El editor no está listo");
    editor.current.edit(commands, isolate);
  };

  const stateText = (() => {
    switch (save.kind) {
      case "saving":
        return t("editor.state.saving");
      case "conflict":
        return t("editor.state.conflict");
      case "error":
        return t("editor.state.error");
      default:
        if (dirty) return t("editor.state.dirty");
        if (save.kind === "saved" && save.skippedWithErrors !== undefined) {
          return t("editor.savedSkipped", { count: save.skippedWithErrors });
        }
        return save.kind === "saved" && save.regenerated.length > 0
          ? t("editor.savedRegenerated", { files: save.regenerated.join(", ") })
          : t("editor.state.saved");
    }
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2 md:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary underline underline-offset-4"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          {t("editor.back")}
        </Link>
        <h1 className="min-w-0 flex-1 text-lg font-semibold">
          <span className="block truncate">{title}</span>
          <span className="block font-mono text-sm font-normal text-muted-foreground">{id}</span>
        </h1>
        {load.kind === "ready" && (
          <>
            <p role="status" className="text-sm" data-save-state={dirty ? "dirty" : save.kind}>
              {stateText}
            </p>
            <p role="status" className="sr-only">
              {downloaded}
            </p>
            <Button
              ref={downloadButton}
              variant="outline"
              onClick={onDownload}
              disabled={shared === undefined}
            >
              <DownloadIcon aria-hidden />
              {t("editor.download.button")}
            </Button>
            <Button
              onClick={save.kind === "error" && save.token ? reloadWithCopy : onSave}
              disabled={save.kind === "saving"}
            >
              {save.kind === "error" && save.token
                ? t("app.reloadPage")
                : save.kind === "saving"
                  ? t("editor.saving")
                  : draftWithErrors
                    ? t("editor.saveDraft")
                    : t("editor.save")}
            </Button>
          </>
        )}
      </div>

      {load.kind === "loading" && (
        <p role="status" className="p-6">
          {t("editor.loading")}
        </p>
      )}
      {load.kind === "failed" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 p-6">
          <p>{t("editor.loadFailed", { message: load.message })}</p>
          {load.token && (
            <Button variant="outline" onClick={reloadPage}>
              {t("app.reloadPage")}
            </Button>
          )}
        </div>
      )}

      {load.kind === "ready" && created !== undefined && (
        <section
          aria-labelledby={ids.created}
          className="mx-4 mt-4 flex flex-col gap-2 rounded-md border border-l-4 border-l-success bg-card p-4 md:mx-6"
          data-created-notice
        >
          <h2 id={ids.created} className="flex items-center gap-2 font-semibold">
            <CircleCheckIcon aria-hidden className="size-5 shrink-0 text-success" />
            {t("editor.created.title")}
          </h2>
          <p>{t("editor.created.body", { id })}</p>
          {created.author === null && (
            <p className="flex items-center gap-2">
              <TriangleAlertIcon aria-hidden className="size-4 shrink-0 text-warning" />
              {t("editor.created.noAuthor")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {created.author === null && (
              <Button variant="outline" size="sm" onClick={addAuthor}>
                {t("editor.created.addAuthor")}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setCreated(undefined)}>
              {t("editor.created.dismiss")}
            </Button>
          </div>
        </section>
      )}

      {load.kind === "ready" && recovery !== undefined && (
        <section
          aria-labelledby={ids.recovery}
          className="mx-4 mt-4 flex flex-col gap-2 rounded-md border border-l-4 border-l-warning bg-warning-soft p-4 md:mx-6"
          data-recovery-notice
        >
          <h2 id={ids.recovery} className="flex items-center gap-2 font-semibold">
            <TriangleAlertIcon aria-hidden className="size-5 shrink-0 text-warning" />
            {t("editor.recovery.title")}
          </h2>
          <p>{t("editor.recovery.body")}</p>
          {recovery.stale && <p>{t("editor.recovery.stale")}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={recover}>
              {t("editor.recovery.recover")}
            </Button>
            <Button variant="ghost" onClick={discard}>
              {t("editor.recovery.discard")}
            </Button>
          </div>
        </section>
      )}

      {save.kind === "conflict" && (
        <div
          role="alert"
          className="mx-4 mt-4 flex flex-col gap-3 rounded-md border border-l-4 border-l-warning bg-warning-soft p-4 md:mx-6"
        >
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlertIcon aria-hidden className="size-5 shrink-0 text-warning" />
            {t("editor.conflict.title")}
          </p>
          <p>{t("editor.conflict.body")}</p>
          <p className="text-sm">{t("editor.conflict.reloadHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={reload}>
              {t("editor.conflict.reload")}
            </Button>
            <Button variant="ghost" onClick={() => setSave({ kind: "idle" })}>
              {t("editor.conflict.dismiss")}
            </Button>
          </div>
        </div>
      )}
      {save.kind === "error" && (
        <div
          role="alert"
          className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-md border border-l-4 border-l-destructive bg-danger-soft p-4 md:mx-6"
        >
          <p>{t("editor.saveFailed", { message: save.message })}</p>
          {save.line !== undefined && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => editor.current?.focusLine(save.line ?? 1)}
            >
              {t("validation.line", { line: save.line })}
            </Button>
          )}
        </div>
      )}

      {load.kind === "ready" && (
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(24rem,2fr)] lg:grid-rows-1 lg:overflow-hidden">
          <DraftTabs
            // A new scenario starts with no draft.
            key={id}
            result={validation.result}
            shared={shared}
            sharedError={sharedError}
            onJump={jump}
            tab={tab}
            onTabChange={setTab}
            form={
              shared !== undefined && (
                <ScenarioForm
                  ref={form}
                  // The open sections start over for another file.
                  key={`${id}:${opened.generation}`}
                  text={text}
                  findings={validation.result?.findings ?? []}
                  shared={shared}
                  onEdit={editText}
                  onUndo={() => editor.current?.undo()}
                  onRedo={() => editor.current?.redo()}
                  onSave={onSave}
                  onJumpToLine={(line) => editor.current?.focusLine(line)}
                />
              )
            }
            diagram={
              shared !== undefined && (
                <DiagramTab
                  key={`${id}:${opened.generation}`}
                  text={text}
                  findings={validation.result?.findings ?? []}
                  shared={shared}
                  onEdit={editText}
                  onUndo={() => editor.current?.undo()}
                  onRedo={() => editor.current?.redo()}
                  onSave={onSave}
                  onJumpToLine={(line) => editor.current?.focusLine(line)}
                  onOpenInForm={(path) => {
                    setTab("form");
                    form.current?.focusPath(path);
                  }}
                />
              )
            }
          />
          {/* The YAML takes the height the validation panel leaves; the panel takes what its
              findings need, up to 40 % of the column, and then its list scrolls. */}
          <div className="flex min-h-[40rem] min-w-0 flex-col gap-4 lg:min-h-0">
            <section aria-labelledby={ids.yaml} className="flex min-h-48 flex-1 flex-col gap-2">
              <h2 id={ids.yaml} className="font-mono text-lg font-semibold">
                {t("editor.yamlTitle")}
              </h2>
              <p id={ids.help} className="text-sm text-muted-foreground">
                {t("editor.keyboardHelp")}
              </p>
              <div className="min-h-0 flex-1">
                <YamlEditor
                  ref={editor}
                  documentKey={`${id}:${opened.generation}`}
                  initialText={opened.yaml}
                  label={t("editor.yamlLabel", { id })}
                  describedBy={ids.help}
                  findings={validation.result?.findings ?? []}
                  onChange={setText}
                  onSave={onSave}
                />
              </div>
            </section>
            <ValidationPanel
              className="max-h-[40%] shrink-0"
              headingId={ids.validation}
              findings={validation.result?.findings}
              pending={validation.pending}
              {...(sharedError === undefined
                ? {}
                : { problem: t("validation.sharedFailed", { message: sharedError }) })}
              onJump={jump}
            />
          </div>
        </div>
      )}

      <AlertDialog
        open={pendingZip !== undefined}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingZip(undefined);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            // Back to "Descargar .zip": the dialog was not opened by a trigger.
            event.preventDefault();
            downloadButton.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editor.download.title")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                {dirty && <p>{t("editor.download.dirty")}</p>}
                {pendingZip?.missingGenerated === true && (
                  <p>{t("editor.download.missingGenerated")}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("editor.download.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingZip !== undefined) download(pendingZip);
              }}
            >
              {t("editor.download.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={blocker.state === "blocked"}
        onOpenChange={(isOpen) => {
          if (!isOpen) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editor.leave.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("editor.leave.body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              {t("editor.leave.stay")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Leaving without saving on purpose: the local copy goes too.
                clearLocalDraft(id);
                blocker.proceed?.();
              }}
            >
              {t("editor.leave.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
