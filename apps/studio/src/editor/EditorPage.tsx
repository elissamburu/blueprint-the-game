// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Editor of a scenario (RF-STU-02, 03, 06, 07, 08, 09, 14): top bar with the scenario, the save
// state in words and "Guardar"; on the left the form, the visual editor of the diagram, the draft
// played and its answers (tabs "Formulario", "Diagrama", "Jugar" and "Respuestas"), on the right
// the YAML editor over the validation panel. The form and the diagram edit the text through the
// YAML editor, so all of them share one undo history. An issue of the
// panel goes to its field while the form is visible, and to its line of the YAML otherwise. The text is the source of
// truth and is saved as it is (ADR-0025 §2). A 409 means the file changed on disk: it is explained
// and nothing is overwritten (S8).
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
import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useBlocker, useParams } from "react-router";
import type { StudioFinding } from "../../shared/validation";
import { api, ApiError } from "../api/client";
import { usePageTitle } from "../app/page-title";
import { ValidationPanel } from "../validation/ValidationPanel";
import { useValidation } from "../validation/use-validation";
import { DraftTabs, type DraftTab } from "../preview/DraftTabs";
import { EditError, type EditCommand } from "../form/document-edit";
import { ScenarioForm, type ScenarioFormHandle } from "../form/ScenarioForm";
import { DiagramTab } from "../diagram/DiagramTab";
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
  | { kind: "saved"; regenerated: string[] }
  | { kind: "error"; message: string; line?: number }
  | { kind: "conflict" };

type Load = { kind: "loading" } | { kind: "failed"; message: string } | { kind: "ready" };

export function EditorPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  usePageTitle(id);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [opened, setOpened] = useState<Opened>({ yaml: "", hash: "", generation: 0 });
  const [text, setText] = useState("");
  /** Text that matches the file on disk, and its hash (the base of the next save, S8). */
  const [saved, setSaved] = useState({ text: "", hash: "" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const editor = useRef<YamlEditorHandle>(null);
  const form = useRef<ScenarioFormHandle>(null);
  const [tab, setTab] = useState<DraftTab>("form");
  const { shared, error: sharedError } = useSharedContent();
  // Only once the file is there: never a result for the empty text before it loads.
  const validation = useValidation(text, id, load.kind === "ready" ? shared : undefined);
  const dirty = load.kind === "ready" && text !== saved.text;
  const ids = { yaml: useId(), help: useId(), validation: useId() };

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
        setSave({ kind: "idle" });
        setLoad({ kind: "ready" });
      },
      (error: unknown) =>
        setLoad({
          kind: "failed",
          message: error instanceof ApiError ? error.message : String(error),
        }),
    );
  }, [id]);
  useEffect(fetchFile, [fetchFile]);
  const reload = () => {
    setLoad({ kind: "loading" });
    fetchFile();
  };

  const onSave = useCallback(() => {
    if (load.kind !== "ready" || save.kind === "saving") return;
    const sent = text;
    setSave({ kind: "saving" });
    api.saveScenario(id, { yaml: sent, baseHash: saved.hash }).then(
      (result) => {
        setSaved({ text: sent, hash: result.hash });
        setSave({ kind: "saved", regenerated: result.regenerated });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.code === "conflict") {
          setSave({ kind: "conflict" });
        } else {
          setSave({
            kind: "error",
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof ApiError && error.line !== undefined ? { line: error.line } : {}),
          });
        }
      },
    );
  }, [id, load.kind, save.kind, saved.hash, text]);

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

  const jump = (finding: StudioFinding) => {
    if (tab === "form" && finding.path.length > 0 && form.current?.focusPath(finding.path)) return;
    editor.current?.focusLine(finding.line, finding.column);
  };
  const title = validation.result?.scenario?.title ?? id;
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
            <Button onClick={onSave} disabled={save.kind === "saving"}>
              {save.kind === "saving" ? t("editor.saving") : t("editor.save")}
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
        <p role="alert" className="p-6">
          {t("editor.loadFailed", { message: load.message })}
        </p>
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
          <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(20rem,3fr)_minmax(12rem,2fr)] gap-4">
            <section aria-labelledby={ids.yaml} className="flex min-h-0 flex-col gap-2">
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
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              {t("editor.leave.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
