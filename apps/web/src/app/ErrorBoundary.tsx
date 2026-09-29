// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Last line of defense: a render error or a route chunk that fails to download shows a message
// with a reload button instead of a blank page.
import { Button } from "@blueprint/ui/components/button";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  readonly children: ReactNode;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? <CrashMessage /> : this.props.children;
  }
}

function CrashMessage() {
  const { t } = useTranslation();
  return (
    <div role="alert" className="mx-auto mt-16 max-w-lg rounded-lg border bg-card p-6">
      <h1 className="text-xl">{t("app.crash.title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("app.crash.description")}</p>
      <Button className="mt-4" onClick={() => window.location.reload()}>
        {t("app.crash.reload")}
      </Button>
    </div>
  );
}
