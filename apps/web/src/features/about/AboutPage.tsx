// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Acerca de": licenses (ADR-0016), source code and the non-affiliation notice with AWS
// (ADR-0012, ADR-0019, TRADEMARKS.md). Does not need the content bundle.
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { LINKS } from "../../app/links";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";

export default function AboutPage() {
  const { t } = useTranslation();
  usePageTitle(t("about.kicker"));
  return (
    <PageShell>
      <PageHeading
        kicker={t("about.kicker")}
        title={t("about.title")}
        description={t("about.description")}
      />
      <div className="grid max-w-3xl gap-4">
        <AboutSection id="licenses" title={t("about.licenses.title")}>
          <p>
            <Trans
              i18nKey="about.licenses.code"
              components={{ 1: <ExternalLink href={LINKS.codeLicense} /> }}
            />
          </p>
          <p>
            <Trans
              i18nKey="about.licenses.content"
              components={{ 1: <ExternalLink href={LINKS.contentLicense} /> }}
            />
          </p>
        </AboutSection>
        <AboutSection id="repo" title={t("about.repo.title")}>
          <p>{t("about.repo.description")}</p>
          <p>
            <ExternalLink href={LINKS.repository}>{t("about.repo.link")}</ExternalLink>
          </p>
        </AboutSection>
        <AboutSection id="trademarks" title={t("about.trademarks.title")}>
          <p className="font-semibold">{t("about.trademarks.notAffiliated")}</p>
          <p>{t("about.trademarks.marks")}</p>
          <p>
            <Trans
              i18nKey="about.trademarks.icons"
              components={{ 1: <ExternalLink href={LINKS.architectureIcons} /> }}
            />
          </p>
        </AboutSection>
      </div>
    </PageShell>
  );
}

function AboutSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const headingId = `about-${id}`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg border bg-card p-[1.4rem] text-base leading-relaxed"
    >
      <h2 id={headingId} className="text-[1.3rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
    >
      {children}
      <ExternalLinkIcon aria-hidden className="size-3.5" />
      <span className="sr-only">{t("about.external")}</span>
    </a>
  );
}
