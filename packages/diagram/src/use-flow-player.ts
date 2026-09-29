// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Flow player (RF-PLAY-03): walks the steps in order. With motion allowed it advances on its
// own; with prefers-reduced-motion it only advances when the player asks (next/previous).
import { useCallback, useEffect, useState } from "react";

/** Time each step stays highlighted while playing. */
export const STEP_DURATION_MS = 1800;

export interface FlowPlayer {
  /** Index of the highlighted step, or null when the player is stopped. */
  current: number | null;
  /** Advancing on its own. Never true with reduced motion. */
  playing: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
}

export const useFlowPlayer = (stepCount: number, autoAdvance: boolean): FlowPlayer => {
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const running = playing && autoAdvance && current !== null;

  useEffect(() => {
    if (!playing || !autoAdvance || current === null) return;
    const timer = setTimeout(() => {
      // After the last step it stops and keeps it highlighted.
      if (current + 1 >= stepCount) setPlaying(false);
      else setCurrent(current + 1);
    }, STEP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [playing, autoAdvance, current, stepCount]);

  const start = useCallback(() => {
    if (stepCount === 0) return;
    setCurrent(0);
    setPlaying(autoAdvance);
  }, [autoAdvance, stepCount]);
  const pause = useCallback(() => setPlaying(false), []);
  const resume = useCallback(() => {
    if (!autoAdvance) return;
    setCurrent((index) => (index === null || index + 1 >= stepCount ? 0 : index));
    setPlaying(true);
  }, [autoAdvance, stepCount]);
  const next = useCallback(() => {
    setPlaying(false);
    setCurrent((index) => (index === null ? 0 : Math.min(index + 1, stepCount - 1)));
  }, [stepCount]);
  const previous = useCallback(() => {
    setPlaying(false);
    setCurrent((index) => (index === null ? 0 : Math.max(index - 1, 0)));
  }, []);
  const stop = useCallback(() => {
    setPlaying(false);
    setCurrent(null);
  }, []);

  return { current, playing: running, start, pause, resume, next, previous, stop };
};
