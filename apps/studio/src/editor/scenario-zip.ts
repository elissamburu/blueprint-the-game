// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Descargar .zip" (RF-STU-14): the scenario as the author has it in the editor, built in the
// browser with fflate. The zip has one folder named after the id, ready to drop into
// content/scenarios/: scenario.yaml (the current text, saved or not), notes.md if the scenario has
// one, and diagram.mmd and README.md generated from that same text, as saving would write them.
import { GENERATED_FILES, renderGeneratedFiles } from "@blueprint/content-lint";
import { parseScenario, type Service } from "@blueprint/scenario-schema";
import { strToU8, zipSync } from "fflate";
import { parse } from "yaml";

export interface ScenarioZipInput {
  id: string;
  /** The text of the editor. */
  yaml: string;
  /** notes.md as it is on disk, or `null`. */
  notes: string | null;
  catalog: readonly Service[];
}

export interface ScenarioZip {
  fileName: string;
  bytes: Uint8Array;
  /** Paths inside the zip, in order. */
  files: string[];
  /** The text does not pass the schema: diagram.mmd and README.md could not be generated. */
  missingGenerated: boolean;
}

/** The generated files of a text, or `undefined` when it does not parse or pass the schema. */
const generatedFiles = (yaml: string, catalog: readonly Service[]) => {
  let raw: unknown;
  try {
    raw = parse(yaml);
  } catch {
    return undefined;
  }
  const scenario = parseScenario(raw);
  if (!scenario.success) return undefined;
  return renderGeneratedFiles(scenario.data, new Map(catalog.map((s) => [s.id, s])));
};

export const buildScenarioZip = ({ id, yaml, notes, catalog }: ScenarioZipInput): ScenarioZip => {
  const entries: [string, string][] = [["scenario.yaml", yaml]];
  if (notes !== null) entries.push(["notes.md", notes]);
  const generated = generatedFiles(yaml, catalog);
  if (generated !== undefined) {
    for (const name of GENERATED_FILES) entries.push([name, generated[name]]);
  }
  const files = entries.map(([name]) => `${id}/${name}`);
  const bytes = zipSync(
    Object.fromEntries(entries.map(([name, text]) => [`${id}/${name}`, strToU8(text)])),
  );
  return { fileName: `${id}.zip`, bytes, files, missingGenerated: generated === undefined };
};

/** Hands the zip to the browser as a download. */
export const downloadZip = ({ fileName, bytes }: ScenarioZip, doc: Document = document): void => {
  // A copy over a plain ArrayBuffer, which is what Blob takes.
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/zip" }));
  const link = doc.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  doc.body.append(link);
  link.click();
  link.remove();
  // After the click the browser already has the file; revoking later keeps slow browsers safe.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
