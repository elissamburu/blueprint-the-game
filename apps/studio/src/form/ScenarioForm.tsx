// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Form of the scenario (RF-STU-03): metadata, context, objectives, slots, and the groups, nodes and
// edges of the diagram, in collapsible sections. It reads the editor's text and edits it with commands by path (ADR-0025 §2), so the
// YAML stays the source of truth: every change is a transaction of the YAML editor, with its
// single undo history (Ctrl+Z and Ctrl+Y work here too). While the text does not parse, the form
// shows the last version that did, read-only, with the line of the error. The validation panel
// takes you to the field of an issue with `focusPath` (RF-STU-07).
import { Button } from "@blueprint/ui/components/button";
import {
  GRADES,
  OBJECTIVE_CATEGORIES,
  OBJECTIVE_KINDS,
  SCENARIO_STATUSES,
  type Service,
} from "@blueprint/scenario-schema";
import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { useTranslation } from "react-i18next";
import type { SharedContent } from "../../shared/api";
import type { StudioFinding } from "../../shared/validation";
import type { EditCommand, EditPath } from "./document-edit";
import {
  AddButton,
  CheckboxGroup,
  Disclosure,
  ItemActions,
  ItemGroup,
  ListSection,
  NumberField,
  SelectField,
  TextField,
  type CheckOption,
} from "./fields";
import { FormProvider, useForm } from "./form-context";
import { isRecord, listOf, recordOf, textOf, uniqueId, useFormDocument } from "./form-data";
import { anchorOf, fieldId, pathKey, type SectionKey } from "./form-paths";
import { EdgesFields, GroupsFields, NodesFields } from "./DiagramFields";
import { ServicePicker } from "./ServicePicker";

export interface ScenarioFormHandle {
  /** Opens the sections of the field of `path` and focuses it; false if the form has no field. */
  focusPath: (path: EditPath) => boolean;
}

export interface ScenarioFormProps {
  text: string;
  findings: readonly StudioFinding[];
  shared: SharedContent;
  onEdit: (commands: readonly EditCommand[], isolate: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onJumpToLine: (line: number) => void;
  ref?: Ref<ScenarioFormHandle>;
}

const LEVELS = [100, 200, 300, 400] as const;

const isSlotOf =
  (raw: unknown) =>
  (index: number): boolean =>
    recordOf(listOf(recordOf(recordOf(raw).diagram).nodes)[index]).type === "slot";

export function ScenarioForm({
  text,
  findings,
  shared,
  onEdit,
  onUndo,
  onRedo,
  onSave,
  onJumpToLine,
  ref,
}: ScenarioFormProps) {
  const { t } = useTranslation();
  const { raw, errorLine } = useFormDocument(text);
  const [open, setOpen] = useState<ReadonlySet<SectionKey>>(() => new Set(["metadata"]));
  const pendingFocus = useRef<string | undefined>(undefined);
  const headingId = useId();
  const isSlot = useMemo(() => isSlotOf(raw), [raw]);

  const byAnchor = useMemo(() => {
    const map = new Map<string, StudioFinding[]>();
    for (const finding of findings) {
      const anchor = anchorOf(finding.path, isSlot);
      if (anchor === undefined) continue;
      const key = pathKey(anchor.path);
      map.set(key, [...(map.get(key) ?? []), finding]);
    }
    return map;
  }, [findings, isSlot]);

  const slots = listOf(recordOf(recordOf(raw).diagram).nodes).flatMap((node, index) =>
    recordOf(node).type === "slot" ? [index] : [],
  );
  const allSections: SectionKey[] = [
    "metadata",
    "context",
    "objectives",
    "slots",
    ...slots.map((index): SectionKey => `slot-${index}`),
    "groups",
    "nodes",
    "edges",
  ];

  const setSection = useCallback((key: SectionKey, isOpen: boolean) => {
    setOpen((current) => {
      const next = new Set(current);
      if (isOpen) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  useImperativeHandle(ref, () => ({
    focusPath: (path) => {
      const anchor = anchorOf(path, isSlot);
      if (anchor === undefined) return false;
      setOpen((current) => new Set([...current, ...anchor.sections]));
      pendingFocus.current = fieldId(anchor.path);
      return true;
    },
  }));

  // Focus the field of the issue once its sections are open.
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === undefined) return;
    const element = document.getElementById(id);
    if (element === null) return;
    pendingFocus.current = undefined;
    element.focus();
    element.scrollIntoView?.({ block: "center" });
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "z" || key === "y") {
      // The undo of the inputs would undo only their own text: the editor's history undoes
      // the last change of the scenario, made here or in the YAML.
      event.preventDefault();
      if (key === "y" || event.shiftKey) onRedo();
      else onUndo();
    } else if (key === "s") {
      event.preventDefault();
      onSave();
    }
  };

  const readOnly = errorLine !== undefined;

  return (
    <FormProvider readOnly={readOnly} raw={raw} findings={byAnchor} onEdit={onEdit}>
      <section
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-4 pb-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={headingId} className="text-lg font-semibold">
            {t("form.title")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(new Set(allSections))}
            >
              {t("form.expandAll")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(new Set())}>
              {t("form.collapseAll")}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("form.lead")}</p>
        {readOnly && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-l-4 border-l-warning bg-warning-soft p-3">
            <p className="flex min-w-0 flex-1 items-start gap-2">
              <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
              {raw === undefined
                ? t("form.readOnlyNoData", { line: errorLine })
                : t("form.readOnly", { line: errorLine })}
            </p>
            <Button variant="outline" size="sm" onClick={() => onJumpToLine(errorLine)}>
              {t("draft.goToLine", { line: errorLine })}
            </Button>
          </div>
        )}
        {raw !== undefined && (
          <>
            <Disclosure
              id="form-section-metadata"
              level={3}
              title={t("form.metadata.title")}
              open={open.has("metadata")}
              onOpenChange={(isOpen) => setSection("metadata", isOpen)}
            >
              <MetadataFields shared={shared} />
            </Disclosure>
            <Disclosure
              id="form-section-context"
              level={3}
              title={t("form.context.title")}
              open={open.has("context")}
              onOpenChange={(isOpen) => setSection("context", isOpen)}
            >
              <TextField
                path={["context"]}
                label={t("form.context.label")}
                hint={t("form.context.hint")}
                multiline
              />
            </Disclosure>
            <Disclosure
              id="form-section-objectives"
              level={3}
              title={t("form.objectives.title")}
              open={open.has("objectives")}
              onOpenChange={(isOpen) => setSection("objectives", isOpen)}
            >
              <ObjectivesFields />
            </Disclosure>
            <Disclosure
              id="form-section-slots"
              level={3}
              title={t("form.slots.title")}
              open={open.has("slots")}
              onOpenChange={(isOpen) => setSection("slots", isOpen)}
            >
              {slots.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("form.slots.none")}</p>
              )}
              {slots.map((index, order) => (
                <SlotFields
                  key={index}
                  index={index}
                  number={order + 1}
                  services={shared.catalog}
                  open={open.has(`slot-${index}`)}
                  onOpenChange={(isOpen) => setSection(`slot-${index}`, isOpen)}
                />
              ))}
            </Disclosure>
            <Disclosure
              id="form-section-groups"
              level={3}
              title={t("form.groups.title")}
              open={open.has("groups")}
              onOpenChange={(isOpen) => setSection("groups", isOpen)}
            >
              <GroupsFields />
            </Disclosure>
            <Disclosure
              id="form-section-nodes"
              level={3}
              title={t("form.nodes.title")}
              open={open.has("nodes")}
              onOpenChange={(isOpen) => setSection("nodes", isOpen)}
            >
              <NodesFields services={shared.catalog} />
            </Disclosure>
            <Disclosure
              id="form-section-edges"
              level={3}
              title={t("form.edges.title")}
              open={open.has("edges")}
              onOpenChange={(isOpen) => setSection("edges", isOpen)}
            >
              <EdgesFields />
            </Disclosure>
          </>
        )}
      </section>
    </FormProvider>
  );
}

function MetadataFields({ shared }: { shared: SharedContent }) {
  const { t } = useTranslation();
  const { raw } = useForm();
  const authors = listOf(recordOf(raw).authors);
  return (
    <>
      <TextField
        path={["id"]}
        label={t("form.metadata.id")}
        hint={t("form.metadata.idHint")}
        locked
      />
      <TextField
        path={["title"]}
        label={t("form.metadata.titleField")}
        hint={t("form.metadata.titleHint")}
      />
      <TextField
        path={["summary"]}
        label={t("form.metadata.summary")}
        hint={t("form.metadata.summaryHint")}
        multiline
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          path={["level"]}
          label={t("form.metadata.level")}
          numeric
          options={LEVELS.map((level) => ({ value: String(level), label: String(level) }))}
        />
        <SelectField
          path={["status"]}
          label={t("form.metadata.status")}
          options={SCENARIO_STATUSES.map((status) => ({
            value: status,
            label: t(`status.${status}`),
          }))}
        />
        <NumberField path={["estimatedMinutes"]} label={t("form.metadata.minutes")} />
        <NumberField
          path={["version"]}
          label={t("form.metadata.version")}
          hint={t("form.metadata.versionHint")}
        />
      </div>
      <CheckboxGroup
        path={["areas"]}
        label={t("form.metadata.areas")}
        options={shared.areas.map((area) => ({
          value: area.id,
          label: area.id,
          description: area.name,
        }))}
      />
      <ListSection path={["authors"]} title={t("form.metadata.authors")} level={4}>
        {authors.map((_, index) => {
          const name = t("form.metadata.author", { number: index + 1 });
          return (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <TextField
                className="min-w-48 flex-1"
                path={["authors", index, "github"]}
                label={name}
              />
              <ItemActions
                listPath={["authors"]}
                index={index}
                count={authors.length}
                name={t("form.metadata.authorItem", { number: index + 1 })}
                canMove={false}
              />
            </div>
          );
        })}
        <AddButton
          listPath={["authors"]}
          value={{ github: "" }}
          label={
            <>
              <PlusIcon aria-hidden />
              {t("form.metadata.addAuthor")}
            </>
          }
          announce={t("form.added", {
            item: t("form.metadata.authorItem", { number: authors.length + 1 }),
          })}
          focus={fieldId(["authors", authors.length, "github"])}
        />
      </ListSection>
    </>
  );
}

function ObjectivesFields() {
  const { t } = useTranslation();
  const { raw } = useForm();
  const objectives = listOf(recordOf(raw).objectives);
  const ids = objectives.map((objective) => recordOf(objective).id);
  return (
    <>
      <p className="text-sm text-muted-foreground">{t("form.objectives.lead")}</p>
      {objectives.map((_, index) => {
        const number = index + 1;
        const context = t("form.objectives.context", { number });
        const path = ["objectives", index];
        return (
          <ItemGroup
            key={index}
            path={path}
            title={t("form.objectives.item", { number })}
            actions={
              <ItemActions
                listPath={["objectives"]}
                index={index}
                count={objectives.length}
                name={t("form.objectives.itemName", { number })}
              />
            }
          >
            <TextField
              path={[...path, "id"]}
              label={t("form.objectives.id")}
              context={context}
              {...(index === 0 ? { hint: t("form.objectives.idHint") } : {})}
            />
            <TextField
              path={[...path, "text"]}
              label={t("form.objectives.text")}
              context={context}
              multiline
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                path={[...path, "kind"]}
                label={t("form.objectives.kind")}
                context={context}
                options={OBJECTIVE_KINDS.map((kind) => ({
                  value: kind,
                  label: t(`form.objectives.kinds.${kind}`),
                }))}
              />
              <SelectField
                path={[...path, "category"]}
                label={t("form.objectives.category")}
                context={context}
                options={OBJECTIVE_CATEGORIES.map((category) => ({
                  value: category,
                  label: category,
                }))}
              />
            </div>
          </ItemGroup>
        );
      })}
      <AddButton
        listPath={["objectives"]}
        value={{
          id: uniqueId("nuevo-objetivo", ids),
          kind: "soft",
          category: "operations",
          text: "",
        }}
        label={
          <>
            <PlusIcon aria-hidden />
            {t("form.objectives.add")}
          </>
        }
        announce={t("form.added", {
          item: t("form.objectives.itemName", { number: objectives.length + 1 }),
        })}
        focus={fieldId(["objectives", objectives.length, "id"])}
      />
    </>
  );
}

/** The objectives of the scenario, as checkboxes for the answers and the incorrect ones. */
const useObjectiveOptions = (): CheckOption[] => {
  const { raw } = useForm();
  return listOf(recordOf(raw).objectives).flatMap((objective) => {
    if (!isRecord(objective)) return [];
    const id = textOf(objective.id);
    if (id === "") return [];
    const kind = textOf(objective.kind);
    return [
      {
        value: id,
        label: kind === "" ? id : `${id} (${kind})`,
        description: textOf(objective.text),
      },
    ];
  });
};

function SlotFields({
  index,
  number,
  services,
  open,
  onOpenChange,
}: {
  index: number;
  number: number;
  services: readonly Service[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { raw } = useForm();
  const objectives = useObjectiveOptions();
  const slotPath = ["diagram", "nodes", index];
  const slot = recordOf(listOf(recordOf(recordOf(raw).diagram).nodes)[index]);
  const role = textOf(slot.role);
  const hints = listOf(slot.hints);
  const answers = listOf(slot.answers);
  const incorrect = listOf(slot.incorrect);
  const slotContext = t("form.slots.context", { slot: number });

  return (
    <Disclosure
      // The node itself is in "Nodos": its id is the one of the node group there.
      id={`${fieldId(slotPath)}-slot`}
      level={4}
      title={
        role === ""
          ? t("form.slots.itemNoRole", { number })
          : t("form.slots.item", { number, role })
      }
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-md border p-3"
    >
      <TextField
        path={[...slotPath, "role"]}
        label={t("form.slots.role")}
        context={slotContext}
        hint={t("form.slots.roleHint")}
        multiline
      />

      <ListSection
        path={[...slotPath, "hints"]}
        title={t("form.slots.hints")}
        context={slotContext}
        level={5}
      >
        {hints.map((_, hint) => (
          <div key={hint} className="flex flex-wrap items-end gap-2">
            <TextField
              className="min-w-48 flex-1"
              path={[...slotPath, "hints", hint]}
              label={t("form.slots.hint", { number: hint + 1 })}
              context={slotContext}
            />
            <ItemActions
              listPath={[...slotPath, "hints"]}
              index={hint}
              count={hints.length}
              name={t("form.slots.hintName", { number: hint + 1, slot: number })}
            />
          </div>
        ))}
        <AddButton
          listPath={[...slotPath, "hints"]}
          value=""
          disabled={hints.length >= 3}
          label={
            <>
              <PlusIcon aria-hidden />
              {t("form.slots.addHint")} <span className="sr-only">{slotContext}</span>
            </>
          }
          announce={t("form.added", {
            item: t("form.slots.hintName", { number: hints.length + 1, slot: number }),
          })}
          focus={fieldId([...slotPath, "hints", hints.length])}
        />
      </ListSection>

      <ListSection
        path={[...slotPath, "answers"]}
        title={t("form.answers.title")}
        context={slotContext}
        level={5}
      >
        {answers.map((answer, item) => {
          const path = [...slotPath, "answers", item];
          const context = t("form.answers.context", { answer: item + 1, slot: number });
          const name = t("form.answers.name", { answer: item + 1, slot: number });
          const references = listOf(recordOf(answer).references);
          return (
            <ItemGroup
              key={item}
              path={path}
              title={t("form.answers.item", { number: item + 1 })}
              context={slotContext}
              actions={
                <ItemActions
                  listPath={[...slotPath, "answers"]}
                  index={item}
                  count={answers.length}
                  name={name}
                />
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ServicePicker
                  path={[...path, "service"]}
                  label={t("form.answers.service")}
                  context={context}
                  services={services}
                />
                <SelectField
                  path={[...path, "grade"]}
                  label={t("form.answers.grade")}
                  context={context}
                  options={GRADES.map((grade) => ({
                    value: grade,
                    label: t(`form.answers.grades.${grade}`),
                  }))}
                />
              </div>
              <CheckboxGroup
                path={[...path, "objectives"]}
                label={t("form.answers.objectives")}
                context={context}
                hint={t("form.answers.objectivesHint")}
                options={objectives}
              />
              <TextField
                path={[...path, "rationale"]}
                label={t("form.answers.rationale")}
                context={context}
                multiline
              />
              <ListSection
                path={[...path, "references"]}
                title={t("form.answers.references")}
                context={context}
                level={6}
              >
                {references.map((_, reference) => (
                  <div key={reference} className="flex flex-wrap items-end gap-2">
                    <TextField
                      className="min-w-48 flex-1"
                      path={[...path, "references", reference]}
                      label={t("form.answers.reference", { number: reference + 1 })}
                      context={context}
                      type="url"
                    />
                    <ItemActions
                      listPath={[...path, "references"]}
                      index={reference}
                      count={references.length}
                      name={t("form.answers.referenceName", {
                        number: reference + 1,
                        answer: item + 1,
                        slot: number,
                      })}
                      canMove={false}
                    />
                  </div>
                ))}
                <AddButton
                  listPath={[...path, "references"]}
                  value=""
                  label={
                    <>
                      <PlusIcon aria-hidden />
                      {t("form.answers.addReference")} <span className="sr-only">{context}</span>
                    </>
                  }
                  announce={t("form.added", {
                    item: t("form.answers.referenceName", {
                      number: references.length + 1,
                      answer: item + 1,
                      slot: number,
                    }),
                  })}
                  focus={fieldId([...path, "references", references.length])}
                />
              </ListSection>
            </ItemGroup>
          );
        })}
        <AddButton
          listPath={[...slotPath, "answers"]}
          value={{ service: "", grade: "optimal", objectives: [], rationale: "" }}
          label={
            <>
              <PlusIcon aria-hidden />
              {t("form.answers.add")} <span className="sr-only">{slotContext}</span>
            </>
          }
          announce={t("form.added", {
            item: t("form.answers.name", { answer: answers.length + 1, slot: number }),
          })}
          focus={fieldId([...slotPath, "answers", answers.length, "service"])}
        />
      </ListSection>

      <ListSection
        path={[...slotPath, "incorrect"]}
        title={t("form.incorrect.title")}
        context={slotContext}
        level={5}
      >
        <p className="text-sm text-muted-foreground">{t("form.incorrect.lead")}</p>
        {incorrect.map((_, item) => {
          const path = [...slotPath, "incorrect", item];
          const context = t("form.incorrect.context", { number: item + 1, slot: number });
          return (
            <ItemGroup
              key={item}
              path={path}
              title={t("form.incorrect.item", { number: item + 1 })}
              context={slotContext}
              actions={
                <ItemActions
                  listPath={[...slotPath, "incorrect"]}
                  index={item}
                  count={incorrect.length}
                  name={t("form.incorrect.name", { number: item + 1, slot: number })}
                />
              }
            >
              <ServicePicker
                path={[...path, "service"]}
                label={t("form.incorrect.service")}
                context={context}
                services={services}
              />
              <TextField
                path={[...path, "rationale"]}
                label={t("form.incorrect.rationale")}
                context={context}
                multiline
              />
              <CheckboxGroup
                path={[...path, "violates"]}
                label={t("form.incorrect.violates")}
                context={context}
                hint={t("form.incorrect.violatesHint")}
                options={objectives}
              />
            </ItemGroup>
          );
        })}
        <AddButton
          listPath={[...slotPath, "incorrect"]}
          value={{ service: "", rationale: "" }}
          label={
            <>
              <PlusIcon aria-hidden />
              {t("form.incorrect.add")} <span className="sr-only">{slotContext}</span>
            </>
          }
          announce={t("form.added", {
            item: t("form.incorrect.name", { number: incorrect.length + 1, slot: number }),
          })}
          focus={fieldId([...slotPath, "incorrect", incorrect.length, "service"])}
        />
      </ListSection>
    </Disclosure>
  );
}
