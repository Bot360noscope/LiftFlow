import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "../shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export async function initializeDatabase() {
  try {
    console.log("Initializing database tables...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'client',
        weight_unit TEXT NOT NULL DEFAULT 'kg',
        coach_code TEXT NOT NULL,
        avatar_url TEXT NOT NULL DEFAULT '',
        plan TEXT NOT NULL DEFAULT 'free',
        plan_user_limit INTEGER NOT NULL DEFAULT 1,
        plan_expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS programs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        weeks JSONB NOT NULL,
        days_per_week INTEGER NOT NULL DEFAULT 3,
        share_code TEXT NOT NULL,
        coach_id VARCHAR NOT NULL,
        client_id VARCHAR,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        coach_id VARCHAR NOT NULL,
        client_profile_id VARCHAR NOT NULL,
        name TEXT NOT NULL,
        joined_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS prs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id VARCHAR NOT NULL,
        lift_type TEXT NOT NULL,
        weight INTEGER NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        date TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id VARCHAR NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        program_id VARCHAR NOT NULL,
        program_title TEXT NOT NULL,
        exercise_name TEXT NOT NULL,
        from_role TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        coach_id VARCHAR NOT NULL,
        client_profile_id VARCHAR NOT NULL,
        sender_role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        profile_id VARCHAR NOT NULL,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        verification_token TEXT,
        reset_token TEXT,
        reset_token_expiry TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS video_uploads (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        filename TEXT NOT NULL,
        program_id VARCHAR NOT NULL,
        exercise_id VARCHAR NOT NULL,
        uploaded_by VARCHAR NOT NULL,
        coach_id VARCHAR NOT NULL,
        coach_viewed_at TIMESTAMP,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database tables:", error);
    throw error;
  }
}
