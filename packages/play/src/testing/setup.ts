// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Test setup of the package: the texts of the play namespace, and waits with a margin over the
// 1 s default (Radix popovers and the board are slow in jsdom while turbo runs every suite).
import { configure } from "@testing-library/react";
import "./i18n";

configure({ asyncUtilTimeout: 10_000 });
