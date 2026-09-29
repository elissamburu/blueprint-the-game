// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Page scaffolding. Lovable: .page-shell and .page-heading (src/styles.css). Headings keep the
// body weight, as in Lovable.
import type * as React from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-10 pb-24 md:px-8 md:pt-[4.5rem]">{children}</div>
  );
}

export function PageHeading({
  kicker,
  title,
  description,
  aside,
}: {
  kicker: string;
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
      <div>
        <span className="section-kicker">{kicker}</span>
        <h1 className="mt-[0.35rem] text-[2.6rem]">{title}</h1>
        {description !== undefined && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {aside}
    </header>
  );
}

/** Sets the document title of a page: "<page> · Blueprint". */
export function usePageTitle(page: string | null) {
  const { t } = useTranslation();
  const app = t("app.name");
  useEffect(() => {
    document.title = page === null ? app : `${page} · ${app}`;
  }, [app, page]);
}
