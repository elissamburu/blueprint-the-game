// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Page scaffolding of the catalog. Lovable: .page-shell, .page-heading, .review-heading and
// .profile-section (src/styles.css). Headings keep the body weight, as in Lovable.
import type * as React from "react";

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1180px] px-8 pt-[4.5rem] pb-24">{children}</div>;
}

export function PageHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8">
      <span className="section-kicker">{kicker}</span>
      <h1 className="mt-[0.35rem] text-[2.6rem]">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </header>
  );
}

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
