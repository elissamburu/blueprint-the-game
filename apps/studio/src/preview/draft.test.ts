// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { validateScenarioText } from "../../shared/validation";
import { PDF_ID, pdfYaml, shared } from "../testing/content-fixture";
import { draftOf, EMPTY_DRAFT, nextDraft } from "./draft";

const validate = (text: string) => validateScenarioText(text, PDF_ID, shared);
const retitled = pdfYaml.replace(/^title: .*$/m, 'title: "Otro título"');

describe("the draft of the preview", () => {
  it("takes the scenario of a text that passes the schema", () => {
    const result = validate(pdfYaml);
    const draft = draftOf(nextDraft(EMPTY_DRAFT, result));
    expect(draft.scenario).toBe(result.scenario);
    expect(draft.problem).toBeUndefined();
  });

  it("keeps the last valid scenario while the YAML does not parse, with the line of the error", () => {
    const valid = nextDraft(EMPTY_DRAFT, validate(pdfYaml));
    // The last line, with no line break after it (as the e2e of the editor types it).
    const broken = `${pdfYaml}roto: [sin cerrar`;
    const draft = draftOf(nextDraft(valid, validate(broken)));
    expect(draft.scenario).toBe(valid.scenario);
    expect(draft.problem?.code).toBe("YAML");
    expect(draft.problem?.line).toBe(broken.split("\n").length);
  });

  it("keeps the last valid scenario while the text fails the schema", () => {
    const valid = nextDraft(EMPTY_DRAFT, validate(pdfYaml));
    const draft = draftOf(
      nextDraft(valid, validate(pdfYaml.replace(/^level: 200$/m, "level: 250"))),
    );
    expect(draft.scenario).toBe(valid.scenario);
    expect(draft.problem?.code).toBe("SCHEMA");
    expect(draft.problem?.line).toBe(pdfYaml.split("\n").indexOf("level: 200") + 1);
  });

  it("has no scenario while no version was ever valid", () => {
    const draft = draftOf(nextDraft(EMPTY_DRAFT, validate("id: [")));
    expect(draft.scenario).toBeUndefined();
    expect(draft.problem?.code).toBe("YAML");
  });

  it("takes the new version once the text is valid again", () => {
    const valid = nextDraft(EMPTY_DRAFT, validate(pdfYaml));
    const broken = nextDraft(valid, validate("id: ["));
    const fixed = draftOf(nextDraft(broken, validate(retitled)));
    expect(fixed.scenario?.title).toBe("Otro título");
    expect(fixed.problem).toBeUndefined();
  });

  it("keeps the same object when only comments change, so a game is not «changed»", () => {
    const valid = nextDraft(EMPTY_DRAFT, validate(pdfYaml));
    const commented = nextDraft(valid, validate(`# Un comentario\n${pdfYaml}`));
    expect(commented.scenario).toBe(valid.scenario);
    expect(nextDraft(commented, validate(retitled)).scenario).not.toBe(valid.scenario);
  });

  it("returns the same state for the same result", () => {
    const state = nextDraft(EMPTY_DRAFT, validate(pdfYaml));
    expect(nextDraft(state, state.result)).toBe(state);
  });
});
