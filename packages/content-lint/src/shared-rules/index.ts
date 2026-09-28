// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Integrity rules between shared content files, run by lintSharedContent (docs/03 §3).
import type { SharedRule } from "../types.js";
import { c001 } from "./c001-service-category-exists.js";
import { c002 } from "./c002-adjacent-categories.js";
import { c003 } from "./c003-confusion-group-services.js";
import { c004 } from "./c004-confusion-group-size.js";
import { c005 } from "./c005-unique-ids.js";
import { c006 } from "./c006-badge-areas-exist.js";
import { c007 } from "./c007-rank-thresholds.js";
import { c008 } from "./c008-unlock-levels.js";
import { c009 } from "./c009-deprecated-in-confusion-group.js";
import { c010 } from "./c010-shared-leak-patterns.js";

export const sharedRules: readonly SharedRule[] = [
  c001,
  c002,
  c003,
  c004,
  c005,
  c006,
  c007,
  c008,
  c009,
  c010,
];

export { c001, c002, c003, c004, c005, c006, c007, c008, c009, c010 };
