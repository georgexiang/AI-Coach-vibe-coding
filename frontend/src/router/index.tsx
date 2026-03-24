import { createBrowserRouter } from "react-router-dom";

// Placeholder router - will be populated with auth guards and layouts in Task 2
export const router = createBrowserRouter([
  {
    path: "*",
    element: <div>Loading...</div>,
  },
]);
