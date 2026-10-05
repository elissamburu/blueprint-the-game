// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Routes of the Studio. A data router, so the editor can block leaving with unsaved changes
// (useBlocker).
import { TooltipProvider } from "@blueprint/ui/components/tooltip";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { EditorPage } from "../editor/EditorPage";
import { ScenarioListPage } from "../list/ScenarioListPage";
import { Layout } from "./Layout";

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <ScenarioListPage /> },
      { path: "escenarios/:id", element: <EditorPage /> },
      { path: "*", element: <ScenarioListPage /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}
