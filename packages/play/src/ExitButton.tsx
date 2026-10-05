// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The back arrow of the game bar and the brief (GameHost.exit): a link to a route of the app's
// router or, without `href`, a button.
import { Button } from "@blueprint/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import { Link } from "react-router";
import type { GameHost } from "./host";

export function ExitButton({ exit }: { exit: GameHost["exit"] }) {
  if (exit.href === undefined) {
    return (
      <Button variant="ghost" size="icon" aria-label={exit.label} onClick={() => exit.onExit?.()}>
        <ArrowLeftIcon aria-hidden />
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost" size="icon">
      <Link to={exit.href} aria-label={exit.label} onClick={() => exit.onExit?.()}>
        <ArrowLeftIcon aria-hidden />
      </Link>
    </Button>
  );
}
