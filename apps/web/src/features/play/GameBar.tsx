// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The single bar of the game screen (layout v2; it replaces the global header): back, level and
// title, progress, score, "Ver caso", "Modo foco", "Finalizar" and the "⋯" menu with "Reproducir
// flujo" and "Reportar un problema" (RF-PLAY-03, RF-PLAY-13). In focus mode, a minimal floating
// bar: progress, "Ver caso", "Finalizar" and "Salir del foco". On narrow screens (or a large
// browser zoom) the bar wraps and "Ver caso" and "Modo foco" keep only their icon, with the same
// accessible name: every action stays visible.
// Lovable: .game-topbar, .scenario-title, .game-progress, .score-box, .focus-bar (src/styles.css),
// capturas 13 y 15.
import type { Scenario } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@blueprint/ui/components/dropdown-menu";
import { LevelBadge } from "@blueprint/ui/components/level-badge";
import { Progress } from "@blueprint/ui/components/progress";
import {
  ArrowLeftIcon,
  EllipsisIcon,
  EyeIcon,
  FlagIcon,
  FocusIcon,
  Minimize2Icon,
  PlayIcon,
  StarIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@blueprint/ui/components/tooltip";
import { useId, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatNumber } from "../../i18n/format";

export interface GameProgress {
  resolved: number;
  total: number;
  score: number;
  completed: boolean;
}

interface Actions {
  caseOpen: boolean;
  onViewCase: () => void;
  finishing: boolean;
  onFinish: () => void;
}

export interface GameBarProps extends Actions {
  scenario: Scenario;
  progress: GameProgress;
  onFocusMode: () => void;
  onPlayFlow: () => void;
  reportUrl: string;
  focusModeRef?: Ref<HTMLButtonElement>;
}

const percent = ({ resolved, total }: GameProgress) =>
  total === 0 ? 100 : (resolved / total) * 100;

export function GameBar({
  scenario,
  progress,
  caseOpen,
  onViewCase,
  onFocusMode,
  finishing,
  onFinish,
  onPlayFlow,
  reportUrl,
  focusModeRef,
}: GameBarProps) {
  const { t } = useTranslation();
  return (
    <header className="relative z-20 flex min-h-16 flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-3 py-2">
      <Button asChild variant="ghost" size="icon">
        <Link to="/escenarios" aria-label={t("play.back")}>
          <ArrowLeftIcon aria-hidden />
        </Link>
      </Button>
      <div className="flex min-w-[min(16rem,100%)] flex-1 items-center gap-3">
        <LevelBadge level={scenario.level} variant="solid" className="shrink-0 text-sm" />
        <h1 className="text-base leading-snug font-bold">{scenario.title}</h1>
      </div>
      <SlotsProgress progress={progress} barClassName="hidden w-[8.25rem] xl:block" />
      <p className="flex items-center gap-2">
        <StarIcon aria-hidden className="size-5 text-warning" />
        <span className="flex flex-col leading-tight">
          <span className="text-sm text-muted-foreground">{t("play.top.score")}</span>
          <strong className="text-lg text-warning tabular-nums">
            {formatNumber(progress.score)}
          </strong>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <ViewCaseButton open={caseOpen} onClick={onViewCase} />
        <Button
          ref={focusModeRef}
          variant="outline"
          onClick={onFocusMode}
          title={t("play.top.focusMode")}
        >
          <FocusIcon aria-hidden />
          <span className="sr-only lg:not-sr-only">{t("play.top.focusMode")}</span>
        </Button>
        <FinishButton progress={progress} finishing={finishing} onFinish={onFinish} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("play.top.more")}>
              <EllipsisIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onPlayFlow}>
              <PlayIcon aria-hidden />
              {t("play.top.playFlow")}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={reportUrl} target="_blank" rel="noreferrer">
                <FlagIcon aria-hidden />
                {t("play.top.report")}
                <span className="sr-only">{t("about.external")}</span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export interface FocusBarProps extends Actions {
  title: string;
  progress: GameProgress;
  onExit: () => void;
  exitRef?: Ref<HTMLButtonElement>;
}

/** Minimal bar of focus mode, floating over the top of the board (captura 15, without the X). */
export function FocusBar({
  title,
  progress,
  caseOpen,
  onViewCase,
  finishing,
  onFinish,
  onExit,
  exitRef,
}: FocusBarProps) {
  const { t } = useTranslation();
  return (
    <div
      data-slot="focus-bar"
      className="absolute top-3 left-1/2 z-30 flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-lg border bg-card py-[0.45rem] pr-[0.55rem] pl-[0.9rem] shadow-[0_10px_32px_color-mix(in_oklab,var(--foreground)_16%,transparent)]"
    >
      {/* The bar with the title is gone: the page keeps its heading for screen readers. */}
      <h1 className="sr-only">{title}</h1>
      <SlotsProgress progress={progress} strong barClassName="hidden w-[6.25rem] md:block" />
      <ViewCaseButton open={caseOpen} onClick={onViewCase} size="sm" />
      <FinishButton progress={progress} finishing={finishing} onFinish={onFinish} size="sm" />
      <Button ref={exitRef} variant="outline" size="sm" className="text-sm" onClick={onExit}>
        <Minimize2Icon aria-hidden />
        {t("play.top.exitFocus")}
      </Button>
    </div>
  );
}

function SlotsProgress({
  progress,
  strong = false,
  barClassName,
}: {
  progress: GameProgress;
  strong?: boolean;
  barClassName: string;
}) {
  const { t } = useTranslation();
  const text = t("play.top.slots", { resolved: progress.resolved, total: progress.total });
  return (
    <div className="flex items-center gap-3 text-sm">
      {strong ? (
        <strong className="whitespace-nowrap">{text}</strong>
      ) : (
        <span className="whitespace-nowrap text-muted-foreground">{text}</span>
      )}
      <Progress
        value={percent(progress)}
        aria-label={t("play.top.progress")}
        className={barClassName}
      />
    </div>
  );
}

function ViewCaseButton({
  open,
  onClick,
  size,
}: {
  open: boolean;
  onClick: () => void;
  size?: "sm";
}) {
  const { t } = useTranslation();
  return (
    <Button
      variant="outline"
      size={size}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={t("play.top.viewCase")}
      onClick={onClick}
      className="text-sm"
    >
      <EyeIcon aria-hidden />
      <span className={size === "sm" ? undefined : "sr-only lg:not-sr-only"}>
        {t("play.top.viewCase")}
      </span>
    </Button>
  );
}

/**
 * "Finalizar". While slots are missing it is aria-disabled instead of disabled: it stays in the
 * tab order and its description says how many are left, for keyboard and screen reader users
 * too; the tooltip shows the same text on hover and focus.
 */
function FinishButton({
  progress,
  finishing,
  onFinish,
  size,
}: {
  progress: GameProgress;
  finishing: boolean;
  onFinish: () => void;
  size?: "sm";
}) {
  const { t } = useTranslation();
  const id = useId();
  const missing = progress.total - progress.resolved;
  const blocked = !progress.completed || finishing;
  const reason = progress.completed ? null : t("play.top.finishMissing", { count: missing });
  const [tooltipOpen, setTooltipOpen] = useState(false);
  // The tooltip stays mounted so the button keeps its element (and the focus) when it enables.
  return (
    <>
      <TooltipProvider>
        <Tooltip open={reason !== null && tooltipOpen} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <Button
              size={size}
              className="text-sm aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              aria-disabled={blocked}
              aria-describedby={reason === null ? undefined : `${id}-reason`}
              onClick={() => {
                if (!blocked) onFinish();
              }}
            >
              {t("play.top.finish")}
            </Button>
          </TooltipTrigger>
          <TooltipContent aria-hidden="true" className="text-sm">
            {reason}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {reason !== null && (
        <span id={`${id}-reason`} className="sr-only">
          {reason}
        </span>
      )}
    </>
  );
}
