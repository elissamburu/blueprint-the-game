// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Name of a node or group on the printed diagram (RF-PLAY-16): at the size printLayout computes,
// wrapped in two lines at most, never inside a word and never past its box. A name that does not
// fit that way shrinks, alone, down to its minimum (6 pt printed). Sizes in canvas px.
import { cn } from "@blueprint/ui/lib/utils";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const LINE_HEIGHT = 1.15;
const MAX_LINES = 2;
/** Step of the shrinking, in canvas px. */
const STEP = 0.25;

export interface FitLabelProps {
  text: string;
  size: number;
  min: number;
  /** Area of fixed height the name must not overflow (its width is the one of the name). */
  boxRef?: RefObject<HTMLElement | null> | undefined;
  /** Shrink to stay in one line before wrapping to two (a group label over its content). */
  oneLineFirst?: boolean | undefined;
  className?: string | undefined;
}

export function FitLabel({
  text,
  size,
  min,
  boxRef,
  oneLineFirst = false,
  className,
}: FitLabelProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fitted, setFitted] = useState(size);
  useLayoutEffect(() => {
    const label = ref.current;
    if (label === null) return;
    const box = boxRef?.current ?? null;
    const fits = (fontSize: number, maxLines = MAX_LINES) => {
      label.style.fontSize = `${fontSize}px`;
      const lines = label.scrollHeight / (fontSize * LINE_HEIGHT);
      return (
        lines <= maxLines + 0.25 &&
        label.scrollWidth <= label.clientWidth + 0.5 &&
        (box === null || label.offsetHeight <= box.clientHeight + 0.5)
      );
    };
    let current = size;
    if (oneLineFirst) {
      while (current - STEP >= min && !fits(current, 1)) current -= STEP;
      if (!fits(current, 1)) current = size;
    }
    while (current - STEP >= min && !fits(current)) current -= STEP;
    if (!fits(current)) current = min;
    label.style.fontSize = `${current}px`;
    setFitted(current);
  }, [text, size, min, boxRef, oneLineFirst]);
  return (
    <span
      ref={ref}
      data-fit-label=""
      style={{ fontSize: fitted, lineHeight: LINE_HEIGHT }}
      // Words never break: a word that does not fit makes the name shrink instead.
      className={cn("block max-w-full [overflow-wrap:normal] break-normal hyphens-none", className)}
    >
      {text}
    </span>
  );
}
