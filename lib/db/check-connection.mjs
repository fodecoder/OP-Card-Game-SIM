import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(connectionString);
} catch {
  console.error("DATABASE_URL is not a valid PostgreSQL URL.");
  process.exit(1);
}

console.log("Testing PostgreSQL connection:");
console.log(`  host: ${parsedUrl.hostname || "(missing)"}`);
console.log(`  port: ${parsedUrl.port || "5432"}`);
console.log(`  user: ${decodeURIComponent(parsedUrl.username) || "(missing)"}`);
console.log(`  database: ${parsedUrl.pathname.slice(1) || "(missing)"}`);

const client = new Client({ connectionString });

try {
  await client.connect();
  const result = await client.query(
    "select current_user, current_database(), version()",
  );
  const row = result.rows[0];
  console.log(`Connected as ${row.current_user} to ${row.current_database}.`);
  console.log(row.version);
} catch (error) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "unknown";
  const message = error instanceof Error ? error.message : String(error);

  console.error(`PostgreSQL connection failed (${code}): ${message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

