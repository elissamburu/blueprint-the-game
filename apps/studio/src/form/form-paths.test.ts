// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where an issue of the validation goes in the form (RF-STU-07): its field, or the closest group.
import { describe, expect, it } from "vitest";
import { anchorOf, errorId, fieldId } from "./form-paths";

const slots = new Set([2, 4]);
const isSlot = (index: number) => slots.has(index);

describe("form paths", () => {
  it("derives the ids of a field and of its message from the path", () => {
    expect(fieldId(["diagram", "nodes", 3, "role"])).toBe("form-diagram-nodes-3-role");
    expect(errorId(["title"])).toBe("form-title-error");
  });

  it.each([
    [["title"], ["title"], ["metadata"]],
    [["areas", 1], ["areas"], ["metadata"]],
    [["authors", 0], ["authors", 0, "github"], ["metadata"]],
    [["authors"], ["authors"], ["metadata"]],
    [["context"], ["context"], ["context"]],
    [["objectives"], ["objectives"], ["objectives"]],
    [["objectives", 2, "text"], ["objectives", 2, "text"], ["objectives"]],
    [["objectives", 2, "other"], ["objectives", 2], ["objectives"]],
    [
      ["diagram", "nodes", 2, "role"],
      ["diagram", "nodes", 2, "role"],
      ["slots", "slot-2"],
    ],
    [
      ["diagram", "nodes", 2],
      ["diagram", "nodes", 2],
      ["slots", "slot-2"],
    ],
    [
      ["diagram", "nodes", 2, "position", "x"],
      ["diagram", "nodes", 2],
      ["slots", "slot-2"],
    ],
    [
      ["diagram", "nodes", 4, "hints", 1],
      ["diagram", "nodes", 4, "hints", 1],
      ["slots", "slot-4"],
    ],
    [
      ["diagram", "nodes", 4, "answers"],
      ["diagram", "nodes", 4, "answers"],
      ["slots", "slot-4"],
    ],
    [
      ["diagram", "nodes", 4, "answers", 1, "objectives", 0],
      ["diagram", "nodes", 4, "answers", 1, "objectives"],
      ["slots", "slot-4"],
    ],
    [
      ["diagram", "nodes", 4, "answers", 1, "references", 2],
      ["diagram", "nodes", 4, "answers", 1, "references", 2],
      ["slots", "slot-4"],
    ],
    [
      ["diagram", "nodes", 4, "incorrect", 0, "violates", 1],
      ["diagram", "nodes", 4, "incorrect", 0, "violates"],
      ["slots", "slot-4"],
    ],
    [
      ["diagram", "nodes", 4, "answers", 1, "x"],
      ["diagram", "nodes", 4, "answers", 1],
      ["slots", "slot-4"],
    ],
  ])("%j → %j", (path, anchor, sections) => {
    expect(anchorOf(path, isSlot)).toEqual({ path: anchor, sections });
  });

  it.each([
    [[]],
    [["palette", "mode"]],
    [["references", 0]],
    [["diagram", "nodes", 1, "label"]],
    [["diagram", "edges", 0]],
  ])("%j has no field in the form", (path) => {
    expect(anchorOf(path, isSlot)).toBeUndefined();
  });
});
