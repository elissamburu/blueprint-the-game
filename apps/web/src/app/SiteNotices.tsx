// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Notices above every screen during the public beta: the beta itself, with the feedback link, and
// one for narrow screens (the game is desktop-first in v1, RNF-01). Both are static named regions,
// never live ones: nothing is announced on load. Closing one is an interface preference of this
// browser. Contrast of their text: docs/design/tokens.css.
import { useFlagPreference } from "@blueprint/play";
import { Button } from "@blueprint/ui/components/button";
import { cn } from "@blueprint/ui/lib/utils";
import { ExternalLinkIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { repositoryUrl } from "../features/play/report-issue";
import { feedbackUrl } from "./feedback";

const FEEDBACK_URL = feedbackUrl(
  import.meta.env.VITE_FEEDBACK_URL,
  repositoryUrl(import.meta.env.VITE_REPO_URL),
);

export const BETA_NOTICE_DISMISSED_KEY = "blueprint.ui.betaNoticeDismissed";
export const NARROW_NOTICE_DISMISSED_KEY = "blueprint.ui.narrowNoticeDismissed";

/** `focusTargetId`: where the focus goes when a notice is closed, so it is not lost. */
export function SiteNotices({ focusTargetId }: { focusTargetId: string }) {
  const { t } = useTranslation();
  return (
    <>
      <Notice
        storageKey={BETA_NOTICE_DISMISSED_KEY}
        label={t("beta.label")}
        dismissLabel={t("beta.dismiss")}
        focusTargetId={focusTargetId}
        className="bg-blueprint-soft"
      >
        {t("beta.text")}{" "}
        {/* Always underlined: inside a sentence, color alone does not tell a link apart
            (WCAG 1.4.1). */}
        <a
          href={FEEDBACK_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-blueprint underline underline-offset-4"
        >
          {t("beta.feedback")}
          <ExternalLinkIcon aria-hidden className="size-3.5" />
          <span className="sr-only">{t("about.external")}</span>
        </a>
      </Notice>
      {/* In px, not a rem breakpoint: it is about the width of the screen, not of the text. */}
      <Notice
        storageKey={NARROW_NOTICE_DISMISSED_KEY}
        label={t("narrow.label")}
        dismissLabel={t("narrow.dismiss")}
        focusTargetId={focusTargetId}
        className="bg-warning-soft min-[1024px]:hidden"
      >
        {t("narrow.text")}
      </Notice>
    </>
  );
}

function Notice({
  storageKey,
  label,
  dismissLabel,
  focusTargetId,
  className,
  children,
}: {
  storageKey: string;
  label: string;
  dismissLabel: string;
  focusTargetId: string;
  className: string;
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useFlagPreference(storageKey);
  if (dismissed) return null;
  return (
    <section
      aria-label={label}
      className={cn(
        "grid shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-1 text-sm",
        className,
      )}
    >
      <p className="text-center">{children}</p>
      <Button
        variant="ghost"
        size="icon"
        aria-label={dismissLabel}
        onClick={() => {
          setDismissed(true);
          document.getElementById(focusTargetId)?.focus();
        }}
      >
        <XIcon aria-hidden />
      </Button>
    </section>
  );
}
