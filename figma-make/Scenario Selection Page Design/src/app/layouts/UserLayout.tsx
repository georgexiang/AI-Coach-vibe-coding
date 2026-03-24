import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { Bell, Menu, X, ChevronDown, LogOut } from 'lucide-react';

type Language = 'zh' | 'en';

export default function UserLayout() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>('en');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const handleLogout = () => {
    navigate('/login');
  };

  const text = {
    en: {
      dashboard: 'Dashboard',
      training: 'Training',
      history: 'History',
      reports: 'Reports',
      logout: 'Logout',
      copyright: '© 2026 AI Coach Platform',
    },
    zh: {
      dashboard: '仪表盘',
      training: '培训',
      history: '历史',
      reports: '报告',
      logout: '退出',
      copyright: '© 2026 AI 教练平台',
    },
  };

  const t = text[language];

  const navLinks = [
    { to: '/user/dashboard', label: t.dashboard },
    { to: '/user/training', label: t.training },
    { to: '/user/history', label: t.history },
    { to: '/user/reports', label: t.reports },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm h-16 fixed top-0 left-0 right-0 z-50">
        <div className="h-full px-4 lg:px-6 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">AI Coach</span>
          </div>

          {/* Center: Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-4">
            {/* Language Switcher (Desktop) */}
            <button
              onClick={toggleLanguage}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition"
            >
              <span>{language === 'zh' ? '🇨🇳' : '🇬🇧'}</span>
              <span className="text-sm">{language === 'zh' ? '中文' : 'English'}</span>
            </button>

            {/* Notification Bell */}
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-2 transition"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">JD</span>
                </div>
                <span className="hidden md:block text-sm font-medium text-gray-700">John Doe</span>
                <ChevronDown className="hidden md:block w-4 h-4 text-gray-500" />
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.logout}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
            <nav className="px-4 py-4 space-y-2">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <button
                onClick={toggleLanguage}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
              >
                <span>{language === 'zh' ? '🇨🇳' : '🇬🇧'}</span>
                <span className="text-sm">{language === 'zh' ? '中文' : 'English'}</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="px-4 lg:px-6 text-center text-sm text-gray-600">
          {t.copyright}
        </div>
      </footer>
    </div>
  );
}
