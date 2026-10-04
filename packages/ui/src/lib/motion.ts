// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Classes of each moment of docs/design/motion-spec.md (RF-PLAY-17), built on tw-animate-css with
// the --motion-* tokens of styles/motion.css. With reduced motion every moment is a 150 ms fade,
// without transform (docs/accesibilidad.md §3); the caller says which one it wants, from
// prefers-reduced-motion. Nothing loops and nothing lasts more than 1.4 s.

export type MotionMoment =
  /** A service lands on a slot (.placed-service). */
  | "settle"
  /** Result of a slot: the icon of the grade, or the whole grade label. */
  | "optimal"
  | "acceptable"
  | "incorrect"
  | "revealed"
  /** A floating card appears and leaves (.floating-feedback). */
  | "enter"
  | "exit"
  /** Trophy of the summary (.burst) and an achievement after it (.badge-medal). */
  | "celebrate"
  | "celebrateLate";

/** Marks what styles/motion.css flattens under prefers-reduced-motion as well. */
const ENTER = "motion-reducible animate-in fade-in";

const FULL: Record<MotionMoment, string> = {
  settle: `${ENTER} slide-in-from-top-[6px] zoom-in-96 duration-(--motion-duration-fast) ease-motion-out`,
  // The curve overshoots about 4 % on its way to 1.
  optimal: `${ENTER} zoom-in-60 duration-(--motion-duration-result) ease-motion-pop`,
  acceptable: `${ENTER} zoom-in-92 duration-(--motion-duration-base) ease-motion-out`,
  // Only a fade: an incorrect answer does not shake nor flash.
  incorrect: `${ENTER} duration-(--motion-duration-base) ease-motion-out`,
  revealed: `${ENTER} slide-in-from-bottom-[12px] duration-(--motion-duration-base) ease-motion-out`,
  enter: `${ENTER} slide-in-from-bottom-[12px] duration-(--motion-duration-base) ease-motion-out`,
  exit: "motion-reducible animate-out fade-out slide-out-to-bottom-[12px] duration-(--motion-duration-fast) ease-motion-in fill-mode-forwards",
  celebrate: "motion-badge",
  celebrateLate: "motion-badge-late",
};

const FADE_IN = "animate-in fade-in duration-(--motion-reduced-fade) ease-linear";
const FADE_OUT =
  "animate-out fade-out duration-(--motion-reduced-fade) ease-linear fill-mode-forwards";

/** Classes that play a moment once, or its fade when the user asked for reduced motion. */
export const motionClass = (moment: MotionMoment, reduced: boolean): string =>
  reduced ? (moment === "exit" ? FADE_OUT : FADE_IN) : FULL[moment];

/** Longest exit (ms), for whoever removes an element once it has left. */
export const EXIT_MS = 200;
