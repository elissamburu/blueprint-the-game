// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// S5: every path the server touches is content/scenarios/<id>/<file>, with an id that already
// passed ScenarioIdSchema and a file name from a closed list. The resolved path has to stay inside
// content/scenarios/ lexically and after realpath, which follows symlinks and Windows junctions.
import path from "node:path";
import { ScenarioIdSchema } from "../shared/api.js";
import { StudioError } from "./errors.js";
import { isNotFound, type ContentFs } from "./fs.js";

export const SCENARIO_FILES = ["scenario.yaml", "diagram.mmd", "README.md"] as const;
export type ScenarioFileName = (typeof SCENARIO_FILES)[number];

/** `child` is strictly inside `parent` (both absolute and resolved). */
export const isInside = (parent: string, child: string): boolean => {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};

const outside = (): StudioError =>
  new StudioError(
    403,
    "outside-content",
    "La carpeta o el archivo del escenario apunta fuera de content/scenarios/ (enlace simbólico o junction): el Studio no lo abre.",
  );

export interface ScenarioPaths {
  scenariosDir: string;
  /**
   * Absolute path of a file of the scenario, checked against content/scenarios/. `exists` tells
   * whether it is there; a missing scenario folder is a 404.
   */
  file: (id: string, name: ScenarioFileName) => Promise<{ path: string; exists: boolean }>;
}

export const createScenarioPaths = (fs: ContentFs, contentDir: string): ScenarioPaths => {
  const scenariosDir = path.resolve(contentDir, "scenarios");

  const realScenariosDir = async (): Promise<string> => {
    try {
      return await fs.realpath(scenariosDir);
    } catch (error) {
      if (isNotFound(error)) {
        throw new StudioError(404, "not-found", "No existe la carpeta content/scenarios/.");
      }
      throw error;
    }
  };

  const file: ScenarioPaths["file"] = async (id, name) => {
    // Defense in depth: the routes validate the id before calling, and nothing here touches the
    // disk until both the id and the file name are known to be safe.
    if (!ScenarioIdSchema.safeParse(id).success || !SCENARIO_FILES.includes(name)) {
      throw new StudioError(400, "invalid-id", `"${id}" no es un id de escenario válido.`);
    }
    const dir = path.resolve(scenariosDir, id);
    const target = path.resolve(dir, name);
    if (!isInside(scenariosDir, dir) || !isInside(dir, target)) throw outside();

    const root = await realScenariosDir();
    let realDir: string;
    try {
      realDir = await fs.realpath(dir);
    } catch (error) {
      if (isNotFound(error)) {
        throw new StudioError(404, "not-found", `No existe el escenario "${id}".`);
      }
      throw error;
    }
    if (!isInside(root, realDir)) throw outside();

    try {
      const realTarget = await fs.realpath(target);
      if (!isInside(realDir, realTarget)) throw outside();
      return { path: target, exists: true };
    } catch (error) {
      if (isNotFound(error)) return { path: target, exists: false };
      throw error;
    }
  };

  return { scenariosDir, file };
};
