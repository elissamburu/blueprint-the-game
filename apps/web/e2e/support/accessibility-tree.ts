// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The accessibility tree the browser gives to assistive technologies, read through the DevTools
// protocol (Chromium): the accessible names are the ones the browser computed, not what a test
// would guess from the attributes.
import type { Page } from "@playwright/test";

interface AXValue {
  readonly value?: unknown;
}

interface AXNode {
  readonly nodeId: string;
  readonly ignored: boolean;
  readonly role?: AXValue;
  readonly name?: AXValue;
  readonly properties?: readonly { readonly name: string; readonly value: AXValue }[];
  readonly childIds?: readonly string[];
}

export interface Control {
  readonly role: string;
  readonly name: string;
}

const text = (value: AXValue | undefined): string =>
  typeof value?.value === "string" ? value.value : "";

const isFocusable = (node: AXNode): boolean =>
  node.properties?.some((p) => p.name === "focusable" && p.value.value === true) ?? false;

/**
 * Every interactive control (focusable, not hidden from assistive technologies) inside the
 * element with the given role and name, in tree order, with its role and accessible name.
 */
export const controlsInside = async (
  page: Page,
  container: { role: string; name: RegExp },
): Promise<Control[]> => {
  const session = await page.context().newCDPSession(page);
  try {
    const { nodes } = (await session.send("Accessibility.getFullAXTree")) as { nodes: AXNode[] };
    const byId = new Map(nodes.map((node) => [node.nodeId, node]));
    const root = nodes.find(
      (node) =>
        !node.ignored && text(node.role) === container.role && container.name.test(text(node.name)),
    );
    if (root === undefined) {
      throw new Error(`no ${container.role} named ${String(container.name)} in the tree`);
    }
    const controls: Control[] = [];
    const visit = (id: string) => {
      const node = byId.get(id);
      if (node === undefined) return;
      if (!node.ignored && isFocusable(node)) {
        controls.push({ role: text(node.role), name: text(node.name) });
      }
      node.childIds?.forEach(visit);
    };
    root.childIds?.forEach(visit);
    return controls;
  } finally {
    await session.detach();
  }
};
