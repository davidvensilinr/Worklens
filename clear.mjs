import postgres from "postgres";

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  await sql`DELETE FROM attendance`;
  console.log("Deleted attendance");
  process.exit(0);
}
run();
