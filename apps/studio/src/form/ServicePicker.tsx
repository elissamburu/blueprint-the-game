// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Service of an answer or of an incorrect: always one of the catalog, never free text (L002).
// A button opens a popover with a search box and the list of services (the combobox + listbox
// pattern of the APG): the arrows move through the options, Enter chooses, Esc closes and the
// focus goes back to the button. No cmdk: Popover of packages/ui and a few lines of keyboard.
import { Button } from "@blueprint/ui/components/button";
import { Input } from "@blueprint/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@blueprint/ui/components/popover";
import { cn } from "@blueprint/ui/lib/utils";
import type { Service } from "@blueprint/scenario-schema";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { EditPath } from "./document-edit";
import { FieldLabel, useIssues, type LabelText } from "./fields";
import { textOf, valueAt } from "./form-data";
import { useForm } from "./form-context";

const fold = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Services whose id, name, full name or aliases contain every word of the query. */
export const filterServices = (services: readonly Service[], query: string): readonly Service[] => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return services;
  return services.filter((service) => {
    const haystack = fold(
      [service.id, service.name, service.fullName ?? "", ...service.aliases].join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
};

export function ServicePicker({
  path,
  label,
  context,
  services,
}: LabelText & { path: EditPath; services: readonly Service[] }) {
  const { t } = useTranslation();
  const { raw, readOnly, edit, fieldId } = useForm();
  const issues = useIssues(path);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = fieldId(path);
  const labelId = useId();
  const listId = useId();
  const value = textOf(valueAt(raw, path));
  const current = services.find((service) => service.id === value);
  const options = filterServices(services, query);
  const optionId = (index: number) => `${listId}-${index}`;

  const choose = (service: Service) => {
    setOpen(false);
    if (service.id !== value) edit([{ op: "set", path, value: service.id }], { isolate: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
      PageDown: Math.min(active + 10, last),
      PageUp: Math.max(active - 10, 0),
    };
    const next = moves[event.key];
    if (next !== undefined && options.length > 0) {
      event.preventDefault();
      setActive(next);
      document.getElementById(optionId(next))?.scrollIntoView?.({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const service = options[active];
      if (service !== undefined) choose(service);
    }
  };

  const shown =
    current !== undefined
      ? `${current.name} (${current.id})`
      : value === ""
        ? t("form.service.none")
        : t("form.service.unknown", { id: value });

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel id={labelId} label={label} {...(context === undefined ? {} : { context })} />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setQuery("");
            setActive(current === undefined ? 0 : services.indexOf(current));
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={readOnly}
            aria-labelledby={`${labelId} ${id}`}
            {...(issues.invalid ? { "aria-invalid": true } : {})}
            {...(issues.describedBy === undefined
              ? {}
              : { "aria-describedby": issues.describedBy })}
            className="w-full justify-between font-normal aria-invalid:border-destructive"
          >
            <span className="truncate">{shown}</span>
            <ChevronsUpDownIcon aria-hidden className="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-96 max-w-[90vw] flex-col gap-2 p-2">
          <Input
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={t("form.service.search")}
            {...(options[active] === undefined
              ? {}
              : { "aria-activedescendant": optionId(active) })}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <ul
            id={listId}
            role="listbox"
            aria-label={t("form.service.list")}
            className="max-h-72 overflow-y-auto"
          >
            {options.map((service, index) => (
              <li
                key={service.id}
                id={optionId(index)}
                role="option"
                aria-selected={service.id === value}
                onClick={() => choose(service)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  index === active && "bg-accent text-accent-foreground outline-2 outline-ring",
                )}
              >
                <CheckIcon
                  aria-hidden
                  className={cn("size-4 shrink-0", service.id !== value && "invisible")}
                />
                <span className="min-w-0 flex-1">
                  {service.name}{" "}
                  <span className="font-mono text-muted-foreground">{service.id}</span>
                  {service.status === "deprecated" && (
                    <span className="text-warning"> {t("form.service.deprecated")}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {options.length === 0 && (
            <p role="status" className="px-2 py-1.5 text-sm text-muted-foreground">
              {t("form.service.noResults")}
            </p>
          )}
        </PopoverContent>
      </Popover>
      {issues.messages}
    </div>
  );
}
