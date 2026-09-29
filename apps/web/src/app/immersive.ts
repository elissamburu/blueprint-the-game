// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Immersive pages (the game screen): the layout hides the global header and footer and gives the
// page the whole viewport height, without page scroll. The page asks for it while it is mounted.
import { createContext, useContext, useEffect } from "react";

export const ImmersiveContext = createContext<(immersive: boolean) => void>(() => {});

/** While the calling component is mounted, the layout has no header nor footer. */
export const useImmersiveLayout = (): void => {
  const setImmersive = useContext(ImmersiveContext);
  useEffect(() => {
    setImmersive(true);
    return () => setImmersive(false);
  }, [setImmersive]);
};
