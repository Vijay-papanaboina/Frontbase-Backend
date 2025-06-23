import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("connect", () => {
  console.log("PostgreSQL database connected.");
});

pool.on("error", (err) => {
  console.error("PostgreSQL database error:", err.message, err.stack);
});

export default pool;
