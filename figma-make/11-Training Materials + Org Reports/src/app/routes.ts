import { createBrowserRouter } from "react-router";
import AdminLayout from "./components/AdminLayout";
import TrainingMaterials from "./pages/TrainingMaterials";
import OrganizationReports from "./pages/OrganizationReports";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AdminLayout,
    children: [
      { index: true, Component: TrainingMaterials },
      { path: "reports", Component: OrganizationReports },
    ],
  },
]);
