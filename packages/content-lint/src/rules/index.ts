// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Scenario rules run by lintScenario. Not listed here: L012 and L014 compare against files
// or git (pure helpers exported below), L013 is enforced by the schema and L017 is a CI job.
import type { Rule } from "../types.js";
import { l001 } from "./l001-id-matches-folder.js";
import { l002 } from "./l002-services-in-catalog.js";
import { l003 } from "./l003-slot-has-optimal.js";
import { l004 } from "./l004-answer-objectives-exist.js";
import { l005 } from "./l005-leaks.js";
import { l006 } from "./l006-edges.js";
import { l007 } from "./l007-layout.js";
import { l008 } from "./l008-no-duplicate-service-in-slot.js";
import { l009 } from "./l009-slot-count-by-level.js";
import { l010 } from "./l010-deprecated-services.js";
import { l011 } from "./l011-official-references.js";
import { l015 } from "./l015-violates-objectives-exist.js";
import { l016 } from "./l016-curated-distractors.js";
import { l018 } from "./l018-ids-and-references.js";
import { l019 } from "./l019-areas-exist.js";
import { l020 } from "./l020-acceptable-objectives-soft.js";
import { l021 } from "./l021-level-zero-analogy-limit.js";
import { l022 } from "./l022-level-zero-plain-names.js";

export const rules: readonly Rule[] = [
  l001,
  l002,
  l003,
  l004,
  l005,
  l006,
  l007,
  l008,
  l009,
  l010,
  l011,
  l015,
  l016,
  l018,
  l019,
  l020,
  l021,
  l022,
];

export {
  l001,
  l002,
  l003,
  l004,
  l005,
  l006,
  l007,
  l008,
  l009,
  l010,
  l011,
  l015,
  l016,
  l018,
  l019,
  l020,
  l021,
  l022,
};
export { checkGeneratedFiles, type GeneratedFile } from "./l012-generated-files.js";
export { checkVersionBump, gameplayChanges } from "./l014-version-bump.js";
