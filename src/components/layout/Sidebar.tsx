"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Zap,
  TrendingUp,
  DollarSign,
  Flame,
  BarChart3,
  Target,
  Search,
  GitCompare,
  Users,
  User,
  Eye,
  Bell,
  BookOpen,
  MessageSquare,
  Trophy,
  MessageCircle,
  Settings,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils/helpers";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  userTier?: "FREE" | "PRO" | "PREMIUM";
  userRole?: "USER" | "ADMIN";
}

const navSections: NavSection[] = [
  {
    title: "MAIN",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Live Races", href: "/races", icon: Zap },
      { name: "Market Movers", href: "/market-movers", icon: TrendingUp },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      { name: "Smart Money", href: "/smart-money", icon: DollarSign },
      { name: "Steamers/Drifters", href: "/steamers-drifters", icon: Flame },
      { name: "Race Heatmap", href: "/race-heatmap", icon: BarChart3 },
      { name: "Track Bias", href: "/track-bias", icon: Target },
    ],
  },
  {
    title: "RUNNERS",
    items: [
      { name: "Horse Profiles", href: "/runners?type=horse", icon: Search },
      { name: "Dog Profiles", href: "/runners?type=dog", icon: Search },
      { name: "Compare", href: "/runners/compare", icon: GitCompare },
      { name: "Trainers", href: "/trainers", icon: Users },
      { name: "Jockeys", href: "/jockeys", icon: User },
    ],
  },
  {
    title: "MY TOOLS",
    items: [
      { name: "Watchlist", href: "/watchlist", icon: Eye },
      { name: "Alerts", href: "/alerts", icon: Bell },
      { name: "Bet Journal", href: "/bet-journal", icon: BookOpen },
      { name: "Tips", href: "/tips", icon: MessageSquare },
    ],
  },
  {
    title: "SOCIAL",
    items: [
      { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
      { name: "Race Chat", href: "/chat", icon: MessageCircle },
    ],
  },
];

export default function Sidebar({
  isOpen,
  onClose,
  userName = "Guest",
  userEmail = "",
  userTier = "FREE",
  userRole = "USER",
}: SidebarProps) {
  const pathname = usePathname();

  const tierColors = {
    FREE: "bg-slate-600 text-slate-100",
    PRO: "bg-blue-600 text-blue-100",
    PREMIUM: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 p-6">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
          <Activity className="h-8 w-8 text-blue-500" />
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            WhalePunter
          </span>
        </Link>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden rounded-lg p-2 hover:bg-slate-800 transition-colors"
          aria-label="Close sidebar"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {navSections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4 space-y-3">
        {/* Subscription Tier Badge */}
        <div className="px-3 py-2 rounded-lg bg-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Subscription</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs font-semibold",
                tierColors[userTier]
              )}
            >
              {userTier}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">{userEmail}</p>
        </div>

        {/* Admin Link */}
        {userRole === "ADMIN" && (
          <Link
            href="/admin"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              pathname === "/admin"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <ShieldCheck className="h-5 w-5" />
            Admin
          </Link>
        )}

        {/* Settings Link */}
        <Link
          href="/settings"
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            pathname === "/settings"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
