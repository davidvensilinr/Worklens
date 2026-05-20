
import { db } from "./lib/db/src/index.js";
import { usersTable } from "./lib/db/src/schema/users.js";
import { eq } from "drizzle-orm";

async function run() {
  try {
    console.log("Connecting and querying...");
    const result = await db.select().from(usersTable).where(eq(usersTable.email, "jane@gmail.com")).limit(1);
    console.log("Query success:", result);
  } catch (err) {
    console.error("Query failed!");
    console.error(err);
    if (err.code) console.error("Postgres Error Code:", err.code);
    if (err.detail) console.error("Error Detail:", err.detail);
  }
  process.exit(0);
}

run();
