// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/** Sets the document title of a page: "<page> · Blueprint Studio". */
export function usePageTitle(page: string) {
  const { t } = useTranslation();
  const app = t("app.name");
  useEffect(() => {
    document.title = `${page} · ${app}`;
  }, [app, page]);
}
