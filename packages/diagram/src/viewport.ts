// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Viewport when a board opens (RF-PLAY-11). Fitting a whole scenario into a small board leaves the
// slot texts unreadable, so the opening zoom never goes below MIN_INITIAL_ZOOM: if the diagram
// does not fit at that zoom, the board opens at its top-left corner, with the start of the flow in
// view, and the rest is reached by panning. "Ajustar a pantalla" still fits down to MIN_ZOOM.
import type { Diagram } from "@blueprint/scenario-schema";
import { nodeBox, type Box } from "./geometry";

export const MIN_INITIAL_ZOOM = 0.8;
/** Margin (px on screen) the anchored view keeps around the content and the anchor node. */
export const ANCHOR_MARGIN = 24;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** Zoom that fits `bounds` in `size`, as React Flow's fitBounds computes it. */
export const fitZoom = (
  bounds: Pick<Box, "w" | "h">,
  size: Size,
  padding: number,
  minZoom: number,
  maxZoom: number,
): number => {
  const zoom = Math.min(
    size.width / (bounds.w * (1 + padding)),
    size.height / (bounds.h * (1 + padding)),
  );
  return Math.min(maxZoom, Math.max(minZoom, zoom));
};

/** Box around every group and node of the diagram (canvas units). */
export const contentBox = (diagram: Pick<Diagram, "groups" | "nodes" | "canvas">): Box => {
  const boxes = [...diagram.groups.map((g) => g.rect), ...diagram.nodes.map(nodeBox)];
  if (boxes.length === 0) return { x: 0, y: 0, w: diagram.canvas.width, h: diagram.canvas.height };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
};

/**
 * Node the anchored view keeps in sight: the source of the first step of the flow or, without
 * edges, the first actor or external system. Null when there is neither.
 */
export const anchorNode = (diagram: Pick<Diagram, "nodes" | "edges">): Box | null => {
  const first = [...diagram.edges].sort((a, b) => a.step - b.step)[0];
  const node =
    diagram.nodes.find((n) => n.id === first?.from) ??
    diagram.nodes.find((n) => n.type === "actor" || n.type === "external");
  return node === undefined ? null : nodeBox(node);
};

export type InitialView =
  { readonly kind: "fit" } | { readonly kind: "anchored"; viewport: Viewport };

/**
 * `fit` when fitting the canvas gives at least MIN_INITIAL_ZOOM (the board fits it as the reset
 * button does). Otherwise, MIN_INITIAL_ZOOM with the top-left corner of the content at the
 * top-left of the board, shifted only as needed to keep the anchor node in view.
 */
export const initialView = (
  diagram: Pick<Diagram, "canvas" | "groups" | "nodes" | "edges">,
  size: Size,
  options: { padding: number; minZoom: number; maxZoom: number },
): InitialView => {
  const canvas = { w: diagram.canvas.width, h: diagram.canvas.height };
  const zoom = fitZoom(canvas, size, options.padding, options.minZoom, options.maxZoom);
  if (zoom >= MIN_INITIAL_ZOOM) return { kind: "fit" };

  const initialZoom = Math.min(MIN_INITIAL_ZOOM, options.maxZoom);
  const content = contentBox(diagram);
  let x = ANCHOR_MARGIN - content.x * initialZoom;
  let y = ANCHOR_MARGIN - content.y * initialZoom;
  const anchor = anchorNode(diagram);
  if (anchor !== null) {
    const right = (anchor.x + anchor.w) * initialZoom + x;
    const bottom = (anchor.y + anchor.h) * initialZoom + y;
    if (right > size.width - ANCHOR_MARGIN) x -= right - (size.width - ANCHOR_MARGIN);
    if (bottom > size.height - ANCHOR_MARGIN) y -= bottom - (size.height - ANCHOR_MARGIN);
  }
  return { kind: "anchored", viewport: { x, y, zoom: initialZoom } };
};

/** Zoom buttons move in 25 % steps (docs/design, problem 27). */
export const ZOOM_STEP = 0.25;
/** Rounding slack: React Flow zooms land on values like 0.7499999. */
const EPSILON = 1e-6;

/**
 * Next zoom of the + and − buttons: the next multiple of ZOOM_STEP in that direction, so an
 * opening zoom of 80 % goes to 100 % or 75 %, clamped to [minZoom, maxZoom].
 */
export const steppedZoom = (
  zoom: number,
  direction: 1 | -1,
  minZoom: number,
  maxZoom: number,
): number => {
  const next =
    direction === 1
      ? (Math.floor(zoom / ZOOM_STEP + EPSILON) + 1) * ZOOM_STEP
      : (Math.ceil(zoom / ZOOM_STEP - EPSILON) - 1) * ZOOM_STEP;
  return Math.min(maxZoom, Math.max(minZoom, next));
};
