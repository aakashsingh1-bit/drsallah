import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Home,
  BookOpen,
  PlayCircle,
  Bell,
  User,
  Search,
  LogOut,
  Menu,
  Bookmark,
  X,
} from "lucide-react";
import drLogo from "@/assets/dr-logo.png";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useGetProfile, useLogout } from "@/hooks/userAuthHooks";
import { useGetNotifications } from "@/hooks/useApi";

export default function WebApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { data: profile } = useGetProfile();
  const { data: notificationsData } = useGetNotifications();
  const { mutate: logout } = useLogout();

  const unreadCount = notificationsData?.unreadCount || 0;
  const initials = (profile?.name || localStorage.getItem("eduUsername") || "U")
    .charAt(0)
    .toUpperCase();

  const navItems = [
    { id: "home", label: "Home", icon: Home, path: "/dashboard", mobile: true },
    { id: "courses", label: "Courses", icon: BookOpen, path: "/dashboard/courses", mobile: true },
    { id: "learning", label: "Learning", icon: PlayCircle, path: "/dashboard/learning", mobile: true },
    { id: "bookmarks", label: "Bookmarks", icon: Bookmark, path: "/dashboard/bookmarks", mobile: false },
    {
      id: "notifications",
      label: "Alerts",
      icon: Bell,
      path: "/dashboard/notifications",
      badge: unreadCount,
      mobile: false,
    },
    { id: "profile", label: "Profile", icon: User, path: "/dashboard/profile", mobile: true },
  ] as const;

  const handleLogout = () => {
    logout(undefined, { onSettled: () => navigate("/login") });
  };

  const go = (path: string) => {
    setSidebarOpen(false);
    navigate(path);
  };

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/dashboard" && location.pathname.startsWith(path));

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/dashboard/courses?search=${encodeURIComponent(q)}` : "/dashboard/courses");
  };

  const NavButton = ({
    item,
    compact = false,
  }: {
    item: (typeof navItems)[number];
    compact?: boolean;
  }) => {
    const active = isActive(item.path);
    return (
      <button
        type="button"
        onClick={() => go(item.path)}
        className={`w-full flex items-center gap-3 rounded-xl text-sm font-semibold transition-all ${
          compact ? "flex-col gap-1 px-1 py-2" : "px-3 py-2.5"
        } ${
          active
            ? compact
              ? "text-primary"
              : "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground/60 hover:bg-secondary hover:text-foreground"
        }`}
      >
        <span className="relative">
          <item.icon size={compact ? 22 : 18} strokeWidth={active ? 2.4 : 2} />
          {"badge" in item && item.badge ? (
            <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          ) : null}
        </span>
        <span className={`flex-1 text-left ${compact ? "flex-none text-[10px] font-bold" : ""}`}>
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-screen w-[260px] shrink-0 bg-card border-r border-border flex-col">
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl overflow-hidden border border-border shadow-sm">
            <img src={drLogo} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-foreground truncate">Dr. Salah Alzait</h1>
            <p className="text-[11px] text-foreground/45 font-medium">Medical Academy</p>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-[280px] max-w-[85vw] bg-card border-r border-border z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-border">
              <img src={drLogo} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold truncate">Dr. Salah Alzait</p>
              <p className="text-[10px] text-foreground/45">Medical Academy</p>
            </div>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-secondary">
            <X size={18} />
          </button>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavButton key={item.id} item={item} />
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/40 z-40 backdrop-blur-[2px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 flex flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-md border-b border-border px-3 sm:px-5 lg:px-8 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-secondary shrink-0"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <form onSubmit={submitSearch} className="relative flex-1 min-w-0 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses..."
              className="w-full bg-secondary/80 rounded-full pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-primary/25 border border-transparent focus:border-primary/20"
            />
          </form>

          <button
            type="button"
            onClick={() => navigate("/dashboard/notifications")}
            className="relative w-10 h-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center shrink-0"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-card" />
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard/profile")}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0 shadow-sm"
            aria-label="Profile"
          >
            {initials}
          </button>
        </header>

        <div className="flex-1 px-3 sm:px-5 lg:px-8 py-4 sm:py-6 max-w-6xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <Outlet />
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-4 gap-0.5 max-w-lg mx-auto">
          {navItems
            .filter((i) => i.mobile)
            .map((item) => (
              <NavButton key={item.id} item={item} compact />
            ))}
        </div>
      </nav>
    </div>
  );
}
