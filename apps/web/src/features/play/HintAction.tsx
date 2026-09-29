// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Hints of a slot (RF-PLAY-06): "Ver pista (−N pts)" reveals the first one (useHint) and opens a
// popover with the revealed hints, "Ver otra pista" and "Sin más pistas". The cost comes from
// game-rules.yaml and whether a hint can be revealed from game-engine (canApply).
// Lovable: .hint-popover (src/styles.css), captura docs/design/pantallas/08.
import { Button } from "@blueprint/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@blueprint/ui/components/popover";
import { CircleHelpIcon, LightbulbIcon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

export interface HintActionProps {
  role: string;
  revealed: readonly string[];
  total: number;
  /** Points each hint costs (`scoring.hintCost`). */
  cost: number;
  /** The engine would accept useHint for this slot. */
  canReveal: boolean;
  onReveal: () => void;
}

/**
 * Whether a slot shows the hint control: it has hints and one can be revealed or was already.
 * Otherwise the slot keeps its plain counter (ArchitectureSlot).
 */
export const showsHintAction = (total: number, revealed: number, canReveal: boolean): boolean =>
  total > 0 && (revealed > 0 || canReveal);

export function HintAction({ role, revealed, total, cost, canReveal, onReveal }: HintActionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const remaining = total - revealed.length;

  const label =
    revealed.length === 0
      ? t("play.hints.reveal", { cost })
      : remaining > 0
        ? t("play.hints.show")
        : t("play.hints.none");

  return (
    <span className="mt-auto flex items-center justify-between gap-[4px] pt-[4px] text-[8.8px]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => {
              if (!open && revealed.length === 0) onReveal();
            }}
            className="inline-flex min-w-0 cursor-pointer items-center gap-[4px] rounded-[3px] font-semibold text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <CircleHelpIcon aria-hidden className="size-[12px] shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          aria-labelledby={titleId}
          side="bottom"
          align="start"
          className="w-80 border-warning"
        >
          <h3 id={titleId} className="flex items-center gap-2 text-sm font-bold">
            <LightbulbIcon aria-hidden className="size-4 shrink-0 text-warning" />
            {t("play.hints.title", { role })}
          </h3>
          <ol className="mt-3 flex flex-col gap-2">
            {revealed.map((hint, i) => (
              <li key={i} className="flex gap-2 text-base">
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-warning-soft text-sm font-bold text-warning"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="sr-only">{t("play.hints.number", { number: i + 1 })} </span>
                  {hint}
                </span>
              </li>
            ))}
          </ol>
          {remaining > 0 && canReveal ? (
            <Button size="sm" variant="outline" className="mt-3 text-sm" onClick={onReveal}>
              {t("play.hints.another", { cost })}
            </Button>
          ) : (
            remaining === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">{t("play.hints.none")}</p>
            )
          )}
        </PopoverContent>
      </Popover>
      <span className="shrink-0 text-warning">
        {t("play.hints.counter", { used: revealed.length, total })}
      </span>
    </span>
  );
}
