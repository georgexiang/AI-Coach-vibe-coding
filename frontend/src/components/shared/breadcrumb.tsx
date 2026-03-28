import { useLocation, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface BreadcrumbProps {
  title?: string;
}

/**
 * Context-dependent breadcrumb component.
 *
 * - Top-level pages: renders page title only
 * - Drill-down pages: renders Parent > Current trail
 * - Training session pages: returns null (full-screen immersive)
 */
export function Breadcrumb({ title }: BreadcrumbProps) {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Training session pages — full-screen immersive, no breadcrumb
  const immersivePaths = [
    "/user/training/session",
    "/user/training/conference",
    "/user/training/voice",
  ];
  if (immersivePaths.some((p) => location.pathname.startsWith(p))) {
    return null;
  }

  // Format a segment into a readable label
  const formatSegment = (segment: string): string => {
    return segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Top-level pages (depth <= 2, e.g., /admin/dashboard or /user/dashboard)
  if (segments.length <= 2) {
    const pageTitle = title ?? formatSegment(segments[segments.length - 1] ?? "");
    return (
      <h2 className="text-xl font-medium text-foreground">{pageTitle}</h2>
    );
  }

  // Drill-down pages (depth > 2, e.g., /user/scoring/abc123)
  const parentSegments = segments.slice(0, -1);
  const parentPath = `/${parentSegments.join("/")}`;
  const parentLabel = formatSegment(parentSegments[parentSegments.length - 1] ?? "");
  const currentLabel = title ?? formatSegment(segments[segments.length - 1] ?? "");

  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <Link
        to={parentPath}
        className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        {parentLabel}
      </Link>
      <ChevronRight className="size-3.5 text-muted-foreground" />
      <span className="font-medium text-foreground">{currentLabel}</span>
    </nav>
  );
}
