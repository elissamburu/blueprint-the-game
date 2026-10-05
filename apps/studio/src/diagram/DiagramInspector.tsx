// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Inspector of the "Diagrama" tab: the fields of the selected group, node or edge, the same fields
// of the form (by path, in the "diagram" scope of ids), its issues that no field shows, and its
// actions. Without a selection, the flow: the edges by step, each one a way to select it. The
// answers of a slot are edited in the form ("Editar respuestas en el formulario").
import {
  GROUP_KIND_NAMES,
  groupTitle,
  type DiagramCommand,
  type DiagramSelection,
  type ElementKind,
  type nodeNames,
} from "@blueprint/diagram/editor";
import {
  ACTOR_ICONS,
  EDGE_STYLES,
  GROUP_KINDS,
  type DiagramDraft,
  type Service,
} from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import {
  CableIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  SquarePenIcon,
  Trash2Icon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { StudioFinding } from "../../shared/validation";
import type { EditPath } from "../../shared/document-edit";
import { canMoveStep } from "../form/diagram-edit";
import { NumberField, SelectField, TextField, type Option } from "../form/fields";
import { listOf, textOf } from "../form/form-data";
import { anchorOf, isSlotOf, pathKey } from "../form/form-paths";
import { ServicePicker } from "../form/ServicePicker";
import { indexOf, itemsOf, LISTS } from "./diagram-commands";

/** Path of the first field of an element: where Enter and a new element take the focus. */
export const firstFieldOf = (
  kind: ElementKind,
  nodeType: string | undefined,
  index: number,
): EditPath => {
  const item: EditPath = ["diagram", LISTS[kind], index];
  if (kind !== "node") return [...item, "label"];
  switch (nodeType) {
    case "fixed":
      return [...item, "service"];
    case "slot":
      return [...item, "role"];
    case "actor":
    case "external":
      return [...item, "label"];
    default:
      return [...item, "id"];
  }
};

export interface DiagramInspectorProps {
  raw: unknown;
  draft: DiagramDraft;
  selection: DiagramSelection | null;
  findings: readonly StudioFinding[];
  services: readonly Service[];
  names: ReturnType<typeof nodeNames>;
  /** The element in words: "el casillero 1 «Guarda los archivos»". */
  nameOf: (selection: DiagramSelection) => string;
  readOnly: boolean;
  /** Selects an element in the canvas (and focuses it there). */
  onSelect: (selection: DiagramSelection) => void;
  onCommand: (command: DiagramCommand) => void;
  /** "Conectar con…" of the canvas, for the selected node. */
  onConnect: () => void;
  onOpenInForm: (path: EditPath) => void;
}

export function DiagramInspector(props: DiagramInspectorProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const { raw, selection } = props;
  const index = selection === null ? -1 : indexOf(raw, selection);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h3 id={headingId} className="text-base font-semibold">
        {t("diagram.inspector.title")}
      </h3>
      {selection === null || index === -1 ? (
        <FlowOverview {...props} />
      ) : selection.kind === "group" ? (
        <GroupInspector {...props} selection={selection} index={index} />
      ) : selection.kind === "node" ? (
        <NodeInspector {...props} selection={selection} index={index} />
      ) : (
        <EdgeInspector {...props} selection={selection} index={index} />
      )}
    </section>
  );
}

type ElementProps = DiagramInspectorProps & { selection: DiagramSelection; index: number };

const stepOf = (value: unknown): number | undefined => {
  const step = Number(value);
  return Number.isFinite(step) && value !== undefined && value !== "" ? step : undefined;
};

/** The edges sorted by step (file order within a step), with their names. */
const edgesByStep = (
  raw: unknown,
  names: DiagramInspectorProps["names"],
  filter: (edge: { from: string; to: string }) => boolean = () => true,
) =>
  itemsOf(raw, "edges")
    .map((edge, at) => ({
      id: textOf(edge.id),
      from: textOf(edge.from),
      to: textOf(edge.to),
      step: stepOf(edge.step),
      label: textOf(edge.label),
      at,
    }))
    .filter((edge) => edge.id !== "" && filter(edge))
    .sort((a, b) => (a.step ?? Infinity) - (b.step ?? Infinity) || a.at - b.at)
    .map((edge) => ({
      ...edge,
      fromName: names.get(edge.from)?.title ?? edge.from,
      toName: names.get(edge.to)?.title ?? edge.to,
    }));

function EdgeList({
  edges,
  onSelect,
}: {
  edges: ReturnType<typeof edgesByStep>;
  onSelect: (selection: DiagramSelection) => void;
}) {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-col gap-1">
      {edges.map((edge) => (
        <li key={edge.id}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start py-1.5 text-left whitespace-normal"
            onClick={() => onSelect({ kind: "edge", id: edge.id })}
          >
            <span>
              {t("diagram.inspector.flowItem", {
                step: edge.step ?? t("diagram.inspector.noStep"),
                from: edge.fromName,
                to: edge.toName,
              })}
              {edge.label !== "" && <span className="text-muted-foreground"> «{edge.label}»</span>}
            </span>
          </Button>
        </li>
      ))}
    </ol>
  );
}

function FlowOverview({ raw, names, onSelect }: DiagramInspectorProps) {
  const { t } = useTranslation();
  const edges = edgesByStep(raw, names);
  return (
    <>
      <p className="text-sm text-muted-foreground">{t("diagram.inspector.empty")}</p>
      <h4 className="font-semibold">{t("diagram.inspector.flow")}</h4>
      {edges.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("diagram.inspector.noEdges")}</p>
      ) : (
        <EdgeList edges={edges} onSelect={onSelect} />
      )}
    </>
  );
}

/**
 * The issues of the element that none of its fields shows (an overlap, the answers of a slot, a
 * step with gaps), each with its severity in words.
 */
function ElementFindings({
  raw,
  findings,
  path,
  fields,
}: {
  raw: unknown;
  findings: readonly StudioFinding[];
  path: EditPath;
  /** The fields the inspector shows, relative to the element (`["position", "x"]`). */
  fields: readonly EditPath[];
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const isSlot = isSlotOf(raw);
  const shown = new Set(fields.map((field) => pathKey([...path, ...field])));
  const own = findings.filter((finding) => {
    if (!path.every((key, at) => finding.path[at] === key)) return false;
    const anchor = anchorOf(finding.path, isSlot);
    return anchor === undefined || !shown.has(pathKey(anchor.path));
  });
  if (own.length === 0) return null;
  return (
    <div aria-labelledby={headingId} role="group" className="flex flex-col gap-1">
      <h4 id={headingId} className="text-sm font-semibold">
        {t("diagram.inspector.findings")}
      </h4>
      <ul className="flex flex-col gap-1 text-sm">
        {own.map((finding, at) => (
          <li
            key={`${finding.code}-${at}`}
            className={finding.severity === "error" ? "text-destructive" : "text-warning"}
          >
            <span className="font-medium">
              {t(`validation.severity.${finding.severity}`)} {finding.code}:
            </span>{" "}
            {finding.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ElementHeading({ children }: { children: string }) {
  return <h4 className="font-semibold break-words">{children}</h4>;
}

function Actions({
  selection,
  readOnly,
  onCommand,
  connect,
}: {
  selection: DiagramSelection;
  readOnly: boolean;
  onCommand: (command: DiagramCommand) => void;
  connect?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2 border-t pt-3">
      {connect !== undefined && (
        <Button type="button" variant="outline" size="sm" disabled={readOnly} onClick={connect}>
          <CableIcon aria-hidden />
          {t("diagram.inspector.connect")}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={readOnly}
        onClick={() => onCommand({ type: "remove", target: selection })}
      >
        <Trash2Icon aria-hidden />
        {t("diagram.inspector.remove")}
      </Button>
    </div>
  );
}

const BOX_FIELDS = (box: "position" | "rect"): EditPath[] =>
  (box === "position" ? ["x", "y"] : ["x", "y", "w", "h"]).map((key) => [box, key]);

function BoxFields({ path, box }: { path: EditPath; box: "position" | "rect" }) {
  const { t } = useTranslation();
  const keys = box === "position" ? (["x", "y"] as const) : (["x", "y", "w", "h"] as const);
  return (
    <div className="grid grid-cols-2 gap-3">
      {keys.map((key) => (
        <NumberField key={key} path={[...path, box, key]} label={t(`form.diagram.${key}`)} />
      ))}
    </div>
  );
}

const groupOptions = (draft: DiagramDraft, except?: string): Option[] =>
  draft.groups
    .filter((group) => group.id !== except)
    .map((group) => ({ value: group.id, label: `${groupTitle(group)} (${group.id})` }));

function GroupInspector(props: ElementProps) {
  const { t } = useTranslation();
  const { raw, draft, findings, selection, index, readOnly, onCommand } = props;
  const path: EditPath = ["diagram", "groups", index];
  const nodes = draft.nodes.filter((node) => node.group === selection.id).length;
  return (
    <>
      <ElementHeading>{t("diagram.inspector.group", { id: selection.id })}</ElementHeading>
      <ElementFindings
        raw={raw}
        findings={findings}
        path={path}
        fields={[["id"], ["label"], ["kind"], ["parent"], ...BOX_FIELDS("rect")]}
      />
      <TextField path={[...path, "label"]} label={t("form.diagram.label")} />
      <SelectField
        path={[...path, "kind"]}
        label={t("form.groups.kind")}
        options={GROUP_KINDS.map((kind) => ({ value: kind, label: GROUP_KIND_NAMES[kind] }))}
      />
      <SelectField
        path={[...path, "parent"]}
        label={t("form.groups.parent")}
        none={{ label: t("form.groups.noParent"), value: null }}
        options={groupOptions(draft, selection.id)}
      />
      <BoxFields path={path} box="rect" />
      <TextField path={[...path, "id"]} label={t("form.diagram.id")} />
      <p className="text-sm text-muted-foreground">
        {t("diagram.inspector.nodesInside", { count: nodes })}
      </p>
      <Actions selection={selection} readOnly={readOnly} onCommand={onCommand} />
    </>
  );
}

function NodeInspector(props: ElementProps) {
  const { t } = useTranslation();
  const { raw, draft, findings, services, names, selection, index, readOnly } = props;
  const path: EditPath = ["diagram", "nodes", index];
  const item = itemsOf(raw, "nodes")[index] ?? {};
  const type = textOf(item.type);
  const name = names.get(selection.id);
  const edges = edgesByStep(
    raw,
    names,
    (edge) => edge.from === selection.id || edge.to === selection.id,
  );
  const fields: EditPath[] = [["id"], ["group"], ...BOX_FIELDS("position")];
  if (type === "actor" || type === "external") fields.push(["label"], ["icon"]);
  if (type === "fixed") fields.push(["service"]);
  if (type === "slot") fields.push(["role"]);
  const answers = listOf(item.answers).length;
  return (
    <>
      <ElementHeading>
        {t("diagram.inspector.node", { type: name?.typeName ?? type, id: selection.id })}
      </ElementHeading>
      <ElementFindings raw={raw} findings={findings} path={path} fields={fields} />
      {(type === "actor" || type === "external") && (
        <>
          <TextField path={[...path, "label"]} label={t("form.diagram.label")} />
          <SelectField
            path={[...path, "icon"]}
            label={t("form.nodes.icon")}
            options={ACTOR_ICONS.map((icon) => ({ value: icon, label: icon }))}
          />
        </>
      )}
      {type === "fixed" && (
        <ServicePicker
          path={[...path, "service"]}
          label={t("form.nodes.service")}
          services={services}
        />
      )}
      {type === "slot" && (
        <>
          <TextField
            path={[...path, "role"]}
            label={t("form.slots.role")}
            hint={t("form.slots.roleHint")}
            multiline
          />
          <p className="text-sm">
            {answers === 0
              ? t("diagram.inspector.answersNone")
              : t("diagram.inspector.answers", { count: answers })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => props.onOpenInForm([...path, "answers"])}
          >
            <SquarePenIcon aria-hidden />
            {t("diagram.inspector.editAnswers")}
          </Button>
        </>
      )}
      <SelectField
        path={[...path, "group"]}
        label={t("form.nodes.group")}
        none={{ label: t("form.nodes.noGroup"), value: undefined }}
        options={groupOptions(draft)}
      />
      <BoxFields path={path} box="position" />
      <TextField path={[...path, "id"]} label={t("form.diagram.id")} />
      <h4 className="font-semibold">{t("diagram.inspector.edges")}</h4>
      {edges.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("diagram.inspector.noNodeEdges")}</p>
      ) : (
        <EdgeList edges={edges} onSelect={props.onSelect} />
      )}
      <Actions
        selection={selection}
        readOnly={readOnly}
        onCommand={props.onCommand}
        connect={props.onConnect}
      />
    </>
  );
}

function EdgeInspector(props: ElementProps) {
  const { t } = useTranslation();
  const { raw, draft, findings, names, selection, index, readOnly, onCommand } = props;
  const path: EditPath = ["diagram", "edges", index];
  const edges = itemsOf(raw, "edges");
  const steps = edges.map((edge) => stepOf(edge.step) ?? 0);
  const step = stepOf(edges[index]?.step);
  const parallel = edges
    .filter((edge, at) => at !== index && step !== undefined && stepOf(edge.step) === step)
    .map((edge) => textOf(edge.id));
  const nodes: Option[] = draft.nodes.map((node) => ({
    value: node.id,
    label: `${names.get(node.id)?.title ?? node.id} (${node.id})`,
  }));
  const stepId = useId();
  const moveStep = (direction: -1 | 1) =>
    onCommand({ type: "moveStep", edgeId: selection.id, direction });
  return (
    <>
      <ElementHeading>{t("diagram.inspector.edge", { id: selection.id })}</ElementHeading>
      <ElementFindings
        raw={raw}
        findings={findings}
        path={path}
        fields={[["id"], ["from"], ["to"], ["label"], ["style"], ["description"]]}
      />
      <TextField path={[...path, "label"]} label={t("form.diagram.label")} />
      <SelectField path={[...path, "from"]} label={t("form.edges.from")} options={nodes} />
      <SelectField path={[...path, "to"]} label={t("form.edges.to")} options={nodes} />
      <div role="group" aria-labelledby={stepId} className="flex flex-col gap-2">
        <p id={stepId} className="text-sm font-medium">
          {step === undefined
            ? t("diagram.inspector.noStepTitle")
            : t("diagram.inspector.step", { step })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || !canMoveStep(steps, index, -1)}
            onClick={() => moveStep(-1)}
          >
            <ChevronsUpIcon aria-hidden />
            {t("diagram.inspector.stepEarlier")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || !canMoveStep(steps, index, 1)}
            onClick={() => moveStep(1)}
          >
            <ChevronsDownIcon aria-hidden />
            {t("diagram.inspector.stepLater")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {parallel.length === 0
            ? t("diagram.inspector.noParallel")
            : t("diagram.inspector.parallel", { edges: parallel.join(", ") })}
        </p>
      </div>
      <SelectField
        path={[...path, "style"]}
        label={t("form.edges.style")}
        options={EDGE_STYLES.map((style) => ({
          value: style,
          label: t(`form.edges.styles.${style}`),
        }))}
      />
      <TextField
        path={[...path, "description"]}
        label={t("form.edges.description")}
        hint={t("form.edges.descriptionHint")}
        multiline
        optional
      />
      <TextField path={[...path, "id"]} label={t("form.diagram.id")} />
      <Actions selection={selection} readOnly={readOnly} onCommand={onCommand} />
    </>
  );
}
