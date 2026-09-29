// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Service palette (RF-PAL-01, RF-PAL-02, RF-PAL-04): the services `buildPalette` picked for the
// scenario, grouped by category, collapsible, with a search box. Every item is a button (slot
// first / service first adapters) and a @dnd-kit draggable (drag adapter).
// Lovable: .service-palette, .palette-group, .palette-service (src/styles.css).
import type { Category, Service } from "@blueprint/scenario-schema";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { cn } from "@blueprint/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { useServiceDraggable } from "../../interaction/drag";
import { serviceIconSrc } from "../../service-icons";
import { groupPalette } from "./palette-groups";

export interface PaletteProps {
  serviceIds: readonly string[];
  catalog: ReadonlyMap<string, Service>;
  categories: readonly Pick<Category, "id" | "name">[];
  /** Services placed in some slot: marked, still usable (RF-PAL-04). */
  placed: ReadonlySet<string>;
  /** Service picked while no slot is selected (service first). */
  pendingServiceId: string | null;
  /** A slot is waiting for a service (slot first): the heading says so. */
  targetRole: string | null;
  onChoose: (serviceId: string) => void;
  searchRef?: Ref<HTMLInputElement>;
}

export function Palette({
  serviceIds,
  catalog,
  categories,
  placed,
  pendingServiceId,
  targetRole,
  onChoose,
  searchRef,
}: PaletteProps) {
  const { t } = useTranslation();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const groups = useMemo(
    () => groupPalette(serviceIds, catalog, categories, query),
    [serviceIds, catalog, categories, query],
  );
  const searching = query.trim() !== "";

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const first = groups[0]?.services[0];
    if (event.key === "Enter" && searching && first !== undefined) {
      event.preventDefault();
      onChoose(first.id);
      // The search did its job: the next choice starts from the whole palette.
      setQuery("");
    } else if (event.key === "Escape" && query !== "") {
      // First Esc clears the search; the next one reaches the screen and cancels the selection.
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    } else if (event.key === "ArrowDown") {
      const button = event.currentTarget
        .closest("[data-palette]")
        ?.querySelector<HTMLButtonElement>("[data-palette-service]");
      if (button) {
        event.preventDefault();
        button.focus();
      }
    }
  };

  return (
    <aside
      data-palette
      aria-label={t("play.palette.label")}
      className="flex min-h-0 flex-col border-l bg-background"
    >
      <div className="flex-none border-b p-3">
        <h2 className="text-[0.8rem] font-bold">{t("play.palette.title")}</h2>
        <p className="mt-1 min-h-[1.1rem] text-[0.7rem] text-muted-foreground">
          {targetRole !== null
            ? t("play.palette.forSlot", { role: targetRole })
            : pendingServiceId !== null
              ? t("play.palette.pending", {
                  service: catalog.get(pendingServiceId)?.name ?? pendingServiceId,
                })
              : t("play.palette.help")}
        </p>
        <label htmlFor={searchId} className="sr-only">
          {t("play.palette.search")}
        </label>
        <div className="relative mt-2">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKey}
            placeholder={t("play.palette.searchPlaceholder")}
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-card pr-2 pl-8 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {groups.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("play.palette.noResults")}
          </p>
        )}
        {groups.map(({ category, services }) => {
          const open = searching || !collapsed.has(category.id);
          const listId = `${searchId}-${category.id}`;
          return (
            <section key={category.id} className="border-b py-2 last:border-b-0">
              <h3>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (!next.delete(category.id)) next.add(category.id);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-[0.78rem] font-semibold hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <ChevronDownIcon
                    aria-hidden
                    className={cn("size-4 transition-transform", !open && "-rotate-90")}
                  />
                  <span className="flex-1">{category.name}</span>
                  <span className="text-muted-foreground">{services.length}</span>
                </button>
              </h3>
              <ul id={listId} hidden={!open} className="mt-1 flex flex-col gap-[0.4rem]">
                {services.map((service) => (
                  <li key={service.id}>
                    <PaletteItem
                      service={service}
                      pending={pendingServiceId === service.id}
                      placed={placed.has(service.id)}
                      onChoose={onChoose}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function PaletteItem({
  service,
  pending,
  placed,
  onChoose,
}: {
  service: Service;
  pending: boolean;
  placed: boolean;
  onChoose: (serviceId: string) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, listeners, isDragging } = useServiceDraggable(service.id);
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-palette-service={service.id}
      aria-pressed={pending}
      onClick={() => onChoose(service.id)}
      {...listeners}
      className={cn(
        "flex w-full cursor-grab items-center gap-[0.6rem] rounded-md border bg-card p-[0.45rem] text-left text-[0.75rem] font-semibold shadow-xs hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing",
        pending && "border-primary bg-blueprint-soft ring-2 ring-primary",
        isDragging && "opacity-50",
      )}
    >
      <ServiceIcon
        src={serviceIconSrc(service.id)}
        name={service.name}
        category={service.category}
        decorative
      />
      <span className="min-w-0 flex-1 truncate">{service.name}</span>
      {placed && (
        <span className="flex items-center gap-1 text-[0.65rem] font-normal text-muted-foreground">
          <CheckIcon aria-hidden className="size-3.5" />
          {t("play.palette.placed")}
        </span>
      )}
    </button>
  );
}
