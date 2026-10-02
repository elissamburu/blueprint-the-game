// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Size of the diagram on the printable page (RF-PLAY-16). Printing does not re-fit React Flow, so
// the picture has a fixed size in CSS px that fits the printable area of an A4 sheet, portrait by
// default. A diagram that would be too small to read across a portrait sheet goes on a landscape
// sheet, when that sheet draws it bigger. Pure: the page only applies the result.
import type { Diagram } from "@blueprint/scenario-schema";
import { contentBox } from "./viewport";

/** CSS px per millimetre (96 px per inch). */
const PX_PER_MM = 96 / 25.4;
/** Margin of the printed sheet (the page uses the same value in its @page rules). */
export const PRINT_MARGIN_MM = 12;
const A4 = { short: 210, long: 297 };

export type PrintOrientation = "portrait" | "landscape";

/**
 * Room the diagram can take on its sheet (CSS px): the printable width, and the height that
 * leaves room above it for the heading and below it for the steps of the flow.
 */
export const PRINT_AREA: Record<PrintOrientation, { width: number; height: number }> = {
  portrait: {
    width: Math.floor((A4.short - 2 * PRINT_MARGIN_MM) * PX_PER_MM),
    height: 620,
  },
  landscape: {
    width: Math.floor((A4.long - 2 * PRINT_MARGIN_MM) * PX_PER_MM),
    height: 430,
  },
};

/**
 * Below this zoom the names of the nodes (11 px on the canvas) print under ~3.7 pt: the sheet turns
 * landscape if that draws the diagram bigger. Slot numbers and step circles are drawn bigger for
 * print, so they stay readable at it. A portrait sheet keeps the steps of the flow under the
 * diagram, which a landscape one has no room for: content up to ~1500 canvas units wide (every
 * scenario so far) prints portrait.
 */
export const MIN_PRINT_ZOOM = 0.45;
/** Room around the content, as a fraction of its size (as the fit of the board). */
export const PRINT_PADDING = 0.04;

export interface PrintLayout {
  orientation: PrintOrientation;
  /** Size of the picture in CSS px. */
  width: number;
  height: number;
  zoom: number;
}

const zoomIn = (
  area: { width: number; height: number },
  content: { w: number; h: number },
): number =>
  Math.min(
    1,
    area.width / (content.w * (1 + PRINT_PADDING)),
    area.height / (content.h * (1 + PRINT_PADDING)),
  );

export const printLayout = (diagram: Pick<Diagram, "canvas" | "groups" | "nodes">): PrintLayout => {
  const content = contentBox(diagram);
  const portrait = zoomIn(PRINT_AREA.portrait, content);
  const landscape = zoomIn(PRINT_AREA.landscape, content);
  const orientation: PrintOrientation =
    portrait < MIN_PRINT_ZOOM && landscape > portrait ? "landscape" : "portrait";
  const zoom = orientation === "portrait" ? portrait : landscape;
  return {
    orientation,
    width: Math.floor(content.w * (1 + PRINT_PADDING) * zoom),
    height: Math.floor(content.h * (1 + PRINT_PADDING) * zoom),
    zoom,
  };
};
