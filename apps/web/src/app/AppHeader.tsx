// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Top bar (docs/design/pantallas/02): brand, navigation and the player's rank. There is no
// "Nv. N" nor streak: the player has a rank (RF-GAM-01) and "level" is a scenario difficulty.
import { rankForXp } from "@blueprint/game-engine";
import { cn } from "@blueprint/ui/lib/utils";
import { BoxIcon, CloudIcon, MedalIcon, UserIcon, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink } from "react-router";
import { useContentStore } from "../content/content-store";
import { useProgressStore } from "../progress/progress-store";

export function AppHeader() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 grid h-[68px] grid-cols-[1fr_auto] items-center border-b bg-card/95 px-4 backdrop-blur-md md:grid-cols-[1fr_auto_1fr] md:px-[4vw]">
      <Link
        to="/"
        aria-label={t("app.home")}
        className="inline-flex items-center gap-[0.65rem] justify-self-start rounded-md text-[1.05rem] font-extrabold focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="inline-grid size-[34px] place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_5px_16px_color-mix(in_oklab,var(--primary)_24%,transparent)]">
          <BoxIcon aria-hidden className="size-[18px]" />
        </span>
        {t("app.name")}
      </Link>
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center gap-[0.35rem] border-t bg-card p-[0.45rem] md:static md:border-0 md:bg-transparent md:p-0"
      >
        <NavItem to="/escenarios" icon={CloudIcon} label={t("nav.scenarios")} />
        <NavItem to="/perfil" icon={UserIcon} label={t("nav.profile")} />
      </nav>
      <RankPill />
    </header>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          isActive
            ? "border-primary bg-secondary text-foreground"
            : "border-transparent text-foreground hover:bg-muted",
        )
      }
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </NavLink>
  );
}

/** Rank from game-rules.yaml and the player XP; a new player is at the lowest rank. */
function RankPill() {
  const { t } = useTranslation();
  const rules = useContentStore((s) => s.bundle?.rules ?? null);
  const xp = useProgressStore((s) => s.progress?.xp ?? 0);
  if (rules === null) return <span aria-hidden className="hidden md:block" />;
  const rank = rankForXp(xp, rules);
  return (
    <p className="flex items-center gap-[0.45rem] justify-self-end text-[0.82rem] font-bold">
      <MedalIcon aria-hidden className="size-[17px] text-warning" />
      <span className="sr-only">{t("nav.rank")}:</span>
      <span className="rounded-md bg-secondary px-[0.6rem] py-[0.35rem] text-primary">
        {rank.name}
      </span>
    </p>
  );
}
