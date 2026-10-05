// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// List of the scenarios of content/scenarios/ (RF-STU-02): title, level, status and whether they
// have errors, each one a link to its editor.
import { Button } from "@blueprint/ui/components/button";
import { LevelBadge, type ScenarioLevel } from "@blueprint/ui/components/level-badge";
import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { ScenarioSummary } from "../../shared/api";
import { api, ApiError } from "../api/client";
import { usePageTitle } from "../app/page-title";
import { NewScenarioDialog } from "./NewScenarioDialog";

type State =
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | { kind: "ready"; scenarios: ScenarioSummary[] };

export function ScenarioListPage() {
  const { t } = useTranslation();
  usePageTitle(t("list.title"));
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(() => {
    api.listScenarios().then(
      ({ scenarios }) => setState({ kind: "ready", scenarios }),
      (error: unknown) =>
        setState({
          kind: "failed",
          message: error instanceof ApiError ? error.message : String(error),
        }),
    );
  }, []);
  useEffect(load, [load]);
  const retry = () => {
    setState({ kind: "loading" });
    load();
  };

  return (
    <div className="mx-auto w-full max-w-5xl overflow-y-auto px-4 py-8 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">{t("list.title")}</h1>
        <NewScenarioDialog scenarios={state.kind === "ready" ? state.scenarios : []} />
      </div>
      <p className="mt-2 max-w-prose text-muted-foreground">{t("list.description")}</p>
      <div className="mt-6">
        {state.kind === "loading" && <p role="status">{t("list.loading")}</p>}
        {state.kind === "failed" && (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p>{t("list.loadFailed", { message: state.message })}</p>
            <Button variant="outline" onClick={retry}>
              {t("list.retry")}
            </Button>
          </div>
        )}
        {state.kind === "ready" && state.scenarios.length === 0 && <p>{t("list.empty")}</p>}
        {state.kind === "ready" && state.scenarios.length > 0 && (
          <ScenarioTable scenarios={state.scenarios} />
        )}
      </div>
    </div>
  );
}

function ScenarioTable({ scenarios }: { scenarios: ScenarioSummary[] }) {
  const { t } = useTranslation();
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">{t("list.title")}</caption>
      <thead>
        <tr className="border-b text-sm text-muted-foreground">
          <th scope="col" className="py-2 pr-4 font-medium">
            {t("list.columns.scenario")}
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            {t("list.columns.level")}
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            {t("list.columns.status")}
          </th>
          <th scope="col" className="py-2 font-medium">
            {t("list.columns.validation")}
          </th>
        </tr>
      </thead>
      <tbody>
        {scenarios.map((scenario) => (
          <tr key={scenario.id} className="border-b align-top">
            <td className="py-3 pr-4">
              <Link
                to={`/escenarios/${scenario.id}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                {scenario.title ?? t("list.untitled")}
              </Link>
              <div className="font-mono text-sm text-muted-foreground">{scenario.id}</div>
            </td>
            <td className="py-3 pr-4">
              {scenario.level === null ? (
                t("list.noLevel")
              ) : (
                <LevelBadge level={scenario.level as ScenarioLevel} />
              )}
            </td>
            <td className="py-3 pr-4">{t(`status.${scenario.status ?? "unknown"}`)}</td>
            <td className="py-3">
              {scenario.hasErrors ? (
                <span className="inline-flex items-center gap-1.5 text-destructive">
                  <CircleXIcon aria-hidden className="size-4" />
                  {t("list.hasErrors")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CircleCheckIcon aria-hidden className="size-4" />
                  {t("list.valid")}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
