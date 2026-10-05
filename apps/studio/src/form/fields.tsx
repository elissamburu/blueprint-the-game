// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Fields of the form (RF-STU-03). Every field has a visible label; the fields that repeat (the
// rationale of each answer, …) add the rest of their name for screen readers in a sr-only span
// ("Rationale de la respuesta 2 del casillero 3"), so every accessible name is unique and starts
// with the visible text (WCAG 2.5.3). The issues of the validation that belong to a field are
// shown under it, tied with aria-describedby, and an error marks it with aria-invalid.
import { Button } from "@blueprint/ui/components/button";
import { Checkbox } from "@blueprint/ui/components/checkbox";
import { Input } from "@blueprint/ui/components/input";
import { Label } from "@blueprint/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@blueprint/ui/components/select";
import { Textarea } from "@blueprint/ui/components/textarea";
import { cn } from "@blueprint/ui/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { EditCommand, EditPath } from "../../shared/document-edit";
import { listOf, textOf, valueAt } from "./form-data";
import { useForm } from "./form-context";

export interface LabelText {
  /** Visible text of the label. */
  label: string;
  /** The rest of the accessible name, only for screen readers ("de la respuesta 2…"). */
  context?: string;
}

export function FieldLabel({
  label,
  context,
  htmlFor,
  id,
}: LabelText & { htmlFor?: string; id?: string }) {
  return (
    <Label htmlFor={htmlFor} id={id}>
      {label}
      {context !== undefined && (
        <>
          {" "}
          <span className="sr-only">{context}</span>
        </>
      )}
    </Label>
  );
}

/** The issues of the path: the message under the field and the ARIA attributes of its control. */
export const useIssues = (path: EditPath, hintId?: string) => {
  const { t } = useTranslation();
  const { findingsAt, errorId } = useForm();
  const findings = findingsAt(path);
  const ids = [hintId, findings.length > 0 ? errorId(path) : undefined].filter(
    (id): id is string => id !== undefined,
  );
  return {
    invalid: findings.some((finding) => finding.severity === "error"),
    describedBy: ids.length > 0 ? ids.join(" ") : undefined,
    messages:
      findings.length === 0 ? null : (
        <ul id={errorId(path)} className="flex flex-col gap-1 text-sm">
          {findings.map((finding, index) => (
            <li
              key={`${finding.code}-${index}`}
              className={finding.severity === "error" ? "text-destructive" : "text-warning"}
            >
              <span className="font-medium">
                {t(`validation.severity.${finding.severity}`)} {finding.code}:
              </span>{" "}
              {finding.message}
            </li>
          ))}
        </ul>
      ),
  };
};

const ariaOf = (issues: { invalid: boolean; describedBy: string | undefined }) => ({
  ...(issues.invalid ? { "aria-invalid": true } : {}),
  ...(issues.describedBy === undefined ? {} : { "aria-describedby": issues.describedBy }),
});

interface FieldProps extends LabelText {
  path: EditPath;
  hint?: string;
  className?: string;
}

function Hint({ id, text }: { id: string; text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {text}
    </p>
  );
}

export function TextField({
  path,
  label,
  context,
  hint,
  className,
  multiline = false,
  locked = false,
  optional = false,
  type = "text",
}: FieldProps & {
  multiline?: boolean;
  locked?: boolean;
  /** Emptying the field removes the key, instead of writing "". */
  optional?: boolean;
  type?: "text" | "url";
}) {
  const { raw, readOnly, edit, fieldId } = useForm();
  const hintId = useId();
  const issues = useIssues(path, hint === undefined ? undefined : hintId);
  const id = fieldId(path);
  const value = textOf(valueAt(raw, path));
  const onChange = (next: string) =>
    edit([{ op: "set", path, value: optional && next === "" ? undefined : next }]);
  const common = {
    id,
    value,
    readOnly: readOnly || locked,
    ...ariaOf(issues),
  };
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <FieldLabel htmlFor={id} label={label} {...(context === undefined ? {} : { context })} />
      {multiline ? (
        <Textarea
          {...common}
          rows={Math.min(Math.max(value.split("\n").length, 2), 14)}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          {...common}
          type={type}
          className={locked ? "bg-muted" : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <Hint id={hintId} text={hint} />
      {issues.messages}
    </div>
  );
}

/** A whole number. What is typed stays in the field while it is not a number yet ("" or "-"). */
export function NumberField({ path, label, context, hint, className }: FieldProps) {
  const { raw, readOnly, edit, fieldId } = useForm();
  const hintId = useId();
  const issues = useIssues(path, hint === undefined ? undefined : hintId);
  const id = fieldId(path);
  const value = textOf(valueAt(raw, path));
  // Only what is not a number yet; a number goes to the document right away.
  const [draft, setDraft] = useState<string | undefined>();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <FieldLabel htmlFor={id} label={label} {...(context === undefined ? {} : { context })} />
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={draft ?? value}
        readOnly={readOnly}
        onChange={(event) => {
          const next = event.target.value.trim();
          if (/^-?\d+$/.test(next)) {
            setDraft(undefined);
            edit([{ op: "set", path, value: Number(next) }]);
          } else {
            setDraft(event.target.value);
          }
        }}
        onBlur={() => setDraft(undefined)}
        {...ariaOf(issues)}
      />
      <Hint id={hintId} text={hint} />
      {issues.messages}
    </div>
  );
}

/** The option "none" of a select: Radix takes no empty value, and ids never have "_". */
const NONE = "__none__";

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  path,
  label,
  context,
  hint,
  className,
  options,
  numeric = false,
  none,
}: FieldProps & {
  options: readonly Option[];
  numeric?: boolean;
  /** An option for no value: `null` writes `null`, `undefined` removes the key. */
  none?: { label: string; value: null | undefined };
}) {
  const { t } = useTranslation();
  const { raw, readOnly, edit, fieldId } = useForm();
  const hintId = useId();
  const issues = useIssues(path, hint === undefined ? undefined : hintId);
  const id = fieldId(path);
  const current = textOf(valueAt(raw, path));
  const value = none !== undefined && current === "" ? NONE : current;
  // A value of the YAML that is not an option is shown as it is, to be replaced.
  const listed = none === undefined ? options : [{ value: NONE, label: none.label }, ...options];
  const all =
    value === "" || listed.some((option) => option.value === value)
      ? listed
      : [...listed, { value, label: t("form.invalidValue", { value }) }];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <FieldLabel htmlFor={id} label={label} {...(context === undefined ? {} : { context })} />
      <Select
        value={value}
        disabled={readOnly}
        onValueChange={(next) =>
          edit(
            [
              {
                op: "set",
                path,
                value: next === NONE ? none?.value : numeric ? Number(next) : next,
              },
            ],
            { isolate: true },
          )
        }
      >
        <SelectTrigger id={id} className="w-full" {...ariaOf(issues)}>
          <SelectValue placeholder={t("form.choose")} />
        </SelectTrigger>
        <SelectContent>
          {all.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Hint id={hintId} text={hint} />
      {issues.messages}
    </div>
  );
}

export interface CheckOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * A list of ids as checkboxes (areas, objectives of an answer). Checking appends the id to the
 * list and unchecking removes it: the finest edit of the list. Ids of the list that are not
 * options stay checked, to be unchecked.
 */
export function CheckboxGroup({
  path,
  label,
  context,
  hint,
  className,
  options,
}: FieldProps & { options: readonly CheckOption[] }) {
  const { t } = useTranslation();
  const { raw, readOnly, edit, fieldId } = useForm();
  const legendId = useId();
  const hintId = useId();
  const issues = useIssues(path, hint === undefined ? undefined : hintId);
  const id = fieldId(path);
  const selected = listOf(valueAt(raw, path)).map(textOf);
  const unknown = selected
    .filter((value) => !options.some((option) => option.value === value))
    .map((value) => ({ value, label: value, description: t("form.unknownOption") }));

  const toggle = (value: string, checked: boolean) => {
    const index = selected.indexOf(value);
    if (checked && index === -1) edit([{ op: "append", path, value }], { isolate: true });
    if (!checked && index !== -1)
      edit([{ op: "remove", path: [...path, index] }], { isolate: true });
  };

  return (
    <div
      id={id}
      role="group"
      tabIndex={-1}
      aria-labelledby={legendId}
      {...(issues.describedBy === undefined ? {} : { "aria-describedby": issues.describedBy })}
      className={cn("flex flex-col gap-2 rounded-md outline-offset-2", className)}
    >
      <span id={legendId} className="text-sm font-medium">
        {label}
        {context !== undefined && (
          <>
            {" "}
            <span className="sr-only">{context}</span>
          </>
        )}
      </span>
      <Hint id={hintId} text={hint} />
      {options.length + unknown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("form.noOptions")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...options, ...unknown].map((option) => {
            const optionId = `${id}-${option.value}`;
            return (
              <li key={option.value} className="flex items-start gap-2">
                <Checkbox
                  id={optionId}
                  className="mt-0.5"
                  checked={selected.includes(option.value)}
                  disabled={readOnly}
                  onCheckedChange={(checked) => toggle(option.value, checked === true)}
                />
                <Label htmlFor={optionId} className="flex flex-col gap-1 leading-snug font-normal">
                  <span className="font-mono">{option.label}</span>
                  {option.description !== undefined && (
                    <span className="text-muted-foreground">{option.description}</span>
                  )}
                </Label>
              </li>
            );
          })}
        </ul>
      )}
      {issues.messages}
    </div>
  );
}

/**
 * "Subir", "Bajar" and "Quitar" of an item of a list. Moving keeps the focus on the same button of
 * the moved item; removing asks first and leaves the focus on "Agregar" of the list. Both are
 * announced by the status region of the form.
 */
export function ItemActions({
  listPath,
  index,
  count,
  name,
  canMove = true,
  remove,
  children,
}: {
  listPath: EditPath;
  index: number;
  count: number;
  /** The item, in words: "el objetivo 2". */
  name: string;
  canMove?: boolean;
  /** A removal of more than the item (a node with its edges), and how to tell it. */
  remove?: {
    commands: readonly EditCommand[];
    description: string;
    announce: string;
    /** Id of the element that gets the focus, when the list has more than one "Agregar". */
    focus?: string;
  };
  /** More actions of the item, before "Quitar". */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { readOnly, edit, confirm, fieldId } = useForm();
  const itemPath = [...listPath, index];
  const base = fieldId(itemPath);
  const move = (to: number, button: "up" | "down") => {
    const at = to + 1;
    const focusButton =
      (button === "up" && to === 0) || (button === "down" && to === count - 1)
        ? button === "up"
          ? "down"
          : "up"
        : button;
    edit([{ op: "move", path: itemPath, to }], {
      isolate: true,
      announce: t("form.moved", { item: name, position: at, count }),
      focus: `${fieldId([...listPath, to])}-${focusButton}`,
    });
  };
  return (
    <div className="flex flex-wrap gap-2">
      {canMove && (
        <>
          <Button
            id={`${base}-up`}
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || index === 0}
            onClick={() => move(index - 1, "up")}
          >
            <ArrowUpIcon aria-hidden />
            {t("form.up")} <span className="sr-only">{name}</span>
          </Button>
          <Button
            id={`${base}-down`}
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || index === count - 1}
            onClick={() => move(index + 1, "down")}
          >
            <ArrowDownIcon aria-hidden />
            {t("form.down")} <span className="sr-only">{name}</span>
          </Button>
        </>
      )}
      {children}
      <Button
        id={`${base}-remove`}
        type="button"
        variant="outline"
        size="sm"
        disabled={readOnly}
        onClick={() =>
          confirm({
            title: t("form.remove.title", { item: name }),
            description: remove?.description ?? t("form.remove.body"),
            action: t("form.remove.action"),
            onConfirm: () =>
              edit(remove?.commands ?? [{ op: "remove", path: itemPath }], {
                isolate: true,
                announce: remove?.announce ?? t("form.removed", { item: name }),
                focus: remove?.focus ?? `${fieldId(listPath)}-add`,
              }),
          })
        }
      >
        <Trash2Icon aria-hidden />
        {t("form.remove.action")} <span className="sr-only">{name}</span>
      </Button>
    </div>
  );
}

/** "Agregar …" at the end of a list; the focus goes to the first field of the new item. */
export function AddButton({
  listPath,
  value,
  label,
  announce,
  focus,
  disabled = false,
  id,
}: {
  /** When the list has more than one "Agregar" button. */
  id?: string;
  listPath: EditPath;
  value: unknown;
  label: ReactNode;
  announce: string;
  focus: string;
  disabled?: boolean;
}) {
  const { readOnly, edit, fieldId } = useForm();
  return (
    <Button
      id={id ?? `${fieldId(listPath)}-add`}
      type="button"
      variant="outline"
      size="sm"
      className="self-start"
      disabled={readOnly || disabled}
      onClick={() =>
        edit([{ op: "append", path: listPath, value }], { isolate: true, announce, focus })
      }
    >
      {label}
    </Button>
  );
}

/**
 * A collapsible section: a heading with a button (the disclosure pattern of the APG), so the
 * sections are still headings to navigate by. The content renders only while it is open.
 */
export function Disclosure({
  id,
  level,
  title,
  open,
  onOpenChange,
  children,
  className,
}: {
  id: string;
  level: 3 | 4;
  title: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const Heading = level === 3 ? "h3" : "h4";
  const contentId = `${id}-content`;
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <Heading className={level === 3 ? "text-base font-semibold" : "text-sm font-semibold"}>
        <button
          id={id}
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => onOpenChange(!open)}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md py-1 text-left hover:underline"
        >
          <ChevronRightIcon
            aria-hidden
            className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")}
          />
          <span className="min-w-0 flex-1">{title}</span>
        </button>
      </Heading>
      <div id={contentId} hidden={!open} className="flex flex-col gap-4 pl-6">
        {open && children}
      </div>
    </section>
  );
}

/** A repeated group of fields ("Respuesta 2"), focusable so the validation panel can take you there. */
export function ItemGroup({
  path,
  title,
  context,
  actions,
  children,
}: {
  path: EditPath;
  title: string;
  context?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const legendId = useId();
  const { fieldId } = useForm();
  const issues = useIssues(path);
  return (
    <div
      id={fieldId(path)}
      role="group"
      tabIndex={-1}
      aria-labelledby={legendId}
      {...(issues.describedBy === undefined ? {} : { "aria-describedby": issues.describedBy })}
      className="flex flex-col gap-3 rounded-md border bg-card p-3 outline-offset-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={legendId} className="font-medium">
          {title}
          {context !== undefined && (
            <>
              {" "}
              <span className="sr-only">{context}</span>
            </>
          )}
        </span>
        {actions}
      </div>
      {issues.messages}
      {children}
    </div>
  );
}

/** A list of the form (answers, hints, …) under its heading: a named group that shows its issues. */
export function ListSection({
  path,
  title,
  level,
  context,
  children,
}: {
  path: EditPath;
  title: string;
  level: 4 | 5 | 6;
  context?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  const { fieldId } = useForm();
  const issues = useIssues(path);
  const Heading = level === 4 ? "h4" : level === 5 ? "h5" : "h6";
  return (
    <div
      id={fieldId(path)}
      role="group"
      tabIndex={-1}
      aria-labelledby={headingId}
      {...(issues.describedBy === undefined ? {} : { "aria-describedby": issues.describedBy })}
      className="flex flex-col gap-3 rounded-md outline-offset-2"
    >
      <Heading id={headingId} className="text-sm font-semibold">
        {title}
        {context !== undefined && (
          <>
            {" "}
            <span className="sr-only">{context}</span>
          </>
        )}
      </Heading>
      {issues.messages}
      {children}
    </div>
  );
}
