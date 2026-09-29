// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Test setup of the web app. The game screen tests render React Flow, @dnd-kit and axe; in the
// parallel suite they slow the other files down, so waits get a margin over the 1 s default.
import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 10_000 });
