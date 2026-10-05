// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The left panel of the editor: the form ("Formulario", RF-STU-03), the draft played ("Jugar",
// RF-STU-08) and its answers ("Respuestas", RF-STU-09), as Radix tabs (arrows, Home, End; the
// focus stays on the tab). The form edits the text and has its own notice for a text that does
// not parse; the other two follow the last valid Scenario of the editor, and while the YAML does
// not parse or fails the schema, a notice says so with the line of the error. The panels of
// "Formulario" and "Jugar" stay mounted while hidden, so the open sections and the game in
// progress survive a change of tab.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@blueprint/ui/components/tabs";
import { ListChecksIcon, PlayIcon, SquarePenIcon } from "lucide-react";
import { lazy, Suspense, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SharedContent } from "../../shared/api";
import type { ScenarioValidation, StudioFinding } from "../../shared/validation";
import { useDraft } from "./draft";
import { DraftProblem } from "./DraftProblem";
import { PreviewPanel } from "./PreviewPanel";
import { gameBundleOf } from "./studio-game-host";

const AnswersView = lazy(() => import("./AnswersView"));

export type DraftTab = "form" | "play" | "answers";
const isTab = (value: string): value is DraftTab =>
  value === "form" || value === "play" || value === "answers";

export function DraftTabs({
  result,
  shared,
  sharedError,
  onJump,
  tab,
  onTabChange,
  form,
}: {
  result: ScenarioValidation | undefined;
  shared: SharedContent | undefined;
  sharedError: string | undefined;
  onJump: (finding: StudioFinding) => void;
  tab: DraftTab;
  onTabChange: (tab: DraftTab) => void;
  /** The form, built by the editor page (it edits the editor's text). */
  form: ReactNode;
}) {
  const { t } = useTranslation();
  const draft = useDraft(result);
  const bundle = useMemo(() => (shared === undefined ? undefined : gameBundleOf(shared)), [shared]);
  const waiting = (
    <p role="status" className="p-2">
      {sharedError === undefined
        ? t("app.loading")
        : t("validation.sharedFailed", { message: sharedError })}
    </p>
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => isTab(value) && onTabChange(value)}
      className="min-h-0 flex-1"
    >
      <TabsList aria-label={t("draft.tabs")} className="self-start">
        <TabsTrigger value="form">
          <SquarePenIcon aria-hidden />
          {t("draft.form")}
        </TabsTrigger>
        <TabsTrigger value="play">
          <PlayIcon aria-hidden />
          {t("draft.play")}
        </TabsTrigger>
        <TabsTrigger value="answers">
          <ListChecksIcon aria-hidden />
          {t("draft.answers")}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="form"
        forceMount
        hidden={tab !== "form"}
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {shared === undefined ? waiting : form}
      </TabsContent>
      {draft.problem !== undefined && tab !== "form" && (
        <DraftProblem
          problem={draft.problem}
          hasDraft={draft.scenario !== undefined}
          onJump={onJump}
        />
      )}
      <TabsContent
        value="play"
        forceMount
        hidden={tab !== "play"}
        className="flex min-h-0 flex-1 flex-col"
      >
        {bundle === undefined ? waiting : <PreviewPanel draft={draft.scenario} bundle={bundle} />}
      </TabsContent>
      <TabsContent value="answers" className="min-h-0 flex-1 overflow-y-auto pr-1">
        {shared === undefined ? (
          waiting
        ) : draft.scenario === undefined ? (
          <p className="p-2 text-muted-foreground">{t("preview.noDraft")}</p>
        ) : (
          <Suspense fallback={<p className="p-2">{t("app.loading")}</p>}>
            <AnswersView scenario={draft.scenario} shared={shared} />
          </Suspense>
        )}
      </TabsContent>
    </Tabs>
  );
}
