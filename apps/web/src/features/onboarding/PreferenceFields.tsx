// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The two questions of the onboarding (RF-ONB-01, RF-ONB-02), shared with the profile (RF-ONB-03):
// areas of interest as a group of toggles (aria-pressed) and experience as a radio group,
// navigable with the arrow keys. The areas come from content/areas.yaml and the experiences from
// game-rules.yaml, with their texts in i18n. «Recién empiezo con la nube» (`newcomer`, RF-ONB-05)
// is offered only while there is a level 0 scenario to start with.
// Lovable: .chip-grid and .experience-list (blueprint-app.tsx, styles.css).
import type { BundleIndexEntry, Experience, GameRules } from "@blueprint/scenario-schema";
import { EXPERIENCES, LEVELS } from "@blueprint/scenario-schema";
import { RadioCardItem } from "@blueprint/ui/components/radio-card";
import { RadioGroup } from "@blueprint/ui/components/radio-group";
import { Toggle } from "@blueprint/ui/components/toggle";
import { CheckIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ContentBundle } from "../../content/load-bundle";

export function AreaToggles({
  areas,
  value,
  onChange,
  className,
}: {
  areas: ContentBundle["index"]["areas"];
  value: readonly string[];
  onChange: (interests: readonly string[]) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const toggle = (area: string, pressed: boolean) =>
    onChange(pressed ? [...value, area] : value.filter((item) => item !== area));
  return (
    <fieldset className={className}>
      <legend className="mb-[0.8rem] font-bold">{t("welcome.areas")}</legend>
      <ul className="flex flex-wrap gap-[0.55rem]">
        {areas.map((area) => {
          const pressed = value.includes(area.id);
          return (
            <li key={area.id}>
              <Toggle
                variant="chip"
                pressed={pressed}
                onPressedChange={(next) => toggle(area.id, next)}
                title={area.description}
              >
                {pressed && <CheckIcon aria-hidden />}
                {area.name}
              </Toggle>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/**
 * `newcomer` starts at level 0 (RF-ONB-05): while the index lists no level 0 scenario, choosing it
 * would lead to an empty listing, so it is not offered (unless it is the player's current value,
 * in the profile).
 */
export const offeredExperiences = (
  rules: Pick<GameRules, "unlock">,
  scenarios: readonly Pick<BundleIndexEntry, "level">[],
  value: Experience | null,
): Experience[] => {
  const hasFirstLevel = scenarios.some((scenario) => scenario.level === LEVELS[0]);
  return EXPERIENCES.filter(
    (e) =>
      rules.unlock.byExperience[e] !== undefined &&
      (e !== "newcomer" || hasFirstLevel || value === e),
  );
};

export function ExperienceRadios({
  rules,
  scenarios,
  value,
  onChange,
  description,
  className,
}: {
  rules: Pick<GameRules, "unlock">;
  /** Listed scenarios (the bundle index), to offer `newcomer` only with level 0 content. */
  scenarios: readonly Pick<BundleIndexEntry, "level">[];
  value: Experience | null;
  onChange: (experience: Experience) => void;
  /** Help text under the question, tied to the group with aria-describedby. */
  description?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const experiences = offeredExperiences(rules, scenarios, value);
  return (
    <fieldset className={className}>
      <legend id={`${id}-legend`} className="mb-[0.8rem] font-bold">
        {t("welcome.experience")}
      </legend>
      {description !== undefined && (
        <p id={`${id}-help`} className="-mt-1 mb-[0.8rem] text-muted-foreground">
          {description}
        </p>
      )}
      <RadioGroup
        aria-labelledby={`${id}-legend`}
        aria-describedby={description === undefined ? undefined : `${id}-help`}
        value={value ?? ""}
        onValueChange={(next) => onChange(next as Experience)}
        className="grid gap-[0.6rem] sm:grid-cols-2"
      >
        {experiences.map((experience, index) => (
          <RadioCardItem
            key={experience}
            value={experience}
            marker={index + 1}
            title={t(`welcome.experiences.${experience}.title`)}
            description={t(`welcome.experiences.${experience}.description`)}
          />
        ))}
      </RadioGroup>
    </fieldset>
  );
}
