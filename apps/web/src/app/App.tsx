// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Routes (React Router, declarative mode). Every page is its own chunk; the layout is not.
import { TooltipProvider } from "@blueprint/ui/components/tooltip";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { AppLayout } from "./AppLayout";
import { RootRedirect } from "./RootRedirect";

const WelcomePage = lazy(() => import("../features/onboarding/WelcomePage"));
const ScenariosPage = lazy(() => import("../features/catalog-browse/ScenariosPage"));
const PlayPage = lazy(() => import("../features/play/PlayPage"));
const SummaryPage = lazy(() => import("../features/play/SummaryPage"));
const PrintPage = lazy(() => import("../features/play/PrintPage"));
const ProfilePage = lazy(() => import("../features/profile/ProfilePage"));
const AboutPage = lazy(() => import("../features/about/AboutPage"));
const NotFoundPage = lazy(() => import("./NotFoundPage"));
const AuthCallbackPage = lazy(() => import("../auth/AuthCallbackPage"));

/** Component catalog: development only, so the production build does not even emit it. */
const ComponentCatalog = import.meta.env.DEV
  ? lazy(() => import("../component-catalog").then((m) => ({ default: m.ComponentCatalog })))
  : null;
/** Boards of every scenario with sample states: development only, like the catalog. */
const DiagramPlayground = import.meta.env.DEV
  ? lazy(() => import("../dev/DiagramPlayground"))
  : null;

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<RootRedirect />} />
        <Route path="bienvenida" element={<WelcomePage />} />
        <Route path="escenarios" element={<ScenariosPage />} />
        <Route path="escenarios/:id" element={<PlayPage />} />
        <Route path="escenarios/:id/resumen" element={<SummaryPage />} />
        <Route path="escenarios/:id/imprimir" element={<PrintPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="acerca" element={<AboutPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        {DiagramPlayground !== null && <Route path="_diagrama" element={<DiagramPlayground />} />}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {ComponentCatalog !== null && (
        <Route
          path="_catalogo"
          element={
            <Suspense>
              <ComponentCatalog />
            </Suspense>
          }
        />
      )}
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <TooltipProvider>
        <AppRoutes />
      </TooltipProvider>
    </BrowserRouter>
  );
}
