import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default(''),
  role: text("role").notNull().default('client'),
  weightUnit: text("weight_unit").notNull().default('kg'),
  coachCode: text("coach_code").notNull(),
  avatarUrl: text("avatar_url").notNull().default(''),
  plan: text("plan").notNull().default('free'),
  planUserLimit: integer("plan_user_limit").notNull().default(1),
  planExpiresAt: timestamp("plan_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const programs = pgTable("programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull().default(''),
  weeks: jsonb("weeks").notNull(),
  daysPerWeek: integer("days_per_week").notNull().default(3),
  shareCode: text("share_code").notNull(),
  coachId: varchar("coach_id").notNull(),
  clientId: varchar("client_id"),
  status: text("status").notNull().default('active'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coachId: varchar("coach_id").notNull(),
  clientProfileId: varchar("client_profile_id").notNull(),
  name: text("name").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const prs = pgTable("prs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  liftType: text("lift_type").notNull(),
  weight: integer("weight").notNull(),
  unit: text("unit").notNull().default('kg'),
  date: text("date").notNull(),
  notes: text("notes").notNull().default(''),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  programId: varchar("program_id").notNull(),
  programTitle: text("program_title").notNull(),
  exerciseName: text("exercise_name").notNull(),
  fromRole: text("from_role").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coachId: varchar("coach_id").notNull(),
  clientProfileId: varchar("client_profile_id").notNull(),
  senderRole: text("sender_role").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  profileId: varchar("profile_id").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videoUploads = pgTable("video_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  programId: varchar("program_id").notNull(),
  exerciseId: varchar("exercise_id").notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  coachId: varchar("coach_id").notNull(),
  coachViewedAt: timestamp("coach_viewed_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profiles);
export const insertProgramSchema = createInsertSchema(programs);
export const insertClientSchema = createInsertSchema(clients);
export const insertPRSchema = createInsertSchema(prs);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertMessageSchema = createInsertSchema(messages);
export const insertUserSchema = createInsertSchema(users);
export const insertVideoUploadSchema = createInsertSchema(videoUploads);

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Program = typeof programs.$inferSelect;
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type PR = typeof prs.$inferSelect;
export type InsertPR = z.infer<typeof insertPRSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type UserAccount = typeof users.$inferSelect;
export type InsertUserAccount = z.infer<typeof insertUserSchema>;
export type VideoUpload = typeof videoUploads.$inferSelect;
export type InsertVideoUpload = z.infer<typeof insertVideoUploadSchema>;
