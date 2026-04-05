import { db } from "./lib/db/src/index.ts";
import { attendanceTable } from "./lib/db/src/schema/attendance.ts";

async function run() {
  await db.delete(attendanceTable);
  console.log("Cleared attendance records for testing.");
  process.exit(0);
}
run();
