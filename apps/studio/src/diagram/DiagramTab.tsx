// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The "Diagrama" tab of the editor (RF-STU-04): the visual editor of @blueprint/diagram, the
// inspector of the selection and a status line. The editor draws a draft of the diagram read from
// the editor's text (ADR-0025, amendment 2026-10-05) and emits commands by id; this tab turns them
// into the same document edits as the form (diagram-commands.ts), so the YAML stays the source of
// truth with one undo history. Removing always asks first. While the text does not parse, the
// canvas and the inspector are read-only, with the line of the error.
import {
  DiagramEditor,
  groupTitle,
  nodeNames,
  type DiagramCommand,
  type DiagramEditorHandle,
  type DiagramSelection,
  type ElementIssues,
  type IssueLevel,
} from "@blueprint/diagram/editor";
import { createServiceLookup } from "@blueprint/play";
import { parseDiagramDraft, type DiagramDraft } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { TriangleAlertIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { SharedContent } from "../../shared/api";
import type { StudioFinding } from "../../shared/validation";
import { EditError, type EditCommand, type EditPath } from "../form/document-edit";
import { edgesOfNode } from "../form/diagram-edit";
import { FormProvider, useForm } from "../form/form-context";
import { recordOf, textOf, useFormDocument } from "../form/form-data";
import { findingsByAnchor, isSlotOf } from "../form/form-paths";
import { studioIconSrc } from "../preview/studio-game-host";
import { indexOf, itemsOf, LISTS, translate } from "./diagram-commands";
import { DiagramInspector, firstFieldOf } from "./DiagramInspector";

export interface DiagramTabProps {
  text: string;
  findings: readonly StudioFinding[];
  shared: SharedContent;
  onEdit: (commands: readonly EditCommand[], isolate: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onJumpToLine: (line: number) => void;
  /** Takes the author to a field of the form (the answers of a slot). */
  onOpenInForm: (path: EditPath) => void;
}

const LEVEL_ORDER: Record<IssueLevel, number> = { warning: 0, error: 1 };

/** The worst issue of each element of the diagram, by its selection key. */
export const elementIssues = (raw: unknown, findings: readonly StudioFinding[]): ElementIssues => {
  const issues = new Map<string, IssueLevel>();
  for (const finding of findings) {
    const [root, list, index] = finding.path;
    if (root !== "diagram" || typeof index !== "number") continue;
    const kind = (Object.keys(LISTS) as DiagramSelection["kind"][]).find(
      (candidate) => LISTS[candidate] === list,
    );
    const id = kind === undefined ? "" : textOf(itemsOf(raw, LISTS[kind])[index]?.id);
    if (kind === undefined || id === "") continue;
    const key = `${kind}:${id}`;
    const level = finding.severity === "error" ? "error" : "warning";
    const current = issues.get(key);
    if (current === undefined || LEVEL_ORDER[level] > LEVEL_ORDER[current]) issues.set(key, level);
  }
  return issues;
};

export function DiagramTab(props: DiagramTabProps) {
  const { t } = useTranslation();
  const { raw, errorLine } = useFormDocument(props.text);
  const isSlot = useMemo(() => isSlotOf(raw), [raw]);
  const byAnchor = useMemo(
    () => findingsByAnchor(props.findings, isSlot),
    [props.findings, isSlot],
  );
  const readOnly = errorLine !== undefined;
  const headingId = useId();

  return (
    <FormProvider
      readOnly={readOnly}
      raw={raw}
      findings={byAnchor}
      onEdit={props.onEdit}
      idScope="diagram"
    >
      <section aria-labelledby={headingId} className="flex min-h-0 flex-1 flex-col gap-3">
        <h2 id={headingId} className="text-lg font-semibold">
          {t("diagram.title")}
        </h2>
        {readOnly && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-l-4 border-l-warning bg-warning-soft p-3">
            <p className="flex min-w-0 flex-1 items-start gap-2">
              <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
              {raw === undefined
                ? t("diagram.readOnlyNoData", { line: errorLine })
                : t("diagram.readOnly", { line: errorLine })}
            </p>
            <Button variant="outline" size="sm" onClick={() => props.onJumpToLine(errorLine)}>
              {t("draft.goToLine", { line: errorLine })}
            </Button>
          </div>
        )}
        {raw !== undefined && <DiagramWorkspace {...props} raw={raw} readOnly={readOnly} />}
      </section>
    </FormProvider>
  );
}

/** The selection and the index of its element, to follow it when its id is renamed. */
interface Selected {
  selection: DiagramSelection | null;
  index: number;
}

const hasId = (draft: DiagramDraft, selection: DiagramSelection) =>
  (selection.kind === "group"
    ? draft.groups
    : selection.kind === "node"
      ? draft.nodes
      : draft.edges
  )
    // The draft keeps the first element of each id.
    .some((element) => element.id === selection.id);

/** A sentence starts with the element: "El casillero 1 «…» queda en…". */
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("es") + text.slice(1);

/** How long the keyboard moves wait before they are said (one announcement per burst). */
const MOVE_ANNOUNCE_MS = 450;

function DiagramWorkspace({
  raw,
  readOnly,
  findings,
  shared,
  onUndo,
  onRedo,
  onSave,
  onOpenInForm,
}: DiagramTabProps & { raw: unknown; readOnly: boolean }) {
  const { t } = useTranslation();
  const { edit, confirm, focusLater, fieldId } = useForm();
  const editor = useRef<DiagramEditorHandle>(null);
  const canvasId = useId();
  const draft = useMemo(() => parseDiagramDraft(recordOf(raw).diagram), [raw]);
  const services = useMemo(() => createServiceLookup(shared.catalog, studioIconSrc), [shared]);
  const issues = useMemo(() => elementIssues(raw, findings), [raw, findings]);
  const names = useMemo(() => nodeNames(draft, services), [draft, services]);

  const [selected, setSelected] = useState<Selected>({ selection: null, index: -1 });
  let selection = selected.selection;
  if (selection !== null && !hasId(draft, selection)) {
    // Renamed in the inspector or in the YAML: the element at the same index, if it has an id.
    const id = textOf(itemsOf(raw, LISTS[selection.kind])[selected.index]?.id);
    const renamed = id === "" ? null : { kind: selection.kind, id };
    selection = renamed !== null && hasId(draft, renamed) ? renamed : null;
    setSelected({ selection, index: selection === null ? -1 : selected.index });
  }
  const select = useCallback(
    (next: DiagramSelection | null) =>
      setSelected({ selection: next, index: next === null ? -1 : indexOf(raw, next) }),
    [raw],
  );

  // The status line: visible, and said by screen readers (the only live region of the tab).
  const [status, setStatus] = useState("");
  const pendingStatus = useRef<number | undefined>(undefined);
  /** A change of group in the current burst of arrows: the last announcement keeps it. */
  const burstMembership = useRef("");
  const say = useCallback((message: string, later = false, membership = "") => {
    window.clearTimeout(pendingStatus.current);
    if (!later) {
      burstMembership.current = "";
      setStatus(`${message}${membership}`);
      return;
    }
    if (membership !== "") burstMembership.current = membership;
    const text = `${message}${burstMembership.current}`;
    pendingStatus.current = window.setTimeout(() => {
      burstMembership.current = "";
      setStatus(text);
    }, MOVE_ANNOUNCE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(pendingStatus.current), []);

  /** "el casillero 2 «Guarda los archivos»", "el grupo «VPC»", "la arista de A a B". */
  const nameOf = useCallback(
    (target: DiagramSelection): string => {
      if (target.kind === "node") {
        const name = names.get(target.id);
        return t("diagram.item.node", {
          type: (name?.typeName ?? "").toLocaleLowerCase("es"),
          title: name?.title ?? target.id,
        });
      }
      if (target.kind === "group") {
        const group = draft.groups.find((candidate) => candidate.id === target.id);
        return t("diagram.item.group", {
          title: group === undefined ? target.id : groupTitle(group),
        });
      }
      const edge = draft.edges.find((candidate) => candidate.id === target.id);
      return t("diagram.item.edge", {
        from: names.get(edge?.from ?? "")?.title ?? edge?.from ?? "?",
        to: names.get(edge?.to ?? "")?.title ?? edge?.to ?? "?",
      });
    },
    [draft, names, t],
  );

  const groupName = (id: string | null) => {
    const group = id === null ? undefined : draft.groups.find((candidate) => candidate.id === id);
    return group === undefined ? undefined : groupTitle(group);
  };

  /** Where the first placed element ends up, and its change of group (if any). */
  const describePlace = (
    command: Extract<DiagramCommand, { type: "place" }>,
  ): { where: string; membership: string } => {
    const [first] = command.placements;
    if (first === undefined) return { where: "", membership: "" };
    const target = { kind: first.kind, id: first.id };
    const where =
      first.kind === "node"
        ? t("diagram.status.at", {
            item: capitalize(nameOf(target)),
            x: first.position.x,
            y: first.position.y,
          })
        : t("diagram.status.atBox", { item: capitalize(nameOf(target)), ...first.rect });
    const before =
      first.kind === "node"
        ? (draft.nodes.find((node) => node.id === first.id)?.group ?? null)
        : (draft.groups.find((group) => group.id === first.id)?.parent ?? null);
    const after = first.kind === "node" ? first.group : first.parent;
    const membership =
      before === after
        ? ""
        : ` ${after === null ? t("diagram.status.noGroup") : t("diagram.status.inGroup", { group: groupName(after) ?? after })}`;
    return { where, membership };
  };

  const remove = (target: DiagramSelection) => {
    const index = indexOf(raw, target);
    if (index === -1) return;
    const item = nameOf(target);
    const description =
      target.kind === "node"
        ? t("form.nodes.removeBody", { count: edgesOfNode(raw, index).length })
        : target.kind === "group"
          ? t("form.groups.removeBody", {
              count: draft.nodes.filter((node) => node.group === target.id).length,
            })
          : t("form.remove.body");
    confirm({
      title: t("diagram.remove.title", { item }),
      description,
      action: t("diagram.remove.action"),
      onConfirm: () => {
        const { commands } = translate(raw, { type: "remove", target });
        edit(commands, { isolate: true, focus: canvasId });
        select(null);
        say(t("diagram.status.removed", { item }));
      },
    });
  };

  const run = (command: DiagramCommand) => {
    if (readOnly) return;
    if (command.type === "remove") {
      remove(command.target);
      return;
    }
    let translation;
    try {
      translation = translate(raw, command);
    } catch (error) {
      if (!(error instanceof EditError)) throw error;
      say(t("form.editFailed", { message: error.message }));
      return;
    }
    const { commands, isolate, select: created, step } = translation;
    if (commands.length === 0) return;
    edit(commands, { isolate });
    switch (command.type) {
      case "place": {
        const { where, membership } = describePlace(command);
        say(where, command.input === "keyboard", membership);
        break;
      }
      case "moveStep":
        say(
          t("diagram.status.step", {
            item: capitalize(nameOf({ kind: "edge", id: command.edgeId })),
            step,
          }),
        );
        break;
      default:
        if (created === undefined) break;
        select(created);
        // The new element is completed in the inspector: the focus goes to its first field.
        focusLater(
          fieldId(
            firstFieldOf(
              created.kind,
              command.type === "addNode" ? command.nodeType : undefined,
              itemsOf(raw, LISTS[created.kind]).length,
            ),
          ),
        );
        say(
          command.type === "connect"
            ? t("diagram.status.connected", {
                from: names.get(command.from)?.title ?? command.from,
                to: names.get(command.to)?.title ?? command.to,
              })
            : t("diagram.status.added", {
                type:
                  command.type === "addNode"
                    ? t(`diagram.types.${command.nodeType}`)
                    : t("diagram.types.group"),
              }),
        );
    }
  };

  const activate = (target: DiagramSelection) => {
    const index = indexOf(raw, target);
    const item = itemsOf(raw, LISTS[target.kind])[index];
    if (item === undefined) return;
    const path = firstFieldOf(target.kind, textOf(item.type), index);
    document.getElementById(fieldId(path))?.focus();
  };

  // Undo, redo and save also from the inspector, as in the form.
  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "z" || key === "y") {
      event.preventDefault();
      if (key === "y" || event.shiftKey) onRedo();
      else onUndo();
    } else if (key === "s") {
      event.preventDefault();
      onSave();
    }
  };

  return (
    <>
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <DiagramEditor
          ref={editor}
          id={canvasId}
          draft={draft}
          services={services}
          selection={selection}
          onSelectionChange={select}
          onCommand={run}
          issues={issues}
          readOnly={readOnly}
          onActivate={activate}
          onUndo={onUndo}
          onRedo={onRedo}
          onSave={onSave}
          label={t("diagram.canvas")}
          className="min-h-[30rem]"
        />
        <div onKeyDown={onKeyDown} className="min-h-0 overflow-y-auto xl:pr-1">
          <DiagramInspector
            raw={raw}
            draft={draft}
            selection={selection}
            findings={findings}
            services={shared.catalog}
            names={names}
            nameOf={nameOf}
            readOnly={readOnly}
            onSelect={(target) => editor.current?.focus(target)}
            onCommand={run}
            onConnect={() => editor.current?.openConnect()}
            onOpenInForm={onOpenInForm}
          />
        </div>
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-slot="diagram-status"
        className="min-h-6 border-t pt-2 text-sm"
      >
        {status}
      </p>
    </>
  );
}
