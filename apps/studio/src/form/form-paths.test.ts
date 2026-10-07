// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where an issue of the validation goes in the form (RF-STU-07): its field, or the closest group.
import { describe, expect, it } from "vitest";
import { anchorOf, errorId, fieldId, issuePath } from "./form-paths";

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
    [["diagram", "nodes", 2], ["diagram", "nodes", 2], ["nodes"]],
    [["diagram", "nodes", 2, "position", "x"], ["diagram", "nodes", 2, "position", "x"], ["nodes"]],
    [["diagram", "nodes", 2, "position"], ["diagram", "nodes", 2], ["nodes"]],
    [["diagram", "nodes", 1, "label"], ["diagram", "nodes", 1, "label"], ["nodes"]],
    [["diagram", "nodes", 1, "other"], ["diagram", "nodes", 1], ["nodes"]],
    [["diagram", "nodes"], ["diagram", "nodes"], ["nodes"]],
    [["diagram", "groups", 0, "rect", "w"], ["diagram", "groups", 0, "rect", "w"], ["groups"]],
    [["diagram", "groups", 0, "parent"], ["diagram", "groups", 0, "parent"], ["groups"]],
    [["diagram", "edges", 3, "step"], ["diagram", "edges", 3, "step"], ["edges"]],
    [["diagram", "edges", 3], ["diagram", "edges", 3], ["edges"]],
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
      ["diagram", "nodes", 4, "answers", 1, "analogyLimit", "text"],
      ["diagram", "nodes", 4, "answers", 1, "analogyLimit", "text"],
      ["slots", "slot-4"],
    ],
    [
      ["diagram", "nodes", 4, "answers", 1, "analogyLimit", "references", 0],
      ["diagram", "nodes", 4, "answers", 1, "analogyLimit", "references", 0],
      ["slots", "slot-4"],
    ],
    [
      ["diagram", "nodes", 4, "answers", 1, "analogyLimit", "references"],
      ["diagram", "nodes", 4, "answers", 1, "analogyLimit", "references"],
      ["slots", "slot-4"],
    ],
    [
      ["diagram", "nodes", 4, "answers", 1, "analogyLimit", "other"],
      ["diagram", "nodes", 4, "answers", 1, "analogyLimit"],
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

  it.each([[[]], [["palette", "mode"]], [["references", 0]], [["diagram", "canvas", "width"]]])(
    "%j has no field in the form",
    (path) => {
      expect(anchorOf(path, isSlot)).toBeUndefined();
    },
  );

  it("takes L021 to «Dónde se rompe la analogía» of its answer, and the rest to their path", () => {
    const answer = ["diagram", "nodes", 4, "answers", 1];
    expect(issuePath({ code: "L021", path: answer })).toEqual([...answer, "analogyLimit"]);
    expect(issuePath({ code: "L005", path: ["title"] })).toEqual(["title"]);
    expect(anchorOf(issuePath({ code: "L021", path: answer }), isSlot)).toEqual({
      path: [...answer, "analogyLimit"],
      sections: ["slots", "slot-4"],
    });
  });
});
