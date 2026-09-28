// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ComponentCatalog } from "./component-catalog";

const root = document.getElementById("root");
if (root === null) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <ComponentCatalog />
  </StrictMode>,
);
