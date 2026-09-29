// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Layout modes a page can ask for while it is mounted:
// - `immersive` (the game screen): no header nor footer, the whole viewport height, no page scroll;
// - `standalone` (the onboarding, captura 00): no global header, since the page has its own brand
//   and the player has nowhere to navigate yet; the footer stays.
import { createContext, useContext, useEffect } from "react";

export type LayoutMode = "default" | "immersive" | "standalone";

export const ImmersiveContext = createContext<(mode: LayoutMode) => void>(() => {});

const useLayoutMode = (mode: LayoutMode): void => {
  const setMode = useContext(ImmersiveContext);
  useEffect(() => {
    setMode(mode);
    return () => setMode("default");
  }, [setMode, mode]);
};

/** While the calling component is mounted, the layout has no header nor footer. */
export const useImmersiveLayout = (): void => useLayoutMode("immersive");

/** While the calling component is mounted, the layout has no global header. */
export const useStandaloneLayout = (): void => useLayoutMode("standalone");
