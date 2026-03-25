import { Link, Outlet, useLocation } from "react-router";
import { BarChart3, History } from "lucide-react";

export default function Root() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex h-16 items-center gap-8">
            <div className="text-xl font-semibold text-gray-900">AI Coach</div>
            <div className="flex gap-1">
              <Link
                to="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  location.pathname === "/"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <History className="w-4 h-4" />
                Training History
              </Link>
              <Link
                to="/reports"
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  location.pathname === "/reports"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Performance Report
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
