// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// «Dónde se rompe la analogía» of an answer (ADR-0027 §2 and §6, RF-STU-19): its text, with a count
// of the 300 characters, and its official references. Without one, a button creates it; with one,
// «Quitar» removes it whole (emptying the text never removes the key). At level 0 it is required in
// every answer, and the group says so in words; the L021 finding of its answer shows here, tied to
// the group and to the button that adds it with aria-describedby.
import { Button } from "@blueprint/ui/components/button";
import { MAX_LENGTH } from "@blueprint/scenario-schema";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { EditPath } from "../../shared/document-edit";
import { analogyLimitPath, createAnalogyLimit, removeAnalogyLimit } from "./analogy-limit";
import { AddButton, ItemActions, ListSection, TextField, useIssues } from "./fields";
import { listOf, recordOf, valueAt } from "./form-data";
import { useForm } from "./form-context";

export function AnalogyLimitFields({
  answerPath,
  answer,
  slot,
  required,
}: {
  answerPath: EditPath;
  /** Number of the answer and of its slot, for the names of the fields. */
  answer: number;
  slot: number;
  /** Level 0: every answer needs one (L021). */
  required: boolean;
}) {
  const { t } = useTranslation();
  const { raw, readOnly, edit, confirm, fieldId } = useForm();
  const headingId = useId();
  const hintId = useId();
  const path = analogyLimitPath(answerPath);
  const issues = useIssues(path, hintId);
  const value = valueAt(raw, path);
  // `analogyLimit:` with nothing in it is still there, to fill or remove.
  const exists = value !== undefined;
  const referencesPath = [...path, "references"];
  const references = listOf(recordOf(value).references);
  /** The rest of the names of the group and its button ("de la respuesta 2…"), and of its fields. */
  const answerContext = t("form.answers.context", { answer, slot });
  const context = t("form.analogy.context", { answer, slot });
  const name = t("form.analogy.name", { answer, slot });
  const describedBy =
    issues.describedBy === undefined ? {} : { "aria-describedby": issues.describedBy };

  return (
    <div
      id={fieldId(path)}
      role="group"
      tabIndex={-1}
      aria-labelledby={headingId}
      {...describedBy}
      className="flex flex-col gap-3 rounded-md border p-3 outline-offset-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h6 id={headingId} className="text-sm font-semibold">
          {t("form.analogy.title")} <span className="sr-only">{answerContext}</span>
          {required && (
            <>
              {" "}
              <span className="font-normal text-muted-foreground">
                {t("form.analogy.requiredMark")}
              </span>
            </>
          )}
        </h6>
        {exists && (
          <Button
            id={`${fieldId(path)}-remove`}
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly}
            onClick={() =>
              confirm({
                title: t("form.remove.title", { item: name }),
                description: t("form.analogy.removeBody"),
                action: t("form.remove.action"),
                onConfirm: () =>
                  edit(removeAnalogyLimit(answerPath), {
                    isolate: true,
                    announce: t("form.removed", { item: name }),
                    focus: `${fieldId(path)}-add`,
                  }),
              })
            }
          >
            <Trash2Icon aria-hidden />
            {t("form.remove.action")} <span className="sr-only">{name}</span>
          </Button>
        )}
      </div>
      <p id={hintId} className="text-sm text-muted-foreground">
        {t(required ? "form.analogy.requiredHint" : "form.analogy.optionalHint")}
      </p>
      {issues.messages}
      {exists ? (
        <>
          <TextField
            path={[...path, "text"]}
            label={t("form.analogy.text")}
            context={context}
            multiline
            required={required}
            maxLength={MAX_LENGTH.analogyLimit}
          />
          <ListSection
            path={referencesPath}
            title={t("form.analogy.references")}
            context={context}
            level={6}
          >
            {references.map((_, reference) => (
              <div key={reference} className="flex flex-wrap items-end gap-2">
                <TextField
                  className="min-w-48 flex-1"
                  path={[...referencesPath, reference]}
                  label={t("form.analogy.reference", { number: reference + 1 })}
                  context={context}
                  type="url"
                />
                <ItemActions
                  listPath={referencesPath}
                  index={reference}
                  count={references.length}
                  name={t("form.analogy.referenceName", { number: reference + 1, answer, slot })}
                  canMove={false}
                />
              </div>
            ))}
            <AddButton
              listPath={referencesPath}
              value=""
              label={
                <>
                  <PlusIcon aria-hidden />
                  {t("form.analogy.addReference")} <span className="sr-only">{context}</span>
                </>
              }
              announce={t("form.added", {
                item: t("form.analogy.referenceName", {
                  number: references.length + 1,
                  answer,
                  slot,
                }),
              })}
              focus={fieldId([...referencesPath, references.length])}
            />
          </ListSection>
        </>
      ) : (
        <Button
          id={`${fieldId(path)}-add`}
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={readOnly}
          {...describedBy}
          onClick={() =>
            edit(createAnalogyLimit(answerPath), {
              isolate: true,
              announce: t("form.added", { item: name }),
              focus: fieldId([...path, "text"]),
            })
          }
        >
          <PlusIcon aria-hidden />
          {t("form.analogy.add")} <span className="sr-only">{answerContext}</span>
        </Button>
      )}
    </div>
  );
}
