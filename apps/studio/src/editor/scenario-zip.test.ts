// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The .zip of "Descargar .zip" (RF-STU-14): one folder with the editor's text, notes.md when there
// is one and the generated files of that same text.
import { renderGeneratedFiles } from "@blueprint/content-lint";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PDF_ID, pdfYaml, scenarioOf, shared } from "../testing/content-fixture";
import { buildScenarioZip, downloadZip } from "./scenario-zip";

const contents = (bytes: Uint8Array) =>
  Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)]),
  );

const generated = (yaml: string) =>
  renderGeneratedFiles(
    scenarioOf(yaml),
    new Map(shared.catalog.map((service) => [service.id, service])),
  );

describe("buildScenarioZip", () => {
  it("has scenario.yaml, notes.md and the two generated files in a folder named after the id", () => {
    const zip = buildScenarioZip({
      id: PDF_ID,
      yaml: pdfYaml,
      notes: "# Notas\n",
      catalog: shared.catalog,
    });
    expect(zip.fileName).toBe(`${PDF_ID}.zip`);
    expect(zip.missingGenerated).toBe(false);
    const expected = generated(pdfYaml);
    expect(contents(zip.bytes)).toEqual({
      [`${PDF_ID}/scenario.yaml`]: pdfYaml,
      [`${PDF_ID}/notes.md`]: "# Notas\n",
      [`${PDF_ID}/diagram.mmd`]: expected["diagram.mmd"],
      [`${PDF_ID}/README.md`]: expected["README.md"],
    });
    expect(zip.files).toEqual(Object.keys(contents(zip.bytes)));
  });

  it("generates from the current text, not from the file on disk, and leaves out notes.md if there is none", () => {
    const draft = pdfYaml.replace(/^title: .*$/m, 'title: "Un borrador sin guardar"');
    const zip = buildScenarioZip({ id: PDF_ID, yaml: draft, notes: null, catalog: shared.catalog });
    const files = contents(zip.bytes);
    expect(Object.keys(files)).toEqual([
      `${PDF_ID}/scenario.yaml`,
      `${PDF_ID}/diagram.mmd`,
      `${PDF_ID}/README.md`,
    ]);
    expect(files[`${PDF_ID}/scenario.yaml`]).toBe(draft);
    expect(files[`${PDF_ID}/README.md`]).toContain("Un borrador sin guardar");
  });

  it("without the generated files when the text does not pass the schema", () => {
    for (const yaml of ["id: [roto\n", pdfYaml.replace(/^level: \d+$/m, "level: 250")]) {
      const zip = buildScenarioZip({ id: PDF_ID, yaml, notes: null, catalog: shared.catalog });
      expect(zip.missingGenerated).toBe(true);
      expect(contents(zip.bytes)).toEqual({ [`${PDF_ID}/scenario.yaml`]: yaml });
    }
  });
});

describe("downloadZip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("clicks a hidden link with the file name and frees the URL afterwards", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:zip");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const zip = buildScenarioZip({
      id: PDF_ID,
      yaml: pdfYaml,
      notes: null,
      catalog: shared.catalog,
    });
    downloadZip(zip);
    const clicked = click.mock.contexts[0] as HTMLAnchorElement | undefined;
    expect(click).toHaveBeenCalledOnce();
    expect(clicked?.download).toBe(`${PDF_ID}.zip`);
    expect(clicked?.href).toBe("blob:zip");
    expect(clicked?.isConnected).toBe(false);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:zip");
  });
});
