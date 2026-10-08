// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Layout of every game screen: skip link, the notices of the beta, header, the route page and a
// footer with the link to "Acerca de". Starts loading the content bundle and the stored progress. An immersive page
// (the game screen, useImmersiveLayout) hides the header and the footer and fills the viewport;
// a standalone one (the onboarding, useStandaloneLayout) hides only the header. Printed, only the
// page is: the skip link, the notices, the header, the banner, the footer and the toasts are not
// printed (the fixed container of the toasts alone would add a blank page).
import { Button } from "@blueprint/ui/components/button";
import { Toaster, toast } from "@blueprint/ui/components/sonner";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet } from "react-router";
import { useAuthStore } from "../auth/auth-store";
import { useContentStore } from "../content/content-store";
import { Loading } from "../content/RequireContent";
import { useProgressStore } from "../progress/progress-store";
import { AppHeader } from "./AppHeader";
import { ErrorBoundary } from "./ErrorBoundary";
import { ImmersiveContext, type LayoutMode } from "./immersive";
import { SiteNotices } from "./SiteNotices";

export const MAIN_ID = "contenido";

export function AppLayout() {
  const { t } = useTranslation();
  const loadContent = useContentStore((s) => s.load);
  const hydrate = useProgressStore((s) => s.hydrate);
  const [mode, setMode] = useState<LayoutMode>("default");
  const immersive = mode === "immersive";
  const initAuth = useAuthStore((s) => s.init);
  useEffect(() => {
    void loadContent();
    // With a session (or on the callback of the login) the progress comes from the cloud profile.
    if (!initAuth()) void hydrate();
  }, [loadContent, hydrate, initAuth]);

  return (
    <ImmersiveContext.Provider value={setMode}>
      <div
        className={immersive ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-screen flex-col"}
      >
        <a
          href={`#${MAIN_ID}`}
          className="sr-only z-50 rounded-md bg-card px-4 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 print:hidden"
        >
          {t("app.skipToContent")}
        </a>
        <div className="contents print:hidden">
          <SiteNotices focusTargetId={MAIN_ID} />
          {mode === "default" && <AppHeader />}
        </div>
        <IncompatibleProgressBanner />
        <main
          id={MAIN_ID}
          tabIndex={-1}
          className={
            immersive ? "flex min-h-0 flex-1 flex-col outline-none" : "flex-1 outline-none"
          }
        >
          <ErrorBoundary>
            <Suspense fallback={<Loading label={t("app.loading")} />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
        {!immersive && (
          <footer
            className={
              mode === "standalone"
                ? "border-t px-4 py-6 text-center text-sm text-muted-foreground print:hidden"
                : "border-t px-4 py-6 pb-24 text-center text-sm text-muted-foreground md:pb-6 print:hidden"
            }
          >
            {t("app.footer")}{" "}
            {/* Always underlined: inside a sentence, color alone does not tell a link apart
                (WCAG 1.4.1). */}
            <Link to="/acerca" className="text-primary underline underline-offset-4">
              {t("nav.about")}
            </Link>
          </footer>
        )}
        <ProgressNotices />
        <AuthNotices />
        <div className="contents print:hidden">
          <Toaster />
        </div>
      </div>
    </ImmersiveContext.Provider>
  );
}

/** Tells the player, once, what happened to their stored progress. */
function ProgressNotices() {
  const { t } = useTranslation();
  const notice = useProgressStore((s) => s.notice);
  const dismiss = useProgressStore((s) => s.dismissNotice);
  useEffect(() => {
    if (notice === null) return;
    if (notice === "discarded") toast.warning(t("progress.discarded"));
    else toast.error(t("progress.saveFailed"));
    dismiss();
  }, [notice, dismiss, t]);
  return null;
}

/** Tells the player, once, what happened with the login (ADR-0029). */
function AuthNotices() {
  const { t } = useTranslation();
  const error = useAuthStore((s) => s.error);
  const uploaded = useAuthStore((s) => s.uploaded);
  const dismissError = useAuthStore((s) => s.dismissError);
  const dismissUploaded = useAuthStore((s) => s.dismissUploaded);
  useEffect(() => {
    // The visible name has its own message inside its dialog.
    if (error === null || error === "display-name") return;
    toast.error(t(`auth.errors.${error}`));
    dismissError();
  }, [error, dismissError, t]);
  useEffect(() => {
    if (!uploaded) return;
    toast.success(t("auth.uploaded"));
    dismissUploaded();
  }, [uploaded, dismissUploaded, t]);
  return null;
}

/**
 * Shown while the stored progress comes from a newer version of the game (e.g. after a rollback
 * of the deploy): it is neither loaded nor overwritten until the page is reloaded.
 */
function IncompatibleProgressBanner() {
  const { t } = useTranslation();
  const incompatible = useProgressStore((s) => s.incompatible);
  if (!incompatible) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-3 border-b bg-warning-soft px-4 py-3 text-center text-sm print:hidden"
    >
      <span>{t("progress.incompatible")}</span>
      <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
        {t("progress.reload")}
      </Button>
    </div>
  );
}
