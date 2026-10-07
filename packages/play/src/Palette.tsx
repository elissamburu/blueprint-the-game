// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Service palette (RF-PAL-01, RF-PAL-02, RF-PAL-04): the services `buildPalette` picked for the
// scenario, grouped by category, collapsible, with a search box. Every item is a button (slot
// first / service first adapters) and a @dnd-kit draggable (drag adapter). The whole palette
// collapses to a column of icons, each one with its name as a tooltip and accessible name
// (layout v2); the app remembers that as a preference of the browser, not as progress. At level 0
// each card shows the plain name on top of the real name, is named with both and is found by both
// (RF-PAL-06, catalog-entry.ts); at any other level it shows the name, as always.
// Lovable: ServicePalette, .palette-panel, .palette-heading, .collapsed-services, .service-group,
// .service-card (src/components/blueprint-app.tsx, styles.css), capturas 13 y 16.
import type { Category, Service } from "@blueprint/scenario-schema";
import { Badge } from "@blueprint/ui/components/badge";
import { Button } from "@blueprint/ui/components/button";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { ServiceName } from "@blueprint/ui/components/service-name";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@blueprint/ui/components/tooltip";
import { cn } from "@blueprint/ui/lib/utils";
import {
  CheckIcon,
  ChevronDownIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  SearchIcon,
} from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { cardAccessibleName, cardPlainName, entryIcon } from "./catalog-entry";
import { useServiceDraggable } from "./interaction/drag";
import { groupPalette } from "./palette-groups";
import { Kicker } from "./Kicker";

export interface PaletteProps {
  serviceIds: readonly string[];
  catalog: ReadonlyMap<string, Service>;
  /** URL of a service icon (GameHost.iconSrc). */
  iconSrc: (serviceId: string) => string | undefined;
  categories: readonly Pick<Category, "id" | "name">[];
  /** Services placed in some slot: marked, still usable (RF-PAL-04). */
  placed: ReadonlySet<string>;
  /** Service picked while no slot is selected (service first). */
  pendingServiceId: string | null;
  /** A slot is waiting for a service (slot first): the heading says so. */
  targetRole: string | null;
  onChoose: (serviceId: string) => void;
  /** Collapsed to a column of icons. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  searchRef?: Ref<HTMLInputElement>;
  /** Level 0: cards show the plain name first and the search looks it up too (RF-PAL-06). */
  plainNames?: boolean;
}

export function Palette({
  serviceIds,
  catalog,
  iconSrc,
  categories,
  placed,
  pendingServiceId,
  targetRole,
  onChoose,
  collapsed,
  onCollapsedChange,
  searchRef,
  plainNames = false,
}: PaletteProps) {
  const { t } = useTranslation("play");
  const baseId = useId();
  const contentId = `${baseId}-content`;
  const [query, setQuery] = useState("");
  const [closedGroups, setClosedGroups] = useState<ReadonlySet<string>>(new Set());
  const groups = useMemo(
    () => groupPalette(serviceIds, catalog, categories, query, plainNames),
    [serviceIds, catalog, categories, query, plainNames],
  );
  const allGroups = useMemo(
    () => groupPalette(serviceIds, catalog, categories, ""),
    [serviceIds, catalog, categories],
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

  // Level 0 with concepts: the cards are not all services (ADR-0027 §6).
  const cards = plainNames && serviceIds.some((id) => catalog.get(id)?.type === "concept");
  const help =
    targetRole !== null
      ? t("palette.forSlot", { role: targetRole })
      : pendingServiceId !== null
        ? t("palette.pending", {
            service: pendingName(catalog.get(pendingServiceId), pendingServiceId, plainNames),
          })
        : t(cards ? "palette.helpCards" : "palette.help");

  const toggle = (
    <Button
      variant="ghost"
      size="icon"
      aria-expanded={!collapsed}
      aria-controls={contentId}
      aria-label={collapsed ? t("palette.expand") : t("palette.collapse")}
      title={collapsed ? t("palette.expand") : t("palette.collapse")}
      onClick={() => onCollapsedChange(!collapsed)}
    >
      {collapsed ? <PanelRightOpenIcon aria-hidden /> : <PanelRightCloseIcon aria-hidden />}
    </Button>
  );

  return (
    <aside
      data-palette
      data-collapsed={collapsed ? "" : undefined}
      aria-label={t("palette.label")}
      className={cn(
        "relative z-10 flex min-h-0 flex-col border-l bg-background transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-[4.125rem]" : "w-[17.875rem]",
      )}
    >
      {collapsed ? (
        <>
          <div className="flex flex-none justify-center border-b p-3">{toggle}</div>
          <TooltipProvider delayDuration={100}>
            <ul
              id={contentId}
              className="flex min-h-0 flex-1 flex-col items-center gap-[0.55rem] overflow-y-auto py-3"
            >
              {allGroups.flatMap(({ services }) =>
                services.map((service) => (
                  <li key={service.id}>
                    <CollapsedItem
                      service={service}
                      pending={pendingServiceId === service.id}
                      placed={placed.has(service.id)}
                      iconSrc={iconSrc}
                      onChoose={onChoose}
                      plainNames={plainNames}
                    />
                  </li>
                )),
              )}
            </ul>
          </TooltipProvider>
        </>
      ) : (
        <>
          <div className="flex-none border-b p-4">
            <div className="flex items-start gap-[0.35rem]">
              <div className="min-w-0">
                <Kicker>{t("palette.kicker")}</Kicker>
                {/* «Servicios y conceptos» takes two lines: the count follows the text, inline,
                    instead of standing apart at the right edge. */}
                <h2 className={cn("mt-1 text-xl", !cards && "flex items-center gap-2")}>
                  {t(cards ? "palette.titleCards" : "palette.title")}
                  <Badge
                    variant="secondary"
                    className={cn("text-sm", cards && "ml-2 align-text-bottom")}
                  >
                    {serviceIds.length}
                  </Badge>
                </h2>
              </div>
              <span className="ml-auto">{toggle}</span>
            </div>
            <label htmlFor={`${baseId}-search`} className="sr-only">
              {t("palette.search")}
            </label>
            <div className="relative mt-3">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={searchRef}
                id={`${baseId}-search`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKey}
                placeholder={t("palette.searchPlaceholder")}
                autoComplete="off"
                className="min-h-10 w-full rounded-md border bg-card pr-2 pl-9 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{help}</p>
          </div>
          <div id={contentId} className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {groups.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("palette.noResults")}
              </p>
            )}
            {groups.map(({ category, services }) => {
              const open = searching || !closedGroups.has(category.id);
              const listId = `${baseId}-${category.id}`;
              return (
                <section key={category.id} className="border-b py-2 last:border-b-0">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={listId}
                      onClick={() =>
                        setClosedGroups((current) => {
                          const next = new Set(current);
                          if (!next.delete(category.id)) next.add(category.id);
                          return next;
                        })
                      }
                      className="flex w-full items-center gap-2 rounded-md px-1 py-[0.35rem] text-left text-sm font-semibold hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
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
                          iconSrc={iconSrc}
                          onChoose={onChoose}
                          plainNames={plainNames}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}

function PaletteItem({
  service,
  pending,
  placed,
  iconSrc,
  onChoose,
  plainNames,
}: {
  service: Service;
  pending: boolean;
  placed: boolean;
  iconSrc: (serviceId: string) => string | undefined;
  onChoose: (serviceId: string) => void;
  plainNames: boolean;
}) {
  const { t } = useTranslation("play");
  const { setNodeRef, listeners, isDragging } = useServiceDraggable(service.id);
  const plainName = cardPlainName(service, plainNames);
  const placedMark = placed && (
    <span className="ml-auto flex shrink-0 items-center gap-1 text-sm font-normal text-muted-foreground">
      <CheckIcon aria-hidden className="size-4" />
      {t("palette.placed")}
    </span>
  );
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-palette-service={service.id}
      aria-pressed={pending}
      onClick={() => onChoose(service.id)}
      {...listeners}
      className={cn(
        "flex w-full cursor-grab items-center gap-[0.6rem] rounded-md border bg-card p-[0.45rem] text-left text-sm font-semibold shadow-xs hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing",
        pending && "border-primary bg-blueprint-soft ring-2 ring-primary",
        isDragging && "opacity-50",
      )}
    >
      <ServiceIcon
        {...entryIcon(service, iconSrc)}
        name={service.name}
        category={service.category}
        decorative
      />
      {plainName === undefined ? (
        <>
          <span className="min-w-0 flex-1 break-words">{service.name}</span>
          {placedMark}
        </>
      ) : (
        // Two names: the mark goes on the line of the real name, so the plain name keeps the whole
        // width. It is the same mark, read after both names as before.
        <ServiceName
          plainName={plainName}
          name={service.name}
          nameClassName="text-xs"
          className="flex-1"
          aside={placedMark}
        />
      )}
    </button>
  );
}

/** An icon of the collapsed palette: same button and draggable, the name in a tooltip. */
function CollapsedItem({
  service,
  pending,
  placed,
  iconSrc,
  onChoose,
  plainNames,
}: {
  service: Service;
  pending: boolean;
  placed: boolean;
  iconSrc: (serviceId: string) => string | undefined;
  onChoose: (serviceId: string) => void;
  plainNames: boolean;
}) {
  const { t } = useTranslation("play");
  const { setNodeRef, listeners, isDragging } = useServiceDraggable(service.id);
  // The tooltip and the accessible name are the same text (RF-PAL-06).
  const accessibleName = cardAccessibleName(service, plainNames);
  const name = placed ? t("palette.placedName", { service: accessibleName }) : accessibleName;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          type="button"
          data-palette-service={service.id}
          aria-pressed={pending}
          aria-label={name}
          onClick={() => onChoose(service.id)}
          {...listeners}
          className={cn(
            "relative grid size-11 cursor-grab place-items-center rounded-[7px] border border-transparent hover:border-primary hover:bg-blueprint-soft focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing",
            pending && "border-primary bg-blueprint-soft ring-2 ring-primary",
            isDragging && "opacity-50",
          )}
        >
          <ServiceIcon
            {...entryIcon(service, iconSrc)}
            name={service.name}
            category={service.category}
            decorative
            className="size-8"
          />
          {placed && (
            <CheckIcon
              aria-hidden
              className="absolute -right-1 -bottom-1 size-4 rounded-full border bg-card p-[1px] text-success"
            />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="text-sm">
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

/** Name of the service picked first in the help text: the card's accessible name. */
const pendingName = (service: Service | undefined, id: string, plainNames: boolean) =>
  service === undefined ? id : cardAccessibleName(service, plainNames);
