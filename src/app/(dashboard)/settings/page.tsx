"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import {
  User,
  CreditCard,
  Bell,
  Palette,
  Shield,
  Moon,
  Sun,
  Monitor,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";

type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  subscriptionTier: "FREE" | "PRO" | "PREMIUM";
};

type Payment = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const queryClient = useQueryClient();

  // Fetch user profile
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["user", "profile"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) throw new Error("Failed to fetch profile");
      const session = await res.json();
      return session.user;
    },
  });

  const sections = [
    { id: "profile", label: "Profile", icon: User },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "alerts", label: "Alert Settings", icon: Bell },
    { id: "theme", label: "Theme", icon: Palette },
    { id: "account", label: "Account", icon: Shield },
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                        activeSection === section.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          {activeSection === "profile" && <ProfileSection profile={profile} />}
          {activeSection === "subscription" && <SubscriptionSection profile={profile} />}
          {activeSection === "notifications" && <NotificationsSection />}
          {activeSection === "alerts" && <AlertSettingsSection />}
          {activeSection === "theme" && <ThemeSection />}
          {activeSection === "account" && <AccountSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection({ profile }: { profile?: UserProfile }) {
  const [formData, setFormData] = useState({
    name: profile?.name || "",
    email: profile?.email || "",
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            {profile?.image ? (
              <img src={profile.image} alt={profile.name || "User"} />
            ) : (
              <div className="bg-primary text-primary-foreground flex items-center justify-center h-full">
                {profile?.name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
          </Avatar>
          <Button variant="outline" size="sm">
            Change Avatar
          </Button>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Name</label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Email</label>
          <Input type="email" value={formData.email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
        </div>

        <Button
          onClick={() => updateProfileMutation.mutate(formData)}
          disabled={updateProfileMutation.isPending}
        >
          {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>

        {updateProfileMutation.isSuccess && (
          <p className="text-sm text-green-600">Profile updated successfully!</p>
        )}
        {updateProfileMutation.isError && (
          <p className="text-sm text-destructive">Failed to update profile</p>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionSection({ profile }: { profile?: UserProfile }) {
  const tierColors = {
    FREE: "bg-gray-500",
    PRO: "bg-blue-500",
    PREMIUM: "bg-purple-500",
  };

  const tierColor = profile?.subscriptionTier ? tierColors[profile.subscriptionTier] : "bg-gray-500";

  // Fetch payment history
  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["payments", "history"],
    queryFn: async () => {
      const res = await fetch("/api/payments/history");
      if (!res.ok) return [];
      const data = await res.json();
      return data.payments || [];
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>Manage your subscription plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Current Plan</p>
              <Badge className={`${tierColor} text-white`}>
                {profile?.subscriptionTier || "FREE"}
              </Badge>
            </div>
            <div className="flex gap-2">
              {profile?.subscriptionTier === "FREE" && (
                <Button>
                  <ArrowUpCircle className="h-4 w-4 mr-2" />
                  Upgrade to PRO
                </Button>
              )}
              {profile?.subscriptionTier === "PRO" && (
                <>
                  <Button>
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    Upgrade to PREMIUM
                  </Button>
                  <Button variant="outline">
                    <ArrowDownCircle className="h-4 w-4 mr-2" />
                    Downgrade
                  </Button>
                </>
              )}
              {profile?.subscriptionTier === "PREMIUM" && (
                <Button variant="outline">
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                  Downgrade
                </Button>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Plan Features</h4>
            {profile?.subscriptionTier === "FREE" && (
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Basic dashboard access</li>
                <li>• Limited race data</li>
                <li>• 5 watchlist items</li>
              </ul>
            )}
            {profile?.subscriptionTier === "PRO" && (
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Full dashboard access</li>
                <li>• Real-time odds tracking</li>
                <li>• 10 alert rules</li>
                <li>• 50 watchlist items</li>
                <li>• Bet journal</li>
              </ul>
            )}
            {profile?.subscriptionTier === "PREMIUM" && (
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Everything in PRO</li>
                <li>• Unlimited alerts</li>
                <li>• Unlimited watchlist</li>
                <li>• Advanced analytics</li>
                <li>• API access</li>
                <li>• Priority support</li>
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>View your past transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div>
                    <p className="font-medium">
                      {payment.currency} ${payment.amount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={payment.status === "COMPLETED" ? "default" : "secondary"}>
                      {payment.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{payment.method}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No payment history</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationsSection() {
  const [settings, setSettings] = useState({
    pushEnabled: true,
    emailEnabled: true,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof settings) => {
      const res = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      return res.json();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Manage how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="font-medium">Push Notifications</p>
            <p className="text-sm text-muted-foreground">Receive push notifications in your browser</p>
          </div>
          <input
            type="checkbox"
            checked={settings.pushEnabled}
            onChange={(e) => setSettings({ ...settings, pushEnabled: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="font-medium">Email Notifications</p>
            <p className="text-sm text-muted-foreground">Receive notifications via email</p>
          </div>
          <input
            type="checkbox"
            checked={settings.emailEnabled}
            onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <Button onClick={() => saveMutation.mutate(settings)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Preferences"}
        </Button>

        {saveMutation.isSuccess && (
          <p className="text-sm text-green-600">Preferences saved successfully!</p>
        )}
      </CardContent>
    </Card>
  );
}

function AlertSettingsSection() {
  const [thresholds, setThresholds] = useState({
    oddsMovementPercent: 10,
    whaleBetAmount: 1000,
    raceStartingMinutes: 5,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Settings</CardTitle>
        <CardDescription>Configure default thresholds for alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">
            Odds Movement Threshold (%)
          </label>
          <Input
            type="number"
            value={thresholds.oddsMovementPercent}
            onChange={(e) =>
              setThresholds({ ...thresholds, oddsMovementPercent: parseInt(e.target.value) })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Alert when odds change by this percentage
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Whale Bet Amount ($)</label>
          <Input
            type="number"
            value={thresholds.whaleBetAmount}
            onChange={(e) =>
              setThresholds({ ...thresholds, whaleBetAmount: parseInt(e.target.value) })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Alert for bets larger than this amount
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">
            Race Starting Alert (minutes before)
          </label>
          <Input
            type="number"
            value={thresholds.raceStartingMinutes}
            onChange={(e) =>
              setThresholds({ ...thresholds, raceStartingMinutes: parseInt(e.target.value) })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Alert this many minutes before race starts
          </p>
        </div>

        <Button>Save Alert Settings</Button>
      </CardContent>
    </Card>
  );
}

function ThemeSection() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>Choose your preferred theme</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setTheme("light")}
            className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
              theme === "light" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Sun className="h-6 w-6" />
            <span className="text-sm font-medium">Light</span>
          </button>

          <button
            onClick={() => setTheme("dark")}
            className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
              theme === "dark" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Moon className="h-6 w-6" />
            <span className="text-sm font-medium">Dark</span>
          </button>

          <button
            onClick={() => setTheme("system")}
            className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${
              theme === "system" ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Monitor className="h-6 w-6" />
            <span className="text-sm font-medium">System</span>
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {theme === "system"
            ? "Theme will match your system preferences"
            : `Theme is set to ${theme} mode`}
        </p>
      </CardContent>
    </Card>
  );
}

function AccountSection() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordData) => {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to change password");
      return res.json();
    },
    onSuccess: () => {
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/delete-account", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete account");
      return res.json();
    },
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Current Password</label>
            <Input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) =>
                setPasswordData({ ...passwordData, currentPassword: e.target.value })
              }
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">New Password</label>
            <Input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Confirm New Password</label>
            <Input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) =>
                setPasswordData({ ...passwordData, confirmPassword: e.target.value })
              }
            />
          </div>

          <Button
            onClick={() => changePasswordMutation.mutate(passwordData)}
            disabled={
              changePasswordMutation.isPending ||
              passwordData.newPassword !== passwordData.confirmPassword
            }
          >
            {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
          </Button>

          {changePasswordMutation.isSuccess && (
            <p className="text-sm text-green-600">Password changed successfully!</p>
          )}
          {changePasswordMutation.isError && (
            <p className="text-sm text-destructive">Failed to change password</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Permanently delete your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showDeleteConfirm ? (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              Delete Account
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure? This action cannot be undone. All your data will be permanently
                deleted.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteAccountMutation.isPending}
                >
                  {deleteAccountMutation.isPending ? "Deleting..." : "Yes, Delete My Account"}
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
