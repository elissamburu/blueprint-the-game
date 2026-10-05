// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Conectar con…": the way to draw an edge without dragging (WCAG 2.5.7). The origin is the
// selected node; the destination is chosen from a list of the other nodes, filtered by what is
// typed (name or id, without caring for accents or case). The new edge goes last in the flow.
import { Button } from "@blueprint/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@blueprint/ui/components/dialog";
import { Input } from "@blueprint/ui/components/input";
import { Label } from "@blueprint/ui/components/label";
import { useId, useMemo, useState } from "react";

export interface ConnectTarget {
  id: string;
  /** "Servicio fijo", "Casillero 2"… */
  typeName: string;
  title: string;
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function ConnectDialog({
  source,
  targets,
  nextStep,
  onConnect,
  onClose,
}: {
  /** Name of the origin, for the title. */
  source: string;
  targets: readonly ConnectTarget[];
  /** Step the new edge gets. */
  nextStep: number;
  onConnect: (targetId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<string | undefined>(targets[0]?.id);
  const ids = { search: useId(), list: useId(), name: useId() };
  const shown = useMemo(() => {
    const wanted = fold(query.trim());
    return wanted === ""
      ? targets
      : targets.filter((target) =>
          fold(`${target.title} ${target.typeName} ${target.id}`).includes(wanted),
        );
  }, [query, targets]);
  // The choice is always one of the options shown.
  const chosen = shown.some((target) => target.id === choice) ? choice : shown[0]?.id;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar «{source}» con…</DialogTitle>
          <DialogDescription>
            Elegí el destino. La arista nueva va al final del flujo (paso {nextStep}).
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (chosen !== undefined) onConnect(chosen);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.search}>Buscar</Label>
            <Input
              id={ids.search}
              type="search"
              value={query}
              autoComplete="off"
              aria-controls={ids.list}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <fieldset className="flex min-w-0 flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Destino</legend>
            {shown.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">
                Ningún nodo coincide con la búsqueda.
              </p>
            ) : (
              <ul id={ids.list} className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
                {shown.map((target) => (
                  <li key={target.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                      <input
                        type="radio"
                        name={ids.name}
                        value={target.id}
                        checked={chosen === target.id}
                        onChange={() => setChoice(target.id)}
                        className="size-4 accent-primary"
                      />
                      <span className="min-w-0">
                        {target.title}{" "}
                        <span className="text-sm text-muted-foreground">
                          ({target.typeName} · {target.id})
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={chosen === undefined}>
              Conectar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
