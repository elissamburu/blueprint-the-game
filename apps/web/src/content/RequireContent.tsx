// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Renders its children once the content bundle is loaded and valid; meanwhile a loading state,
// and a clear error (never a blank page) when a file is missing or does not validate.
import { Button } from "@blueprint/ui/components/button";
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useContentStore } from "./content-store";
import type { ContentBundle, ContentLoadError } from "./load-bundle";

export function RequireContent({ children }: { children: (bundle: ContentBundle) => ReactNode }) {
  const status = useContentStore((s) => s.status);
  const bundle = useContentStore((s) => s.bundle);
  const error = useContentStore((s) => s.error);
  const load = useContentStore((s) => s.load);
  const { t } = useTranslation();

  if (status === "error" && error !== null) {
    return <ContentErrorView error={error} onRetry={() => void load()} />;
  }
  if (bundle === null) return <Loading label={t("content.loading")} />;
  return children(bundle);
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="py-16 text-center text-muted-foreground">
      {label}
    </p>
  );
}

export function ContentErrorView({
  error,
  onRetry,
}: {
  error: ContentLoadError;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      role="alert"
      aria-labelledby="content-error-title"
      className="rounded-lg border border-destructive/40 bg-danger-soft p-6"
    >
      <h2 id="content-error-title" className="flex items-center gap-2 text-xl text-destructive">
        <TriangleAlertIcon aria-hidden className="size-5" />
        {t("content.error.title")}
      </h2>
      <p className="mt-3">{describe(error, t)}</p>
      {error.kind === "invalid" && (
        <ul className="mt-2 list-disc pl-6 font-mono text-sm">
          {error.issues.map((issue, i) => (
            <li key={i}>
              {issue.where}: {issue.message}
            </li>
          ))}
        </ul>
      )}
      {import.meta.env.DEV && (
        <p className="mt-3 text-sm text-muted-foreground">{t("content.error.hint")}</p>
      )}
      {onRetry !== undefined && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          {t("content.error.retry")}
        </Button>
      )}
    </section>
  );
}

const describe = (
  error: ContentLoadError,
  t: ReturnType<typeof useTranslation>["t"],
): string => {
  switch (error.kind) {
    case "network":
      return t("content.error.network", { file: error.file, detail: error.detail });
    case "invalid-json":
      return t("content.error.invalidJson", { file: error.file });
    case "invalid":
      return t("content.error.invalid", { file: error.file });
    case "mismatch":
      return t("content.error.mismatch", {
        file: error.file,
        id: error.id,
        version: error.version,
      });
  }
};
