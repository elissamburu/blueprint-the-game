// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Section scaffolding of the catalog. Lovable: .review-heading and .profile-section
// (src/styles.css). The page shell and heading are the app ones (src/app/page.tsx).
import type * as React from "react";

export { PageHeading, PageShell } from "../app/page";

export function Section({
  id,
  kicker,
  title,
  description,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2 id={id} className="mt-[0.3rem] text-[1.6rem]">
            {title}
          </h2>
        </div>
        <p className="text-[0.78rem] text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

/** Lovable: .profile-section, with the title as a .section-kicker. */
export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-[1.4rem]">
      <h3 className="section-kicker">{title}</h3>
      {children}
    </div>
  );
}
