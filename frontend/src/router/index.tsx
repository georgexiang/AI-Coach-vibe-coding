import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute, AdminRoute, GuestRoute } from "./auth-guard";
import { UserLayout } from "@/components/layouts/user-layout";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { AuthLayout } from "@/components/layouts/auth-layout";
import LoginPage from "@/pages/login";
import UserDashboard from "@/pages/user/dashboard";
import ScenarioSelection from "@/pages/user/training";
import AdminDashboard from "@/pages/admin/dashboard";
import HcpProfilesPage from "@/pages/admin/hcp-profiles";
import ScenariosPage from "@/pages/admin/scenarios";
import AzureConfigPage from "@/pages/admin/azure-config";
import ScoringFeedback from "@/pages/user/scoring-feedback";
import SessionHistory from "@/pages/user/session-history";
import TrainingSession from "@/pages/user/training-session";
import ScoringRubricsPage from "@/pages/admin/scoring-rubrics";
import TrainingMaterialsPage from "@/pages/admin/training-materials";
import AdminReportsPage from "@/pages/admin/reports";
import ConferenceSession from "@/pages/user/conference-session";
import VoiceSession from "@/pages/user/voice-session";
import UserReportsPage from "@/pages/user/reports";
import UserManagementPage from "@/pages/admin/users";
import AdminSettingsPage from "@/pages/admin/settings";
import NotFound from "@/pages/not-found";

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [{ path: "/login", element: <LoginPage /> }],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/user",
        element: <UserLayout />,
        children: [
          { path: "dashboard", element: <UserDashboard /> },
          { path: "training", element: <ScenarioSelection /> },
          { path: "scoring/:sessionId", element: <ScoringFeedback /> },
          { path: "history", element: <SessionHistory /> },
          { path: "reports", element: <UserReportsPage /> },
        ],
      },
      {
        path: "/user/training/session",
        element: <TrainingSession />,
      },
      {
        path: "/user/training/conference",
        element: <ConferenceSession />,
      },
      {
        path: "/user/training/voice",
        element: <VoiceSession />,
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              { path: "dashboard", element: <AdminDashboard /> },
              { path: "hcp-profiles", element: <HcpProfilesPage /> },
              { path: "scenarios", element: <ScenariosPage /> },
              { path: "azure-config", element: <AzureConfigPage /> },
              { path: "scoring-rubrics", element: <ScoringRubricsPage /> },
              { path: "materials", element: <TrainingMaterialsPage /> },
              { path: "reports", element: <AdminReportsPage /> },
              { path: "users", element: <UserManagementPage /> },
              { path: "settings", element: <AdminSettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <NotFound /> },
]);
