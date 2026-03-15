import { db } from "@workspace/db";
import { usersTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function notifyHR(orgId: number, employeeId: number, message: string, type: string) {
  try {
    const [emp] = await db.select().from(usersTable).where(eq(usersTable.id, employeeId));
    if (!emp) return;

    let targets: { id: number }[] = [];
    
    // 1. Try to find HR in the same department
    if (emp.departmentId) {
      targets = await db.select({ id: usersTable.id }).from(usersTable).where(
        and(
          eq(usersTable.orgId, orgId),
          eq(usersTable.departmentId, emp.departmentId),
          eq(usersTable.role, "hr")
        )
      );
    }

    // 2. Fallback to Superadmin if no HR found in department
    if (targets.length === 0) {
      targets = await db.select({ id: usersTable.id }).from(usersTable).where(
        and(
          eq(usersTable.orgId, orgId),
          eq(usersTable.role, "superadmin")
        )
      );
    }

    // 3. Insert notifications
    if (targets.length > 0) {
      await db.insert(notificationsTable).values(
        targets.map(t => ({
          orgId,
          userId: t.id,
          type,
          message
        }))
      );
      // Future enhancement: Emit socket event for real-time popup if needed
    }
  } catch (error) {
    console.error("Failed to push HR notification:", error);
  }
}
