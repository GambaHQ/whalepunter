import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

// GET /api/admin/users - List all users with pagination and search
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Check admin permission
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Build search filter
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // Fetch users
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          subscriptionTier: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/users - Update user (change tier, role, ban status)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    // Check admin permission
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, subscriptionTier, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, subscriptionTier: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build update data
    const updateData: any = {};
    const changes: string[] = [];

    if (subscriptionTier !== undefined && subscriptionTier !== targetUser.subscriptionTier) {
      updateData.subscriptionTier = subscriptionTier;
      changes.push(`tier: ${targetUser.subscriptionTier} → ${subscriptionTier}`);
    }

    if (role !== undefined && role !== targetUser.role) {
      updateData.role = role;
      changes.push(`role: ${targetUser.role} → ${role}`);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Log admin action
    if (changes.length > 0) {
      await prisma.adminLog.create({
        data: {
          adminId: session.user.id,
          action: "UPDATE_USER",
          details: {
            message: `Updated user ${targetUser.email}: ${changes.join(", ")}`,
            userId,
            changes: updateData,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      changes,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
