import pg from "pg";
const { Client } = pg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("DELETE FROM attendance");
  await client.end();
  console.log("Deleted attendance");
}
run().catch(console.error);
