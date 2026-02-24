"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { data: session, status } = useSession();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // Show loading spinner while checking authentication
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  // Extract user information from session
  const userName = session?.user?.name || "Guest";
  const userEmail = session?.user?.email || "";
  const userTier = (session?.user as any)?.tier || "FREE";
  const userRole = (session?.user as any)?.role || "USER";
  const hasUnreadAlerts = (session?.user as any)?.hasUnreadAlerts || false;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        userName={userName}
        userEmail={userEmail}
        userTier={userTier}
        userRole={userRole}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
        {/* Header */}
        <Header
          onMenuClick={toggleSidebar}
          userName={userName}
          userEmail={userEmail}
          userTier={userTier}
          hasUnreadAlerts={hasUnreadAlerts}
        />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
