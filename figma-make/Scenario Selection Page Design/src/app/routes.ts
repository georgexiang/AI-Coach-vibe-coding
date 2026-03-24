import { createBrowserRouter } from "react-router";
import Login from "./pages/Login";
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";
import UserDashboard from "./pages/user/Dashboard";
import UserTraining from "./pages/user/Training";
import UserHistory from "./pages/user/History";
import UserReports from "./pages/user/Reports";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminHCPProfiles from "./pages/admin/HCPProfiles";
import AdminScenarios from "./pages/admin/Scenarios";
import AdminMaterials from "./pages/admin/Materials";
import AdminReportsPage from "./pages/admin/Reports";
import AdminAzureServices from "./pages/admin/AzureServices";
import AdminSettings from "./pages/admin/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Login,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/user",
    Component: UserLayout,
    children: [
      { index: true, Component: UserDashboard },
      { path: "dashboard", Component: UserDashboard },
      { path: "training", Component: UserTraining },
      { path: "history", Component: UserHistory },
      { path: "reports", Component: UserReports },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "dashboard", Component: AdminDashboard },
      { path: "users", Component: AdminUsers },
      { path: "hcp-profiles", Component: AdminHCPProfiles },
      { path: "scenarios", Component: AdminScenarios },
      { path: "materials", Component: AdminMaterials },
      { path: "reports", Component: AdminReportsPage },
      { path: "azure-services", Component: AdminAzureServices },
      { path: "settings", Component: AdminSettings },
    ],
  },
]);
