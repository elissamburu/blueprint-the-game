// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The shared files (catalog, game-rules, …) for the live validation, loaded once per page load.
import { useEffect, useState } from "react";
import type { SharedContent } from "../../shared/api";
import { api, ApiError } from "../api/client";

let cache: Promise<SharedContent> | undefined;

export const useSharedContent = (): { shared?: SharedContent; error?: string } => {
  const [state, setState] = useState<{ shared?: SharedContent; error?: string }>({});
  useEffect(() => {
    let active = true;
    cache ??= api.getShared();
    cache.then(
      (shared) => active && setState({ shared }),
      (error: unknown) => {
        cache = undefined;
        if (active) setState({ error: error instanceof ApiError ? error.message : String(error) });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
};
