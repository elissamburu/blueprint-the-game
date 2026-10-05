// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// S5: every path the server touches is content/scenarios/<id>/<file>, with an id that already
// passed ScenarioIdSchema and a file name from a closed list. The resolved path has to stay inside
// content/scenarios/ lexically and after realpath, which follows symlinks and Windows junctions.
// A new scenario folder is created with an exclusive mkdir (S8), and templates come from a closed
// list of names inside content/scenarios/_templates/.
import path from "node:path";
import { ScenarioIdSchema, TEMPLATE_NAMES, type TemplateName } from "../shared/api.js";
import { StudioError } from "./errors.js";
import { errorCode, isNotFound, type ContentFs } from "./fs.js";

/** notes.md is only read (it goes in the .zip); the server writes the other three. */
export const SCENARIO_FILES = ["scenario.yaml", "diagram.mmd", "README.md", "notes.md"] as const;
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
  /**
   * Creates the folder of a new scenario with an exclusive mkdir: if anything with that name is
   * already there, 409 and nothing changes (S8). Returns its absolute path.
   */
  createDir: (id: string) => Promise<string>;
  /** Removes a folder `createDir` made, only if it is still empty (a failed creation). */
  removeEmptyDir: (dir: string) => Promise<void>;
  /** Absolute path of `_templates/<name>.template.yaml`, checked like a scenario file; 404 if missing. */
  template: (name: TemplateName) => Promise<string>;
}

const invalidId = (id: string): StudioError =>
  new StudioError(400, "invalid-id", `"${id}" no es un id de escenario válido.`);

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
      throw invalidId(id);
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

  const createDir: ScenarioPaths["createDir"] = async (id) => {
    if (!ScenarioIdSchema.safeParse(id).success) throw invalidId(id);
    const dir = path.resolve(scenariosDir, id);
    if (!isInside(scenariosDir, dir)) throw outside();
    const root = await realScenariosDir();
    try {
      // Not recursive: the parent exists, and an existing folder, file or link is an error.
      await fs.mkdir(dir);
    } catch (error) {
      if (errorCode(error) === "EEXIST") {
        throw new StudioError(
          409,
          "conflict",
          `Ya existe un escenario con el id "${id}": elegí otro. No se tocó el existente.`,
        );
      }
      throw error;
    }
    if (!isInside(root, await fs.realpath(dir))) {
      await removeEmptyDir(dir);
      throw outside();
    }
    return dir;
  };

  const removeEmptyDir: ScenarioPaths["removeEmptyDir"] = async (dir) => {
    // rmdir (not rm): it fails on a folder with anything inside, so it can only undo the mkdir.
    await fs.rmdir(dir).catch(() => undefined);
  };

  const template: ScenarioPaths["template"] = async (name) => {
    if (!TEMPLATE_NAMES.includes(name)) {
      throw new StudioError(400, "bad-request", "Esa plantilla no existe.");
    }
    const dir = path.resolve(scenariosDir, "_templates");
    const target = path.resolve(dir, `${name}.template.yaml`);
    if (!isInside(scenariosDir, dir) || !isInside(dir, target)) throw outside();
    const root = await realScenariosDir();
    let realTarget: string;
    try {
      realTarget = await fs.realpath(target);
    } catch (error) {
      if (isNotFound(error)) {
        throw new StudioError(
          404,
          "not-found",
          `No existe la plantilla content/scenarios/_templates/${name}.template.yaml.`,
        );
      }
      throw error;
    }
    if (!isInside(root, realTarget)) throw outside();
    return target;
  };

  return { scenariosDir, file, createDir, removeEmptyDir, template };
};
