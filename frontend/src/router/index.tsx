import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute, AdminRoute, GuestRoute } from "./auth-guard";
import { UserLayout } from "@/components/layouts/user-layout";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { AuthLayout } from "@/components/layouts/auth-layout";
import LoginPage from "@/pages/login";
import UserDashboard from "@/pages/user/dashboard";
import ScenarioSelection from "@/pages/user/training";
import AdminDashboard from "@/pages/admin/dashboard";
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
          // Phase 2+: history, reports
        ],
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              { path: "dashboard", element: <AdminDashboard /> },
              // Phase 2+: users, hcp-profiles, scenarios, etc.
            ],
          },
        ],
      },
    ],
  },
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "*", element: <NotFound /> },
]);
