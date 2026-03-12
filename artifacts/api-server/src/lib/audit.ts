import { createHash } from "crypto";
import { db } from "@workspace/db";
import { auditLogTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

export async function logEvent(params: {
  orgId: number;
  actorId: number;
  eventType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { orgId, actorId, eventType, entityId, payload } = params;
  const payloadStr = payload ? JSON.stringify(payload) : null;

  const [last] = await db
    .select({ hash: auditLogTable.hash })
    .from(auditLogTable)
    .where(eq(auditLogTable.orgId, orgId))
    .orderBy(desc(auditLogTable.id))
    .limit(1);

  const previousHash = last?.hash ?? null;
  const timestamp = new Date().toISOString();
  const hashInput = `${orgId}:${actorId}:${eventType}:${entityId ?? ""}:${timestamp}:${payloadStr ?? ""}:${previousHash ?? ""}`;
  const hash = createHash("sha256").update(hashInput).digest("hex");

  await db.insert(auditLogTable).values({
    orgId,
    actorId,
    eventType,
    entityId: entityId ?? null,
    payload: payloadStr,
    timestamp: new Date(),
    hash,
    previousHash,
  });
}
