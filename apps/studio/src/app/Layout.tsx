// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Layout of every page: skip link, header (banner) and the main landmark.
import { WrenchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";

export const MAIN_ID = "contenido";

export function Layout() {
  const { t } = useTranslation();
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <a
        href={`#${MAIN_ID}`}
        className="sr-only z-50 rounded-md bg-card px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("app.skipToContent")}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b bg-card px-4 py-3 md:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md text-base font-extrabold focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="inline-grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <WrenchIcon aria-hidden className="size-4" />
          </span>
          {t("app.name")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("app.localOnly")}</p>
      </header>
      <main id={MAIN_ID} tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        <Outlet />
      </main>
    </div>
  );
}
