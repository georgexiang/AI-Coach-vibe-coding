import { useLocation, Outlet } from "react-router-dom";

/**
 * Wraps the route Outlet with a fade-in animation.
 * The `key` prop forces React to re-mount when the route changes,
 * triggering the `page-fade-in` CSS animation defined in index.css.
 */
export function PageTransition() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-transition">
      <Outlet />
    </div>
  );
}
