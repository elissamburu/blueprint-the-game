// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Nuevo escenario" (RF-STU-01, F2 part): the id, with live validation against the schema pattern
// and the scenarios that already exist, the title and the source (empty, a template of
// content/scenarios/_templates/ or a copy of an existing scenario). Creating opens the editor.
// The focus starts on the id, each error is tied to its field with aria-describedby, and closing
// returns the focus to the button that opened the dialog.
import { Button } from "@blueprint/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@blueprint/ui/components/dialog";
import { Input } from "@blueprint/ui/components/input";
import { Label } from "@blueprint/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@blueprint/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@blueprint/ui/components/select";
import { KEBAB_CASE, MAX_LENGTH } from "@blueprint/scenario-schema";
import { PlusIcon } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  TEMPLATE_NAMES,
  type CreateRequest,
  type CreateResponse,
  type ScenarioSummary,
  type TemplateName,
} from "../../shared/api";
import { api, ApiError } from "../api/client";

/** What the editor shows after creating: whether the author was found, and what was generated. */
export interface CreatedState {
  created: CreateResponse;
}

type Source = "empty" | `template:${TemplateName}` | "duplicate";

type IdProblem = "required" | "length" | "pattern" | "exists";

/** The problem of an id, in the same order the schema checks it, or `undefined`. */
export const idProblem = (id: string, existing: readonly string[]): IdProblem | undefined => {
  if (id === "") return "required";
  if (!KEBAB_CASE.test(id)) return "pattern";
  if (id.length < 3 || id.length > 64) return "length";
  if (existing.includes(id)) return "exists";
  return undefined;
};

export function NewScenarioDialog({ scenarios }: { scenarios: readonly ScenarioSummary[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<Source>("empty");
  const [from, setFrom] = useState("");
  /** Once the author tried to create, the empty fields show their error too. */
  const [submitted, setSubmitted] = useState(false);
  const [serverIdError, setServerIdError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [creating, setCreating] = useState(false);
  const idInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const fromTrigger = useRef<HTMLButtonElement>(null);
  const ids = {
    id: useId(),
    idHint: useId(),
    idError: useId(),
    title: useId(),
    titleError: useId(),
    source: useId(),
    from: useId(),
    fromError: useId(),
  };

  const existing = scenarios.map((scenario) => scenario.id);
  const problem = idProblem(id, existing);
  // Live: a wrong id shows its error while it is typed; an empty one only after trying to create.
  const idError =
    serverIdError ??
    (problem === undefined || (problem === "required" && !submitted)
      ? undefined
      : t(`create.id.errors.${problem}`));
  const titleError = submitted && title.trim() === "" ? t("create.titleField.required") : undefined;
  const fromError =
    submitted && source === "duplicate" && from === "" ? t("create.from.required") : undefined;

  const reset = () => {
    setId("");
    setTitle("");
    setSource("empty");
    setFrom("");
    setSubmitted(false);
    setServerIdError(undefined);
    setFailure(undefined);
    setCreating(false);
  };

  const request = (): CreateRequest => {
    const base = { id, title: title.trim() };
    if (source === "empty") return { ...base, source };
    if (source === "duplicate") return { ...base, source, from };
    return { ...base, source: "template", from: source.slice("template:".length) as TemplateName };
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setSubmitted(true);
    setFailure(undefined);
    const invalid = [
      [problem !== undefined || serverIdError !== undefined, idInput],
      [title.trim() === "", titleInput],
      [source === "duplicate" && from === "", fromTrigger],
    ] as const;
    const first = invalid.find(([isInvalid]) => isInvalid);
    if (first !== undefined) {
      first[1].current?.focus();
      return;
    }
    setCreating(true);
    api.createScenario(request()).then(
      (created) => {
        const state: CreatedState = { created };
        void navigate(`/escenarios/${created.id}`, { state });
      },
      (error: unknown) => {
        setCreating(false);
        if (
          error instanceof ApiError &&
          (error.code === "conflict" || error.code === "invalid-id")
        ) {
          setServerIdError(error.message);
          idInput.current?.focus();
          return;
        }
        setFailure(error instanceof Error ? error.message : String(error));
      },
    );
  };

  const describedBy = (...parts: (string | false | undefined)[]) =>
    parts.filter((part): part is string => typeof part === "string").join(" ") || undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon aria-hidden />
          {t("create.open")}
        </Button>
      </DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          idInput.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor={ids.id}>{t("create.id.label")}</Label>
            <Input
              ref={idInput}
              id={ids.id}
              value={id}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              maxLength={64}
              aria-required
              aria-invalid={idError === undefined ? undefined : true}
              aria-describedby={describedBy(ids.idHint, idError !== undefined && ids.idError)}
              onChange={(event) => {
                setId(event.target.value);
                setServerIdError(undefined);
              }}
            />
            <p id={ids.idHint} className="text-sm text-muted-foreground">
              {t("create.id.hint")}
            </p>
            {idError !== undefined && (
              <p id={ids.idError} className="text-sm text-destructive">
                {idError}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={ids.title}>{t("create.titleField.label")}</Label>
            <Input
              ref={titleInput}
              id={ids.title}
              value={title}
              maxLength={MAX_LENGTH.title}
              aria-required
              aria-invalid={titleError === undefined ? undefined : true}
              aria-describedby={describedBy(titleError !== undefined && ids.titleError)}
              onChange={(event) => setTitle(event.target.value)}
            />
            {titleError !== undefined && (
              <p id={ids.titleError} className="text-sm text-destructive">
                {titleError}
              </p>
            )}
          </div>

          <div className="grid gap-3">
            <p id={ids.source} className="text-sm font-medium">
              {t("create.source.label")}
            </p>
            <RadioGroup
              aria-labelledby={ids.source}
              value={source}
              onValueChange={(value) => setSource(value as Source)}
            >
              <SourceOption value="empty" label={t("create.source.empty")} />
              {TEMPLATE_NAMES.map((name) => (
                <SourceOption
                  key={name}
                  value={`template:${name}`}
                  label={t(`create.source.templates.${name}`)}
                />
              ))}
              <SourceOption value="duplicate" label={t("create.source.duplicate")} />
            </RadioGroup>
            {source === "duplicate" && (
              <div className="grid gap-2 pl-6">
                <Label htmlFor={ids.from}>{t("create.from.label")}</Label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger
                    ref={fromTrigger}
                    id={ids.from}
                    aria-required
                    aria-invalid={fromError === undefined ? undefined : true}
                    aria-describedby={describedBy(fromError !== undefined && ids.fromError)}
                  >
                    <SelectValue placeholder={t("create.from.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios.map((scenario) => (
                      <SelectItem key={scenario.id} value={scenario.id}>
                        {scenario.title === null
                          ? scenario.id
                          : t("create.from.option", { title: scenario.title, id: scenario.id })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fromError !== undefined && (
                  <p id={ids.fromError} className="text-sm text-destructive">
                    {fromError}
                  </p>
                )}
              </div>
            )}
          </div>

          {failure !== undefined && (
            <p
              role="alert"
              className="rounded-md border border-l-4 border-l-destructive p-3 text-sm"
            >
              {t("create.failed", { message: failure })}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("create.cancel")}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? t("create.creating") : t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SourceOption({ value, label }: { value: Source; label: string }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem id={id} value={value} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
