"use client";

import { useState, useRef, useEffect } from "react";
import { Menu, Search, Sun, Moon, Bell, LogOut, User, ChevronDown } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/shared/ThemeProvider";
import { cn } from "@/lib/utils/helpers";

interface HeaderProps {
  onMenuClick: () => void;
  userName?: string;
  userEmail?: string;
  userTier?: "FREE" | "PRO" | "PREMIUM";
  hasUnreadAlerts?: boolean;
}

export default function Header({
  onMenuClick,
  userName = "Guest",
  userEmail = "",
  userTier = "FREE",
  hasUnreadAlerts = false,
}: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const tierColors = {
    FREE: "border-slate-400",
    PRO: "border-blue-400",
    PREMIUM: "border-gradient-to-r from-amber-400 to-orange-400",
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-lg px-4 sm:px-6">
      {/* Left: Menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden rounded-lg p-2 hover:bg-accent transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Center: Search bar */}
      <div className="flex-1 max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search horses, dogs, trainers, jockeys..."
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 hover:bg-accent transition-colors"
          aria-label="Toggle theme"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-5 w-5 text-yellow-500" />
          ) : (
            <Moon className="h-5 w-5 text-slate-700" />
          )}
        </button>

        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 hover:bg-accent transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {hasUnreadAlerts && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent transition-colors"
            aria-label="User menu"
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-semibold text-white border-2",
                tierColors[userTier]
              )}
            >
              {getInitials(userName)}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200 hidden sm:block",
                isUserMenuOpen && "rotate-180"
              )}
            />
          </button>

          {/* Dropdown menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* User info */}
              <div className="border-b border-border bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-semibold text-white border-2",
                      tierColors[userTier]
                    )}
                  >
                    {getInitials(userName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-1 rounded text-xs font-semibold",
                      userTier === "FREE" && "bg-slate-600 text-slate-100",
                      userTier === "PRO" && "bg-blue-600 text-blue-100",
                      userTier === "PREMIUM" &&
                        "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                    )}
                  >
                    {userTier} TIER
                  </span>
                </div>
              </div>

              {/* Menu items */}
              <div className="p-2">
                <button
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
