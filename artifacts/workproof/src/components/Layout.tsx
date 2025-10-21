import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, Building2, FileText, CheckSquare, Folder,
  Clock, GraduationCap, Award, Calendar, Shield, Brain, MessageSquare, ShieldCheck,
  ChevronLeft, ChevronRight, LogOut, Menu, X, Bell, Check, CalendarCheck, Video, GitMerge, FileCheck, Star
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/departments", label: "Departments", icon: Building2 },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/projects", label: "Projects", icon: Folder },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/leaves", label: "Leave Requests", icon: CalendarCheck },
  { href: "/trainings", label: "Training Ledger", icon: FileText },
  { href: "/recognitions", label: "Recognitions", icon: Award },
  { href: "/meetings", label: "Meetings", icon: Calendar },
  { href: "/audit-log", label: "Audit Log", icon: Shield },
  { href: "/verifications", label: "Proof-of-Work", icon: ShieldCheck },
  { href: "/chat", label: "Messages", icon: MessageSquare },
  { href: "/ml-api", label: "ML API", icon: Brain },
];

function roleLabel(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function initials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await customFetch("/api/v1/notifications") as Response;
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000 // Poll every 30s
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const markAsRead = async (id: number) => {
    await customFetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const sidebar = (
    <div className={`flex flex-col h-full bg-[hsl(222,47%,8%)] border-r border-[hsl(217,32%,17%)] transition-all duration-200 ${collapsed ? "w-16" : "w-56"}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[hsl(217,32%,17%)]">
        <div className="w-8 h-8 rounded-lg bg-[hsl(186,100%,42%)] flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-black" />
        </div>
        {!collapsed && <span className="font-bold text-sm tracking-widest text-white uppercase">WorkLens</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group ${
                active
                  ? "bg-[hsl(186,100%,42%)/15%] text-[hsl(186,100%,42%)] font-medium"
                  : "text-[hsl(215,20%,65%)] hover:text-white hover:bg-[hsl(217,32%,17%)]"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User & Notifications */}
      <div className="border-t border-[hsl(217,32%,17%)] px-3 py-3">
        <div className={`flex items-center gap-2 mb-3 ${collapsed ? "justify-center" : "justify-between px-1"}`}>
          {!collapsed && <span className="text-xs font-semibold text-[hsl(215,20%,55%)] uppercase tracking-wide">Account</span>}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="text-[hsl(215,20%,55%)] hover:text-white transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-[hsl(222,47%,11%)]"></span>
              )}
            </button>
            
            {showNotifications && !collapsed && (
              <div className="absolute bottom-full left-0 mb-2 w-72 bg-[hsl(222,47%,13%)] border border-[hsl(217,32%,17%)] rounded-xl shadow-2xl overflow-hidden z-50">
                <div className="p-3 border-b border-[hsl(217,32%,17%)] flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Notifications</span>
                  <span className="text-[10px] bg-[hsl(186,100%,42%)/20%] text-[hsl(186,100%,42%)] px-1.5 py-0.5 rounded-full">{unreadCount} new</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[hsl(215,20%,55%)]">No notifications</div>
                  ) : (
                    notifications.map((n: any) => (
                      <div key={n.id} className={`p-3 border-b border-[hsl(217,32%,17%)] last:border-0 ${!n.isRead ? 'bg-[hsl(217,32%,17%)/30%]' : ''}`}>
                        <p className="text-[11px] text-white leading-tight">{n.message}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] text-[hsl(215,20%,55%)]">{new Date(n.createdAt).toLocaleDateString()}</span>
                          {!n.isRead && (
                            <button onClick={() => markAsRead(n.id)} className="text-[hsl(186,100%,42%)] hover:text-[hsl(186,100%,50%)]">
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-[hsl(186,100%,42%)/20%] border border-[hsl(186,100%,42%)/30%] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-[hsl(186,100%,42%)]">{user ? initials(user.name) : "?"}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-[hsl(215,20%,55%)] truncate">{user ? roleLabel(user.role) : ""}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} className="text-[hsl(215,20%,55%)] hover:text-red-400 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="hidden md:flex items-center justify-center py-2 border-t border-[hsl(217,32%,17%)] text-[hsl(215,20%,55%)] hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(222,47%,11%)] text-white">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative flex h-full w-56">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[hsl(217,32%,17%)] bg-[hsl(222,47%,8%)]">
          <button onClick={() => setMobileOpen(true)} className="text-[hsl(215,20%,65%)] hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm tracking-widest uppercase">WorkLens</span>
        </div>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
