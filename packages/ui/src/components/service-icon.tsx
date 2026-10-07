// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Icon of a catalog service. The official AWS icons are downloaded by pnpm icons:fetch and are
// not committed (ADR-0012), so any icon may be missing: when the image does not load (or there
// is no src) it shows the service initials over its category color. The initials are 12 px
// (0.75rem), the minimum for short labels (docs/design, problem 28); on the board the caller sets
// them in px, as the rest of the board text. A concept (ADR-0027 §1) has no official icon: with a
// glyph it draws its lucide icon in currentColor, in the same box; without one, its initials.
// Lovable: .service-icon and .service-icon-fallback + .service-icon-<tone> (src/styles.css).
import type { ConceptGlyph } from "@blueprint/scenario-schema";
import { useState } from "react";
import type * as React from "react";
import { CONCEPT_GLYPH_ICONS } from "@blueprint/ui/lib/concept-glyphs";
import { cn } from "@blueprint/ui/lib/utils";

/**
 * Fallback colors from the prototype. Its integration, data and AI tones use --chart-2..4,
 * which the v1 tokens do not have, so those categories use the neutral tone.
 */
const TONES = {
  network: "bg-blueprint-soft text-primary",
  storage: "bg-success-soft text-success",
  compute: "bg-warning-soft text-warning",
  security: "bg-danger-soft text-destructive",
  default: "bg-muted text-muted-foreground",
} as const;

export type ServiceIconTone = keyof typeof TONES;

/** Catalog category id (content/catalog/categories.yaml) → fallback tone. */
const CATEGORY_TONES: Readonly<Record<string, ServiceIconTone>> = {
  "networking-content-delivery": "network",
  storage: "storage",
  compute: "compute",
  containers: "compute",
  "security-identity": "security",
};

export const categoryTone = (category: string): ServiceIconTone =>
  CATEGORY_TONES[category] ?? "default";

/**
 * Up to three characters: the first letter of each word ("API Gateway" → "AG"), numbers kept
 * whole ("Route 53" → "R53"), or the first three characters of a single word ("EventBridge" →
 * "EVE"). A leading "Amazon"/"AWS" is ignored.
 */
export const serviceInitials = (name: string): string => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word, index, all) => !(index === 0 && all.length > 1 && /^(Amazon|AWS)$/.test(word)));
  const initials =
    words.length === 1
      ? (words[0] ?? "").slice(0, 3)
      : words.map((word) => (/^\d+$/.test(word) ? word : word.charAt(0))).join("");
  return initials.slice(0, 3).toUpperCase();
};

export type ServiceIconProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** URL of the icon (apps/web: icons/<serviceId>.svg). Without it, shows the fallback. */
  src?: string | undefined;
  /** Glyph of a concept: drawn instead of `src`, which a concept never has. */
  glyph?: ConceptGlyph | undefined;
  /** Service name: alternative text and source of the initials. */
  name: string;
  /** Catalog category id: color of the fallback. */
  category: string;
  /**
   * The service name is already shown next to the icon: the image gets alt="" (and the
   * fallback aria-hidden) so screen readers do not read the name twice.
   */
  decorative?: boolean;
};

function ServiceIcon({
  src,
  glyph,
  name,
  category,
  decorative = false,
  className,
  ...props
}: ServiceIconProps) {
  // Remembers which src failed, so a new src is tried again without an effect.
  const [failedSrc, setFailedSrc] = useState<string>();
  const Glyph = glyph === undefined ? undefined : CONCEPT_GLYPH_ICONS[glyph];
  const showImage = Glyph === undefined && src !== undefined && failedSrc !== src;
  const fallbackA11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img", "aria-label": name };

  return (
    <span
      data-slot="service-icon"
      data-fallback={showImage || Glyph !== undefined ? undefined : ""}
      data-glyph={Glyph === undefined ? undefined : glyph}
      className={cn(
        "inline-grid size-8 flex-none place-items-center overflow-hidden rounded-md",
        !showImage && [
          "border border-current/22 text-[0.75rem] font-[850]",
          TONES[categoryTone(category)],
        ],
        className,
      )}
      {...(showImage ? {} : fallbackA11y)}
      {...props}
    >
      {Glyph !== undefined ? (
        <Glyph aria-hidden className="size-[62.5%]" />
      ) : showImage ? (
        <img
          src={src}
          alt={decorative ? "" : name}
          className="size-full object-contain"
          draggable={false}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        serviceInitials(name)
      )}
    </span>
  );
}

export { ServiceIcon };
