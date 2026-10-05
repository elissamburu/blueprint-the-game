// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Groups, nodes and edges of the diagram in the form (RF-STU-03, 4b): create and remove them,
// parent and group, the box in numbers (x, y, w, h), and the edges with "Desde", "Hacia" and
// "Paso", moved one step earlier or later with buttons. It is the keyboard alternative to the
// visual editor of PR 5 (docs/accesibilidad.md, 2.1.1 and 2.5.7), and both emit the same commands.
// Removing a node removes its edges, and removing a group leaves no reference to it, in one edit.
import {
  ACTOR_ICONS,
  EDGE_STYLES,
  GROUP_KINDS,
  NODE_TYPES,
  type Service,
} from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { ChevronsDownIcon, ChevronsUpIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  canMoveStep,
  edgesOfNode,
  moveStep,
  removeGroupCommands,
  newEdge,
  newGroup,
  newNode,
  removeNodeCommands,
  stepCommands,
  type StepDirection,
} from "./diagram-edit";
import type { EditPath } from "../../shared/document-edit";
import {
  AddButton,
  ItemActions,
  ItemGroup,
  ListSection,
  NumberField,
  SelectField,
  TextField,
  type Option,
} from "./fields";
import { useForm } from "./form-context";
import { listOf, recordOf, textOf, type RawRecord } from "./form-data";
import { fieldId } from "./form-paths";
import { ServicePicker } from "./ServicePicker";

const diagramOf = (raw: unknown) => recordOf(recordOf(raw).diagram);
const itemsOf = (raw: unknown, list: "groups" | "nodes" | "edges"): RawRecord[] =>
  listOf(diagramOf(raw)[list]).map(recordOf);

function Box({
  path,
  context,
  size,
}: {
  path: EditPath;
  context: string;
  /** With width and height (the rect of a group), or only the position (a node). */
  size: boolean;
}) {
  const { t } = useTranslation();
  const keys = size ? (["x", "y", "w", "h"] as const) : (["x", "y"] as const);
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {keys.map((key) => (
        <NumberField
          key={key}
          path={[...path, key]}
          label={t(`form.diagram.${key}`)}
          context={context}
        />
      ))}
    </div>
  );
}

export function GroupsFields() {
  const { t } = useTranslation();
  const { raw } = useForm();
  const groups = itemsOf(raw, "groups");
  const ids = groups.map((group) => textOf(group.id));
  const listPath: EditPath = ["diagram", "groups"];
  return (
    <ListSection path={listPath} title={t("form.groups.list")} level={4}>
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("form.groups.none")}</p>
      )}
      {groups.map((group, index) => {
        const number = index + 1;
        const path = [...listPath, index];
        const context = t("form.groups.context", { number });
        const name = t("form.groups.name", { number });
        const id = textOf(group.id);
        const nodes = itemsOf(raw, "nodes").filter((node) => node.group === id).length;
        return (
          <ItemGroup
            key={index}
            path={path}
            title={t("form.groups.item", { number, id })}
            actions={
              <ItemActions
                listPath={listPath}
                index={index}
                count={groups.length}
                name={name}
                canMove={false}
                remove={{
                  commands: removeGroupCommands(raw, index),
                  description: t("form.groups.removeBody", { count: nodes }),
                  announce: t("form.removed", { item: name }),
                }}
              />
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField path={[...path, "id"]} label={t("form.diagram.id")} context={context} />
              <TextField
                path={[...path, "label"]}
                label={t("form.diagram.label")}
                context={context}
              />
              <SelectField
                path={[...path, "kind"]}
                label={t("form.groups.kind")}
                context={context}
                options={GROUP_KINDS.map((kind) => ({ value: kind, label: kind }))}
              />
              <SelectField
                path={[...path, "parent"]}
                label={t("form.groups.parent")}
                context={context}
                none={{ label: t("form.groups.noParent"), value: null }}
                options={ids
                  .filter((other, at) => at !== index && other !== "")
                  .map((other) => ({ value: other, label: other }))}
              />
            </div>
            <Box path={[...path, "rect"]} context={context} size />
          </ItemGroup>
        );
      })}
      <AddButton
        listPath={listPath}
        value={newGroup(raw)}
        label={
          <>
            <PlusIcon aria-hidden />
            {t("form.groups.add")}
          </>
        }
        announce={t("form.added", { item: t("form.groups.name", { number: groups.length + 1 }) })}
        focus={fieldId([...listPath, groups.length, "id"])}
      />
    </ListSection>
  );
}

export function NodesFields({ services }: { services: readonly Service[] }) {
  const { t } = useTranslation();
  const { raw } = useForm();
  const nodes = itemsOf(raw, "nodes");
  const groups: Option[] = itemsOf(raw, "groups")
    .map((group) => textOf(group.id))
    .filter((id) => id !== "")
    .map((id) => ({ value: id, label: id }));
  const listPath: EditPath = ["diagram", "nodes"];
  return (
    <ListSection path={listPath} title={t("form.nodes.list")} level={4}>
      {nodes.map((node, index) => {
        const number = index + 1;
        const path = [...listPath, index];
        const context = t("form.nodes.context", { number });
        const name = t("form.nodes.name", { number });
        const type = textOf(node.type);
        const edges = edgesOfNode(raw, index).length;
        return (
          <ItemGroup
            key={index}
            path={path}
            title={t("form.nodes.item", { number, id: textOf(node.id), type })}
            actions={
              <ItemActions
                listPath={listPath}
                index={index}
                count={nodes.length}
                name={name}
                canMove={false}
                remove={{
                  commands: removeNodeCommands(raw, index),
                  description: t("form.nodes.removeBody", { count: edges }),
                  announce: t("form.nodes.removed", { item: name, count: edges }),
                  focus: fieldId(listPath),
                }}
              />
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField path={[...path, "id"]} label={t("form.diagram.id")} context={context} />
              <TextField
                path={[...path, "type"]}
                label={t("form.nodes.type")}
                context={context}
                hint={t("form.nodes.typeHint")}
                locked
              />
              {(type === "actor" || type === "external") && (
                <>
                  <TextField
                    path={[...path, "label"]}
                    label={t("form.diagram.label")}
                    context={context}
                  />
                  <SelectField
                    path={[...path, "icon"]}
                    label={t("form.nodes.icon")}
                    context={context}
                    options={ACTOR_ICONS.map((icon) => ({ value: icon, label: icon }))}
                  />
                </>
              )}
              {type === "fixed" && (
                <ServicePicker
                  path={[...path, "service"]}
                  label={t("form.nodes.service")}
                  context={context}
                  services={services}
                />
              )}
              <SelectField
                path={[...path, "group"]}
                label={t("form.nodes.group")}
                context={context}
                none={{ label: t("form.nodes.noGroup"), value: undefined }}
                options={groups}
              />
            </div>
            {type === "slot" && (
              <p className="text-sm text-muted-foreground">{t("form.nodes.slotHint")}</p>
            )}
            <Box path={[...path, "position"]} context={context} size={false} />
          </ItemGroup>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {NODE_TYPES.map((type) => (
          <AddButton
            key={type}
            id={`${fieldId(listPath)}-add-${type}`}
            listPath={listPath}
            value={newNode(raw, type)}
            label={
              <>
                <PlusIcon aria-hidden />
                {t(`form.nodes.add.${type}`)}
              </>
            }
            announce={t("form.added", {
              item: t("form.nodes.name", { number: nodes.length + 1 }),
            })}
            focus={fieldId([...listPath, nodes.length, "id"])}
          />
        ))}
      </div>
    </ListSection>
  );
}

function StepButtons({
  index,
  name,
  context,
}: {
  index: number;
  name: string;
  /** "de la arista 2", for the names of the buttons. */
  context: string;
}) {
  const { t } = useTranslation();
  const { raw, readOnly, edit } = useForm();
  const steps = itemsOf(raw, "edges").map((edge) => Number(edge.step) || 0);
  const base = fieldId(["diagram", "edges", index]);
  const move = (direction: StepDirection) => {
    const { commands, step, parallel } = stepCommands(raw, index, direction);
    const button = direction === -1 ? "up" : "down";
    const other = direction === -1 ? "down" : "up";
    // The focus stays on the button, unless it can no longer move the edge that way.
    const stillPossible = canMoveStep(moveStep(steps, index, direction), index, direction);
    edit(commands, {
      isolate: true,
      announce:
        parallel.length === 0
          ? t("form.edges.stepMoved", { item: name, step })
          : t("form.edges.stepMovedParallel", { item: name, step, edges: parallel.join(", ") }),
      focus: `${base}-step-${stillPossible ? button : other}`,
    });
  };
  return (
    <>
      <Button
        id={`${base}-step-up`}
        type="button"
        variant="outline"
        size="sm"
        disabled={readOnly || !canMoveStep(steps, index, -1)}
        onClick={() => move(-1)}
      >
        <ChevronsUpIcon aria-hidden />
        {t("form.edges.stepUp")} <span className="sr-only">{context}</span>
      </Button>
      <Button
        id={`${base}-step-down`}
        type="button"
        variant="outline"
        size="sm"
        disabled={readOnly || !canMoveStep(steps, index, 1)}
        onClick={() => move(1)}
      >
        <ChevronsDownIcon aria-hidden />
        {t("form.edges.stepDown")} <span className="sr-only">{context}</span>
      </Button>
    </>
  );
}

export function EdgesFields() {
  const { t } = useTranslation();
  const { raw } = useForm();
  const edges = itemsOf(raw, "edges");
  const nodes: Option[] = itemsOf(raw, "nodes")
    .map((node) => textOf(node.id))
    .filter((id) => id !== "")
    .map((id) => ({ value: id, label: id }));
  const listPath: EditPath = ["diagram", "edges"];
  return (
    <ListSection path={listPath} title={t("form.edges.list")} level={4}>
      <p className="text-sm text-muted-foreground">{t("form.edges.lead")}</p>
      {edges.map((edge, index) => {
        const number = index + 1;
        const path = [...listPath, index];
        const context = t("form.edges.context", { number });
        const name = t("form.edges.name", { number });
        return (
          <ItemGroup
            key={index}
            path={path}
            title={t("form.edges.item", {
              number,
              from: textOf(edge.from) || "?",
              to: textOf(edge.to) || "?",
              step: textOf(edge.step) || "?",
            })}
            actions={
              <ItemActions
                listPath={listPath}
                index={index}
                count={edges.length}
                name={name}
                canMove={false}
              >
                <StepButtons index={index} name={name} context={context} />
              </ItemActions>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                path={[...path, "from"]}
                label={t("form.edges.from")}
                context={context}
                options={nodes}
              />
              <SelectField
                path={[...path, "to"]}
                label={t("form.edges.to")}
                context={context}
                options={nodes}
              />
              <NumberField
                path={[...path, "step"]}
                label={t("form.edges.step")}
                context={context}
              />
              <SelectField
                path={[...path, "style"]}
                label={t("form.edges.style")}
                context={context}
                options={EDGE_STYLES.map((style) => ({
                  value: style,
                  label: t(`form.edges.styles.${style}`),
                }))}
              />
              <TextField path={[...path, "id"]} label={t("form.diagram.id")} context={context} />
              <TextField
                path={[...path, "label"]}
                label={t("form.diagram.label")}
                context={context}
              />
            </div>
            <TextField
              path={[...path, "description"]}
              label={t("form.edges.description")}
              context={context}
              hint={t("form.edges.descriptionHint")}
              multiline
              optional
            />
          </ItemGroup>
        );
      })}
      <AddButton
        listPath={listPath}
        value={newEdge(raw, nodes[0]?.value ?? "", nodes[1]?.value ?? nodes[0]?.value ?? "")}
        label={
          <>
            <PlusIcon aria-hidden />
            {t("form.edges.add")}
          </>
        }
        announce={t("form.added", { item: t("form.edges.name", { number: edges.length + 1 }) })}
        focus={fieldId([...listPath, edges.length, "from"])}
      />
    </ListSection>
  );
}
