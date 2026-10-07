// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Icons of the concepts, which have no official AWS icon (ADR-0027 §1): each value of the closed
// CONCEPT_GLYPHS enum of @blueprint/scenario-schema maps to a lucide-react icon. Named imports, so
// the bundle only carries these twelve icons.
import type { ConceptGlyph } from "@blueprint/scenario-schema";
import {
  Building2Icon,
  ClipboardCheckIcon,
  GlobeIcon,
  HandshakeIcon,
  LayersIcon,
  LifeBuoyIcon,
  MapPinIcon,
  PiggyBankIcon,
  RadioTowerIcon,
  ReceiptIcon,
  ScalingIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";

export const CONCEPT_GLYPH_ICONS: Readonly<Record<ConceptGlyph, LucideIcon>> = {
  region: MapPinIcon,
  "availability-zone": Building2Icon,
  "edge-location": RadioTowerIcon,
  "global-network": GlobeIcon,
  "shared-responsibility": HandshakeIcon,
  "pay-as-you-go": ReceiptIcon,
  savings: PiggyBankIcon,
  elasticity: ScalingIcon,
  "high-availability": LayersIcon,
  "fault-tolerance": LifeBuoyIcon,
  security: ShieldCheckIcon,
  compliance: ClipboardCheckIcon,
};
