import { createBrowserRouter } from "react-router";
import Root from "./pages/Root";
import SessionHistory from "./pages/SessionHistory";
import PersonalReports from "./pages/PersonalReports";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: SessionHistory },
      { path: "reports", Component: PersonalReports },
    ],
  },
]);
