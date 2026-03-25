import { Bell, Search, User } from "lucide-react";

export function TopNav() {
  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between max-w-[1440px] mx-auto">
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-semibold text-gray-900">AI Coach Platform</h1>
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="text-gray-900 font-medium">Dashboard</a>
            <a href="#" className="text-gray-600 hover:text-gray-900">My Sessions</a>
            <a href="#" className="text-gray-600 hover:text-gray-900">Analytics</a>
            <a href="#" className="text-gray-600 hover:text-gray-900">Resources</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Search className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          </button>
        </div>
      </div>
    </nav>
  );
}
