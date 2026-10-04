// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Explanation of a service the scenario does not declare in `answers` nor `incorrect`
// (docs/03 §2): "<catalog short>. No cumple el rol: <role>". game-engine returns the data
// (`source: "undeclared"`); the text is presentation, so it is composed here with i18n.
import type { Service } from "@blueprint/scenario-schema";
import type { TFunction } from "i18next";

const SENTENCE_END = /[.!?…]$/u;

export const genericExplanation = (
  t: TFunction<"play">,
  service: Pick<Service, "short">,
  role: string,
): string => {
  const short = service.short.trim();
  return t("feedback.undeclared", {
    short: SENTENCE_END.test(short) ? short : `${short}.`,
    role,
  });
};
