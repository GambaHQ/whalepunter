"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Shield, Ban, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/helpers";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tier: string;
  status: string;
  createdAt: string;
  isBanned: boolean;
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: any;
    }) => {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleTierChange = (userId: string, newTier: string) => {
    if (confirm(`Change user tier to ${newTier}?`)) {
      updateUserMutation.mutate({ userId, updates: { tier: newTier } });
    }
  };

  const handleToggleAdmin = (userId: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    if (confirm(`Change user role to ${newRole}?`)) {
      updateUserMutation.mutate({ userId, updates: { role: newRole } });
    }
  };

  const handleToggleBan = (userId: string, isBanned: boolean) => {
    const action = isBanned ? "Unban" : "Ban";
    if (confirm(`${action} this user?`)) {
      updateUserMutation.mutate({ userId, updates: { isBanned: !isBanned } });
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "PREMIUM":
        return "bg-purple-100 text-purple-700";
      case "PRO":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="mt-2 text-gray-600">
          Manage user accounts, roles, and subscriptions
        </p>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    Loading...
                  </td>
                </tr>
              ) : users?.users && users.users.length > 0 ? (
                users.users.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {user.name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {user.email}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.role === "ADMIN" && (
                        <Badge className="bg-red-100 text-red-700">
                          <Shield className="mr-1 h-3 w-3" />
                          Admin
                        </Badge>
                      )}
                      {user.role === "USER" && (
                        <Badge className="bg-gray-100 text-gray-700">
                          User
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <select
                        value={user.tier}
                        onChange={(e) =>
                          handleTierChange(user.id, e.target.value)
                        }
                        className={cn(
                          "rounded-md border-0 px-2 py-1 text-sm font-medium",
                          getTierBadgeColor(user.tier)
                        )}
                      >
                        <option value="FREE">Free</option>
                        <option value="PRO">Pro</option>
                        <option value="PREMIUM">Premium</option>
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.isBanned ? (
                        <Badge className="bg-red-100 text-red-700">
                          <Ban className="mr-1 h-3 w-3" />
                          Banned
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleToggleAdmin(user.id, user.role)
                          }
                        >
                          {user.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleToggleBan(user.id, user.isBanned)
                          }
                          className={
                            user.isBanned
                              ? "border-green-600 text-green-600 hover:bg-green-50"
                              : "border-red-600 text-red-600 hover:bg-red-50"
                          }
                        >
                          {user.isBanned ? "Unban" : "Ban"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
