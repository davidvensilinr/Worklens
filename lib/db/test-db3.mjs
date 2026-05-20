import pg from "pg";
const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres:Ananyathecultural3@db.czaeknelpeuahzwusjmc.supabase.co:5432/postgres",
  });
  
  try {
    await client.connect();
    console.log("Connected to DB successfully.");
    
    // Test a parameterized query exactly like Drizzle does
    const res = await client.query({
      text: `select "id", "org_id", "name", "email", "password_hash", "role", "department_id", "team_id", "manager_id", "hire_date", "must_change_password", "job_title", "date_of_birth", "gender", "distance_from_home", "num_companies_worked", "total_working_years_before_hire", "education", "standard_working_hours", "work_start_time", "work_end_time", "home_location", "office_location", "job_level", "stock_option_level", "years_since_last_promotion", "response_count", "total_response_time_mins", "avg_response_time_mins", "created_at", "updated_at" from "users" where "users"."email" = $1`,
      values: ["jane@gmail.com"]
    });
    console.log("Parameterized query success. Rows:", res.rows.length);
  } catch (err) {
    console.error("Query failed:", err.message);
    if (err.code) console.error("Postgres Error Code:", err.code);
    if (err.detail) console.error("Error Detail:", err.detail);
    if (err.hint) console.error("Error Hint:", err.hint);
  } finally {
    await client.end();
  }
}

run();
