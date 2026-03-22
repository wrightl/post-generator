import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your .env.local or environment."
    );
  }
  const sql = neon(url);
  return drizzle(sql);
}

export const db = getDb();
