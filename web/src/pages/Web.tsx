import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Home, BookOpen, PlayCircle, Bell, User, Search, LogOut, Menu, Bookmark } from "lucide-react";
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
  const initials = (profile?.name || localStorage.getItem("eduUsername") || "U").charAt(0).toUpperCase();

  const navItems = [
    { id: "home", label: "Home", icon: Home, path: "/dashboard" },
    { id: "courses", label: "Browse Courses", icon: BookOpen, path: "/dashboard/courses" },
    { id: "learning", label: "My Learning", icon: PlayCircle, path: "/dashboard/learning" },
    { id: "bookmarks", label: "Bookmarks", icon: Bookmark, path: "/dashboard/bookmarks" },
    { id: "notifications", label: "Notifications", icon: Bell, path: "/dashboard/notifications", badge: unreadCount },
    { id: "profile", label: "Profile", icon: User, path: "/dashboard/profile" },
  ] as const;

  const handleLogout = () => {
    logout(undefined, { onSettled: () => navigate("/login") });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    navigate(q ? `/dashboard/courses?search=${encodeURIComponent(q)}` : "/dashboard/courses");
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-card border-r border-border z-40 transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-accent/30">
            <img src={drLogo} alt="Dr. Salah" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-foreground">Dr. Salah Alzait</h1>
            <p className="text-[10px] text-foreground/50 font-medium">Medical Academy</p>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const active =
              location.pathname === item.path ||
              (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSidebarOpen(false);
                  navigate(item.path);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active ? "gradient-warm text-accent-foreground shadow-md" : "text-foreground/70 hover:bg-secondary"
                }`}
              >
                <item.icon size={18} />
                <span className="flex-1 text-left">{item.label}</span>
                {"badge" in item && item.badge ? (
                  <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-foreground/40 z-30 lg:hidden" />
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border px-5 lg:px-8 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-secondary">
            <Menu size={20} />
          </button>
          <form onSubmit={submitSearch} className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses..."
              className="w-full bg-secondary rounded-xl pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-primary/30 border border-transparent focus:border-primary/30"
            />
          </form>
          <button
            onClick={() => navigate("/dashboard/notifications")}
            className="relative w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center"
          >
            <Bell size={18} className="text-foreground" />
            {unreadCount > 0 && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />}
          </button>
          <button
            onClick={() => navigate("/dashboard/profile")}
            className="w-9 h-9 rounded-full gradient-warm flex items-center justify-center text-accent-foreground font-bold text-sm"
          >
            {initials}
          </button>
        </header>

        <div className="flex-1 p-5 lg:p-8">
          <AnimatePresence mode="wait">
            <Outlet />
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
