import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { profiles, programs, clients, prs, notifications, messages, users, videoUploads, paymentUsers } from "../shared/schema";
import { eq, desc, and, or, inArray, ilike, lt, gt, isNull, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { uploadToR2, getFromR2, deleteFromR2, getPresignedUploadUrl, getPresignedDownloadUrl, downloadFromR2 } from "./r2";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import { broadcastToProfile } from "./websocket";

const JWT_SECRET = process.env.SESSION_SECRET || 'liftflow-dev-secret';

const planCheckCache = new Map<string, number>();
const PLAN_CHECK_TTL = 5 * 60 * 1000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(windowMs: number, maxAttempts: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > maxAttempts) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      const minutes = Math.ceil(retryAfter / 60);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: `Too many attempts. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} and try again.` });
    }
    return next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60000);

const BLOCKED_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'dick', 'piss',
  'bastard', 'cunt', 'asshole', 'motherfucker', 'bullshit',
  'dumbass', 'jackass', 'wtf', 'stfu', 'fck', 'f\\*ck', 'sh\\*t',
  'b\\*tch', 'a\\*s', 'fuk', 'fuq', 'azz', 'biatch',
];

const blockedRegex = new RegExp(
  BLOCKED_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i'
);

function containsProfanity(text: string): boolean {
  const normalized = text.replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/\$/g, 's').replace(/[_\-.\s]+/g, '');
  return blockedRegex.test(text) || blockedRegex.test(normalized);
}

function generateToken(userId: string, profileId: string): string {
  return jwt.sign({ userId, profileId }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token: string): { userId: string; profileId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; profileId: string };
  } catch { return null; }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

async function checkAndDowngradeExpiredPlan(profileId: string): Promise<void> {
  const now = Date.now();
  const lastCheck = planCheckCache.get(profileId);
  if (lastCheck && now - lastCheck < PLAN_CHECK_TTL) return;
  planCheckCache.set(profileId, now);

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!profile) return;
  if (profile.planExpiresAt && new Date(profile.planExpiresAt) < new Date() && profile.plan !== 'free') {
    console.log(`[Plan Expiry] Downgrading ${profileId} from ${profile.plan} (limit: ${profile.planUserLimit}) to free — expired at ${profile.planExpiresAt}`);
    await db.update(profiles).set({ plan: 'free', planUserLimit: 1, planExpiresAt: null }).where(eq(profiles.id, profileId));
    planCheckCache.delete(profileId);
  }
}

async function isCoachOverLimit(coachProfileId: string): Promise<{ overLimit: boolean; plan: string; limit: number; clientCount: number }> {
  await checkAndDowngradeExpiredPlan(coachProfileId);
  const [coach] = await db.select().from(profiles).where(eq(profiles.id, coachProfileId));
  if (!coach) return { overLimit: false, plan: 'free', limit: 1, clientCount: 0 };
  const plan = coach.plan || 'free';
  const limit = coach.planUserLimit || 1;
  const currentClients = await db.select().from(clients).where(eq(clients.coachId, coachProfileId));
  return { overLimit: currentClients.length > limit, plan, limit, clientCount: currentClients.length };
}

async function trimVideoBuffer(buffer: Buffer, startTime: number, endTime: number): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input_${randomUUID()}.mp4`);
  const outputPath = path.join(tmpDir, `output_${randomUUID()}.mp4`);
  await fs.writeFile(inputPath, buffer);
  const duration = endTime - startTime;

  const cleanup = async () => {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  };

  const runFfmpeg = (args: string[]): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      execFile('ffmpeg', args, { timeout: 120000 }, async (error) => {
        try {
          if (error) { await cleanup(); return reject(error); }
          const trimmed = await fs.readFile(outputPath);
          await cleanup();
          resolve(trimmed);
        } catch (e) { await cleanup(); reject(e); }
      });
    });

  try {
    return await runFfmpeg([
      '-y', '-ss', String(startTime), '-i', inputPath,
      '-t', String(duration),
      '-c:v', 'copy', '-c:a', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ]);
  } catch {
    await fs.writeFile(inputPath, buffer);
    return await runFfmpeg([
      '-y', '-i', inputPath,
      '-ss', String(startTime), '-t', String(duration),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
      '-c:a', 'aac', '-movflags', '+faststart',
      outputPath,
    ]);
  }
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function sendPushNotification(targetProfileId: string, title: string, body: string, data?: Record<string, any>): Promise<void> {
  try {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, targetProfileId));
    if (!profile?.pushToken || !profile.pushToken.startsWith('ExponentPushToken[')) {
      console.log("[PushNotif] No valid push token for profile:", targetProfileId);
      return;
    }
    console.log("[PushNotif] Sending to:", profile.pushToken.substring(0, 30) + "...", "title:", title);

    const message = {
      to: profile.pushToken,
      sound: 'default' as const,
      title,
      body,
      data: data || {},
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await res.json();
    console.log("[PushNotif] Expo API response:", JSON.stringify(result));
    if (result?.data?.status === 'error' &&
        (result.data.details?.error === 'DeviceNotRegistered' || result.data.details?.error === 'InvalidCredentials')) {
      await db.update(profiles).set({ pushToken: null }).where(eq(profiles.id, targetProfileId));
      console.log("[PushNotif] Removed invalid token for profile:", targetProfileId);
    }
  } catch (err: any) {
    console.log("[PushNotif] Error sending:", err?.message || err);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  app.get("/api/app-config", (_req, res) => {
    res.json({
      minVersion: process.env.MIN_APP_VERSION || "1.7.9",
      latestVersion: process.env.LATEST_APP_VERSION || "1.7.9",
      forceUpdate: process.env.FORCE_UPDATE === "true",
      updateMessage: process.env.UPDATE_MESSAGE || "A new version of LiftFlow is available with important improvements.",
    });
  });

  // Google Search Console verification
  app.get("/google4edce6fc3ed32d06.html", (_req, res) => {
    res.type("text/html").send("google-site-verification: google4edce6fc3ed32d06.html");
  });

  // === AUTH ===
  const authRateLimit = rateLimit(5 * 60 * 1000, 10);

  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

      const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });

      const profileId = randomUUID();
      const [profile] = await db.insert(profiles).values({
        id: profileId,
        name: name || '',
        role: role || 'client',
        weightUnit: 'kg',
        coachCode: generateCode(),
      }).returning();

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase().trim(),
        passwordHash,
        profileId,
      });

      const token = generateToken(userId, profileId);
      res.json({ token, profile });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (!user) return res.status(401).json({ error: "Invalid email or password" });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Invalid email or password" });

      const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.profileId));
      if (!profile) return res.status(500).json({ error: "Profile not found" });

      const token = generateToken(user.id, user.profileId);
      res.json({ token, profile });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (!user) {
        return res.json({ success: true, message: "If an account exists with that email, a reset code has been sent." });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 15 * 60 * 1000);
      await db.update(users).set({ resetToken: code, resetTokenExpiry: expiry }).where(eq(users.id, user.id));

      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "LiftFlow <onboarding@resend.dev>",
          to: email.toLowerCase().trim(),
          subject: "Your LiftFlow Password Reset Code",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <h2 style="color: #E8512F; margin-bottom: 8px;">LiftFlow</h2>
              <p style="color: #333; font-size: 16px;">Your password reset code is:</p>
              <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #E8512F;">${code}</span>
              </div>
              <p style="color: #666; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });
      } catch (emailErr: any) {
        console.error("Failed to send reset email:", emailErr);
        return res.status(500).json({ error: "Failed to send reset email. Please try again." });
      }

      res.json({ success: true, message: "If an account exists with that email, a reset code has been sent." });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/auth/verify-reset-code", authRateLimit, async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) return res.status(400).json({ error: "Email, code, and new password are required" });
      if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (!user) return res.status(400).json({ error: "Invalid email or code" });

      if (!user.resetToken || user.resetToken !== code) {
        return res.status(400).json({ error: "Invalid reset code" });
      }

      if (!user.resetTokenExpiry || new Date() > user.resetTokenExpiry) {
        return res.status(400).json({ error: "Reset code has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ passwordHash, resetToken: null, resetTokenExpiry: null }).where(eq(users.id, user.id));

      res.json({ success: true, message: "Password has been reset successfully" });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/admin/reset-password", async (req, res) => {
    try {
      const adminKey = req.headers['x-admin-key'];
      if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      const { email, newPassword } = req.body;
      if (!email || !newPassword) return res.status(400).json({ error: "Email and newPassword required" });
      if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (!user) return res.status(404).json({ error: "User not found" });

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

      res.json({ success: true, message: `Password reset for ${email}` });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: "Not authenticated" });

      const decoded = verifyToken(authHeader.slice(7));
      if (!decoded) return res.status(401).json({ error: "Invalid token" });

      await checkAndDowngradeExpiredPlan(decoded.profileId);
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, decoded.profileId));
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      res.json({ profile });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/verify-account", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
      if (!user) return res.json({ exists: false });

      const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.profileId));
      res.json({
        exists: true,
        profileId: user.profileId,
        plan: profile?.plan || 'free',
        name: profile?.name || '',
      });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === PROFILES ===
  app.post("/api/profiles", async (req, res) => {
    try {
      const { name, role, weightUnit } = req.body;
      const [profile] = await db.insert(profiles).values({
        id: randomUUID(),
        name: name || '',
        role: role || 'client',
        weightUnit: weightUnit || 'kg',
        coachCode: generateCode(),
      }).returning();
      res.json(profile);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, req.params.id));
      if (!profile) return res.status(404).json({ error: "Not found" });

      res.json(profile);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put("/api/profiles/:id", async (req, res) => {
    try {
      const { name, role, weightUnit, coachCode, bodyWeight } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (weightUnit !== undefined) updates.weightUnit = weightUnit;
      if (coachCode !== undefined) updates.coachCode = coachCode;
      if (bodyWeight !== undefined) updates.bodyWeight = bodyWeight === null ? null : Number(bodyWeight);
      const [updated] = await db.update(profiles).set(updates).where(eq(profiles.id, req.params.id)).returning();
      res.json(updated);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/profiles/:id/reset-code", async (req, res) => {
    try {
      const newCode = generateCode();
      const [updated] = await db.update(profiles).set({ coachCode: newCode }).where(eq(profiles.id, req.params.id)).returning();
      res.json({ coachCode: updated.coachCode });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/coaches/by-code/:code", async (req, res) => {
    try {
      const [coach] = await db.select().from(profiles).where(
        and(eq(profiles.coachCode, req.params.code.toUpperCase()), eq(profiles.role, 'coach'))
      );
      if (!coach) return res.status(404).json({ error: "Coach not found" });
      res.json({ id: coach.id, name: coach.name, coachCode: coach.coachCode });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === PROGRAMS ===
  app.get("/api/programs", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      const profile = await db.select().from(profiles).where(eq(profiles.id, profileId));
      if (!profile.length) return res.status(404).json({ error: "Profile not found" });

      const role = profile[0].role;

      let result;
      if (role === 'coach') {
        result = await db.select().from(programs).where(eq(programs.coachId, profileId)).orderBy(desc(programs.createdAt));
      } else {
        const clientRecords = await db.select().from(clients).where(eq(clients.clientProfileId, profileId));
        const clientRecordIds = clientRecords.map(c => c.id);
        const conditions = [
          and(eq(programs.coachId, profileId), isNull(programs.clientId)),
        ];
        if (clientRecordIds.length > 0) {
          conditions.push(inArray(programs.clientId, clientRecordIds));
        }
        const allPrograms = await db.select().from(programs).where(or(...conditions)).orderBy(desc(programs.createdAt));
        result = allPrograms.filter(p => {
          if (!p.clientId) return true;
          const pw = p.publishedWeeks;
          if (pw === null || pw === undefined) return true;
          return pw > 0;
        }).map(p => {
          if (!p.clientId) return p;
          const pw = p.publishedWeeks;
          if (pw === null || pw === undefined) return p;
          const weeks = (p.weeks as any[]) || [];
          return { ...p, weeks: weeks.filter((w: any) => w.weekNumber <= pw) };
        });
      }
      res.json(result);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/programs/:id", async (req, res) => {
    try {
      const [program] = await db.select().from(programs).where(eq(programs.id, req.params.id));
      if (!program) return res.status(404).json({ error: "Not found" });
      res.json(program);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/programs", async (req, res) => {
    try {
      const { title, description, weeks, daysPerWeek, coachId, clientId, status } = req.body;
      if (coachId && clientId) {
        const check = await isCoachOverLimit(coachId);
        if (check.overLimit) {
          return res.status(403).json({ error: `Your plan supports ${check.limit} client${check.limit !== 1 ? 's' : ''} but you have ${check.clientCount}. Please upgrade your plan or remove clients to assign programs.`, code: 'PLAN_LIMIT_EXCEEDED' });
        }
      }
      const [program] = await db.insert(programs).values({
        id: randomUUID(),
        title,
        description: description || '',
        weeks,
        daysPerWeek: daysPerWeek || 3,
        shareCode: '',
        coachId,
        clientId: clientId || null,
        status: status || 'active',
        publishedWeeks: clientId ? 0 : null,
      }).returning();
      res.json(program);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put("/api/programs/:id", async (req, res) => {
    try {
      const { title, description, weeks, daysPerWeek, clientId, status, updatedAt: clientUpdatedAt, role: senderRole } = req.body;
      const [existingProgram] = await db.select().from(programs).where(eq(programs.id, req.params.id));
      if (!existingProgram) return res.status(404).json({ error: "Program not found" });
      if (existingProgram.coachId && existingProgram.clientId) {
        const check = await isCoachOverLimit(existingProgram.coachId);
        if (check.overLimit) {
          return res.status(403).json({ error: `Your plan supports ${check.limit} client${check.limit !== 1 ? 's' : ''} but you have ${check.clientCount}. Please upgrade your plan or remove clients to continue editing shared programs.`, code: 'PLAN_LIMIT_EXCEEDED' });
        }
      }
      if (senderRole === 'client' && clientUpdatedAt && existingProgram.updatedBy === 'coach') {
        const serverTime = existingProgram.updatedAt ? new Date(existingProgram.updatedAt).getTime() : 0;
        const clientTime = new Date(clientUpdatedAt).getTime();
        if (serverTime > clientTime) {
          return res.status(409).json({ error: "Coach has updated this program", code: 'COACH_UPDATED', program: existingProgram });
        }
      }
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (weeks !== undefined) updates.weeks = weeks;
      if (daysPerWeek !== undefined) updates.daysPerWeek = daysPerWeek;
      if (clientId !== undefined) updates.clientId = clientId;
      if (status !== undefined) updates.status = status;
      if (req.body.publishedWeeks !== undefined) updates.publishedWeeks = req.body.publishedWeeks;
      updates.updatedAt = new Date();
      updates.updatedBy = senderRole || 'coach';
      const [updated] = await db.update(programs).set(updates).where(eq(programs.id, req.params.id)).returning();
      res.json(updated);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/programs/:id/assign", async (req, res) => {
    try {
      const { clientId } = req.body;
      if (!clientId) return res.status(400).json({ error: "clientId required" });

      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: "Unauthorized" });
      const decoded = verifyToken(authHeader.slice(7));
      if (!decoded) return res.status(401).json({ error: "Invalid token" });

      const [original] = await db.select().from(programs).where(eq(programs.id, req.params.id));
      if (!original) return res.status(404).json({ error: "Program not found" });
      if (!original.coachId) return res.status(400).json({ error: "Only coach programs can be assigned" });
      if (original.coachId !== decoded.profileId) return res.status(403).json({ error: "You can only assign your own programs" });

      const clientRecord = await db.select().from(clients).where(
        and(eq(clients.id, clientId), eq(clients.coachId, original.coachId))
      );
      if (clientRecord.length === 0) return res.status(400).json({ error: "Client not found or not linked to you" });

      const check = await isCoachOverLimit(original.coachId);
      if (check.overLimit) {
        return res.status(403).json({ error: `Your plan supports ${check.limit} client${check.limit !== 1 ? 's' : ''} but you have ${check.clientCount}. Please upgrade your plan or remove clients to assign programs.`, code: 'PLAN_LIMIT_EXCEEDED' });
      }

      const sourceWeeks = Array.isArray(original.weeks) ? (original.weeks as any[]) : [];
      const cleanWeeks = (sourceWeeks || []).map((week: any) => ({
        ...week,
        days: (week.days || []).map((day: any) => ({
          ...day,
          exercises: (day.exercises || []).map((ex: any) => ({
            ...ex,
            id: randomUUID(),
            videoUrl: '',
            isCompleted: false,
            clientNotes: '',
            coachComment: '',
          })),
        })),
      }));

      const [copy] = await db.insert(programs).values({
        id: randomUUID(),
        title: original.title,
        description: original.description || '',
        weeks: cleanWeeks,
        daysPerWeek: original.daysPerWeek,
        shareCode: '',
        coachId: original.coachId,
        clientId,
        status: 'active',
        publishedWeeks: 0,
      }).returning();
      res.json(copy);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete("/api/programs/:id", async (req, res) => {
    try {
      await db.delete(programs).where(eq(programs.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === CLIENTS ===
  app.get("/api/clients", async (req, res) => {
    try {
      const coachId = req.query.coachId as string;
      if (!coachId) return res.status(400).json({ error: "coachId required" });
      const result = await db.select({
        id: clients.id,
        coachId: clients.coachId,
        clientProfileId: clients.clientProfileId,
        name: clients.name,
        joinedAt: clients.joinedAt,
        avatarUrl: profiles.avatarUrl,
      }).from(clients)
        .leftJoin(profiles, eq(clients.clientProfileId, profiles.id))
        .where(eq(clients.coachId, coachId))
        .orderBy(desc(clients.joinedAt));
      res.json(result.map(c => ({ ...c, avatarUrl: c.avatarUrl || '' })));
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const { coachId, clientProfileId, name } = req.body;
      const existing = await db.select().from(clients).where(
        and(eq(clients.coachId, coachId), eq(clients.clientProfileId, clientProfileId))
      );
      if (existing.length > 0) return res.json(existing[0]);
      const [client] = await db.insert(clients).values({
        id: randomUUID(),
        coachId,
        clientProfileId,
        name,
      }).returning();
      res.json(client);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/my-coach", async (req, res) => {
    try {
      const clientProfileId = req.query.clientProfileId as string;
      if (!clientProfileId) return res.status(400).json({ error: "clientProfileId required" });
      const result = await db.select().from(clients).where(eq(clients.clientProfileId, clientProfileId));
      if (result.length === 0) return res.json(null);
      const coachRecord = result[0];
      const coachProfile = await db.select().from(profiles).where(eq(profiles.id, coachRecord.coachId));
      res.json({
        coachId: coachRecord.coachId,
        coachName: coachProfile.length > 0 ? coachProfile[0].name : 'Coach',
        clientRecordId: coachRecord.id,
      });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      await db.delete(programs).where(eq(programs.clientId, req.params.id));
      await db.delete(clients).where(eq(clients.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/join-coach", async (req, res) => {
    try {
      const { code, clientProfileId, clientName } = req.body;
      const [coach] = await db.select().from(profiles).where(
        and(eq(profiles.coachCode, code.toUpperCase()), eq(profiles.role, 'coach'))
      );
      if (!coach) return res.status(404).json({ error: "Invalid coach code" });

      const existing = await db.select().from(clients).where(
        and(eq(clients.coachId, coach.id), eq(clients.clientProfileId, clientProfileId))
      );
      if (existing.length > 0) return res.json({ coach: { id: coach.id, name: coach.name }, client: existing[0] });

      const anyCoach = await db.select().from(clients).where(eq(clients.clientProfileId, clientProfileId));
      if (anyCoach.length > 0) {
        return res.status(400).json({ error: "You already have a coach. Remove your current coach before joining a new one." });
      }

      {
        const plan = coach.plan || 'free';
        const limit = coach.planUserLimit || 1;
        const currentClients = await db.select().from(clients).where(eq(clients.coachId, coach.id));
        if (currentClients.length >= limit) {
          const planName = plan === 'free' ? 'Free' : plan === 'tier_5' ? 'Starter' : plan === 'tier_10' ? 'Growth' : plan === 'saas' ? 'SaaS' : plan.charAt(0).toUpperCase() + plan.slice(1);
          return res.status(403).json({ error: `This coach has reached their ${planName} plan limit of ${limit} client${limit !== 1 ? 's' : ''}. The coach needs to upgrade their plan to accept more clients.` });
        }
      }

      const [client] = await db.insert(clients).values({
        id: randomUUID(),
        coachId: coach.id,
        clientProfileId,
        name: clientName || 'Client',
      }).returning();
      res.json({ coach: { id: coach.id, name: coach.name }, client });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/leave-coach", async (req, res) => {
    try {
      const { clientProfileId } = req.body;
      if (!clientProfileId) return res.status(400).json({ error: "clientProfileId required" });
      await db.delete(clients).where(eq(clients.clientProfileId, clientProfileId));
      await db.delete(messages).where(eq(messages.clientProfileId, clientProfileId));
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/remove-client", async (req, res) => {
    try {
      const { coachId, clientId } = req.body;
      if (!coachId || !clientId) return res.status(400).json({ error: "coachId and clientId required" });
      const clientRecord = await db.select().from(clients).where(
        and(eq(clients.id, clientId), eq(clients.coachId, coachId))
      );
      if (clientRecord.length === 0) return res.status(404).json({ error: "Client not found" });
      const clientProfileId = clientRecord[0].clientProfileId;
      await db.delete(clients).where(eq(clients.id, clientId));
      await db.delete(messages).where(
        and(eq(messages.coachId, coachId), eq(messages.clientProfileId, clientProfileId))
      );
      const clientPrograms = await db.select().from(programs).where(
        and(eq(programs.coachId, coachId), eq(programs.clientId, clientId))
      );
      for (const prog of clientPrograms) {
        await db.update(programs).set({ clientId: null }).where(eq(programs.id, prog.id));
      }
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === PRs ===
  app.get("/api/prs", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      const result = await db.select().from(prs).where(eq(prs.profileId, profileId));
      res.json(result);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/prs", async (req, res) => {
    try {
      const { profileId, liftType, weight, unit, date, notes } = req.body;
      const [pr] = await db.insert(prs).values({
        id: randomUUID(),
        profileId,
        liftType,
        weight,
        unit: unit || 'kg',
        date,
        notes: notes || '',
      }).returning();
      res.json(pr);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete("/api/prs/:id", async (req, res) => {
    try {
      await db.delete(prs).where(eq(prs.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === PUSH TOKENS ===
  app.post("/api/push-token", async (req, res) => {
    try {
      const { profileId, pushToken } = req.body;
      console.log("[PushToken] Registration request for profile:", profileId, "token:", pushToken?.substring(0, 30) + "...");
      if (!profileId || !pushToken) return res.status(400).json({ error: "profileId and pushToken required" });
      if (!pushToken.startsWith('ExponentPushToken[')) return res.status(400).json({ error: "Invalid push token format" });
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: "Unauthorized" });
      const decoded = verifyToken(authHeader.slice(7));
      if (!decoded || decoded.profileId !== profileId) return res.status(403).json({ error: "Forbidden" });
      await db.update(profiles).set({ pushToken }).where(eq(profiles.id, profileId));
      console.log("[PushToken] Token saved successfully for profile:", profileId);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[PushToken] Error:", e.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // === NOTIFICATIONS ===
  app.get("/api/notifications", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      const result = await db.select().from(notifications).where(eq(notifications.profileId, profileId)).orderBy(desc(notifications.createdAt));
      res.json(result);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const { profileId, type, title, message, programId, programTitle, exerciseName, fromRole } = req.body;
      if (fromRole === 'coach' && programId) {
        const [prog] = await db.select({ coachId: programs.coachId }).from(programs).where(eq(programs.id, programId)).limit(1);
        if (prog) {
          const check = await isCoachOverLimit(prog.coachId);
          if (check.overLimit) {
            return res.status(403).json({ error: `Plan limit exceeded. Upgrade to continue.`, code: 'PLAN_LIMIT_EXCEEDED' });
          }
        }
      }
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const conditions = [
        eq(notifications.profileId, profileId),
        eq(notifications.type, type),
        gt(notifications.createdAt, fiveMinAgo),
      ];
      if (programId) conditions.push(eq(notifications.programId, programId));
      if (exerciseName) conditions.push(eq(notifications.exerciseName, exerciseName));
      const existing = await db.select().from(notifications).where(and(...conditions)).limit(1);
      if (existing.length > 0) {
        const [updated] = await db.update(notifications).set({ message, title, read: false, createdAt: new Date() }).where(eq(notifications.id, existing[0].id)).returning();
        broadcastToProfile(profileId, { type: 'new_notification', notification: updated });
        sendPushNotification(profileId, title, message, { type, programId, programTitle, exerciseName });
        return res.json(updated);
      }
      const [notif] = await db.insert(notifications).values({
        id: randomUUID(),
        profileId,
        type,
        title,
        message,
        programId,
        programTitle,
        exerciseName,
        fromRole,
      }).returning();
      broadcastToProfile(profileId, { type: 'new_notification', notification: notif });
      sendPushNotification(profileId, title, message, { type, programId, programTitle, exerciseName });
      res.json(notif);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      await db.update(notifications).set({ read: true }).where(eq(notifications.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      await db.update(notifications).set({ read: true }).where(eq(notifications.profileId, profileId));
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete("/api/notifications", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      await db.delete(notifications).where(eq(notifications.profileId, profileId));
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === MESSAGES (Chat) ===
  app.get("/api/messages", async (req, res) => {
    try {
      const { coachId, clientProfileId, limit: limitStr, before } = req.query;
      if (!coachId || !clientProfileId) return res.status(400).json({ error: "coachId and clientProfileId required" });
      const pageLimit = Math.min(parseInt(limitStr as string) || 50, 100);

      let query = db.select().from(messages)
        .where(and(
          eq(messages.coachId, coachId as string),
          eq(messages.clientProfileId, clientProfileId as string),
          ...(before ? [sql`${messages.createdAt} < ${new Date(before as string)}`] : [])
        ))
        .orderBy(desc(messages.createdAt))
        .limit(pageLimit + 1);

      const result = await query;
      const hasMore = result.length > pageLimit;
      const pageMessages = result.slice(0, pageLimit).reverse();

      res.json({ messages: pageMessages, hasMore });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/messages/latest", async (req, res) => {
    try {
      const coachId = req.query.coachId as string;
      if (!coachId) return res.status(400).json({ error: "coachId required" });
      const allMessages = await db.select().from(messages)
        .where(eq(messages.coachId, coachId))
        .orderBy(desc(messages.createdAt));
      const result: Record<string, { text: string; senderRole: string; createdAt: string }> = {};
      for (const m of allMessages) {
        if (!result[m.clientProfileId]) {
          result[m.clientProfileId] = {
            text: m.text,
            senderRole: m.senderRole,
            createdAt: m.createdAt.toISOString(),
          };
        }
      }
      res.json(result);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const { coachId, clientProfileId, senderRole, text: msgText } = req.body;
      if (senderRole === 'coach') {
        const check = await isCoachOverLimit(coachId);
        if (check.overLimit) {
          return res.status(403).json({ error: `Your plan supports ${check.limit} client${check.limit !== 1 ? 's' : ''} but you have ${check.clientCount}. Please upgrade your plan or remove clients to continue messaging.`, code: 'PLAN_LIMIT_EXCEEDED' });
        }
      }
      if (containsProfanity(msgText)) {
        return res.status(400).json({ error: "Message contains inappropriate language. Please rephrase." });
      }
      const [msg] = await db.insert(messages).values({
        id: randomUUID(),
        coachId,
        clientProfileId,
        senderRole,
        text: msgText,
      }).returning();

      const targetProfileId = senderRole === 'coach' ? clientProfileId : coachId;
      let senderName = 'Someone';
      if (senderRole === 'coach') {
        const [coachProfile] = await db.select().from(profiles).where(eq(profiles.id, coachId));
        senderName = coachProfile?.name || 'Coach';
      } else {
        const [clientProfile] = await db.select().from(profiles).where(eq(profiles.id, clientProfileId));
        senderName = clientProfile?.name || 'Client';
      }

      const chatNotifTitle = `Message from ${senderName}`;
      const chatNotifBody = msgText.length > 80 ? msgText.slice(0, 80) + '...' : msgText;
      const [notif] = await db.insert(notifications).values({
        id: randomUUID(),
        profileId: targetProfileId,
        type: 'chat',
        title: chatNotifTitle,
        message: chatNotifBody,
        programId: coachId,
        programTitle: clientProfileId,
        exerciseName: senderName,
        fromRole: senderRole,
      }).returning();

      sendPushNotification(targetProfileId, chatNotifTitle, chatNotifBody, { type: 'chat', programId: coachId, programTitle: clientProfileId });

      broadcastToProfile(targetProfileId, {
        type: 'new_message',
        message: msg,
        notification: notif,
      });

      broadcastToProfile(senderRole === 'coach' ? coachId : clientProfileId, {
        type: 'message_sent',
        message: msg,
      });

      res.json(msg);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === CLIENT SEARCH ===
  app.get("/api/clients/search", async (req, res) => {
    try {
      const { coachId, q } = req.query;
      if (!coachId) return res.status(400).json({ error: "coachId required" });
      let result = await db.select().from(clients).where(eq(clients.coachId, coachId as string)).orderBy(desc(clients.joinedAt));
      if (q && typeof q === 'string' && q.trim()) {
        const query = q.trim().toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(query));
      }
      res.json(result);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === VIDEO UPLOAD ===
  app.post("/api/video-upload-url", async (req, res) => {
    try {
      const filename = `${randomUUID()}.mp4`;
      const key = `videos/${filename}`;
      const uploadUrl = await getPresignedUploadUrl(key, 'video/mp4', 600);
      res.json({ uploadUrl, filename, videoUrl: `/api/videos/${filename}` });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/register-video", async (req, res) => {
    try {
      const { filename, programId, exerciseId, uploadedBy, coachId } = req.body;
      if (!filename) return res.status(400).json({ error: "filename required" });
      if (programId && exerciseId && uploadedBy && coachId) {
        await db.insert(videoUploads).values({
          id: randomUUID(),
          filename,
          programId,
          exerciseId,
          uploadedBy,
          coachId,
        });
      }
      res.json({ success: true, videoUrl: `/api/videos/${filename}` });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/trim-video", async (req, res) => {
    try {
      const { filename, startTime, endTime } = req.body;
      if (!filename || startTime === undefined || endTime === undefined) {
        return res.status(400).json({ error: "filename, startTime, endTime required" });
      }
      const start = parseFloat(startTime);
      const end = parseFloat(endTime);
      if (isNaN(start) || isNaN(end) || end <= start) {
        return res.status(400).json({ error: "Invalid trim times" });
      }
      const key = `videos/${filename}`;
      const videoBuffer = await downloadFromR2(key);
      if (!videoBuffer) return res.status(404).json({ error: "Video not found in storage" });
      const trimmedBuffer = await trimVideoBuffer(videoBuffer, start, end);
      const trimmedFilename = `${randomUUID()}.mp4`;
      const trimmedKey = `videos/${trimmedFilename}`;
      await uploadToR2(trimmedKey, trimmedBuffer, 'video/mp4');
      await deleteFromR2(key);
      res.json({ filename: trimmedFilename, videoUrl: `/api/videos/${trimmedFilename}` });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/upload-video", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      let videoBuffer = req.file.buffer;
      const { programId, exerciseId, uploadedBy, coachId, trimStart, trimEnd } = req.body;
      if (trimStart !== undefined && trimEnd !== undefined) {
        const start = parseFloat(trimStart);
        const end = parseFloat(trimEnd);
        if (!isNaN(start) && !isNaN(end) && end > start) {
          videoBuffer = await trimVideoBuffer(videoBuffer, start, end);
        }
      }
      const filename = `${randomUUID()}.mp4`;
      const key = `videos/${filename}`;
      await uploadToR2(key, videoBuffer, 'video/mp4');
      const videoUrl = `/api/videos/${filename}`;
      if (programId && exerciseId && uploadedBy && coachId) {
        await db.insert(videoUploads).values({
          id: randomUUID(),
          filename,
          programId,
          exerciseId,
          uploadedBy,
          coachId,
        });
      }
      res.json({ videoUrl });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/videos/:filename", async (req, res) => {
    try {
      const key = `videos/${req.params.filename}`;
      const url = await getPresignedDownloadUrl(key, 3600);
      res.json({ url });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.post("/api/videos/:filename/viewed", async (req, res) => {
    try {
      const { filename } = req.params;
      const records = await db.update(videoUploads)
        .set({ coachViewedAt: new Date() })
        .where(and(eq(videoUploads.filename, filename), isNull(videoUploads.coachViewedAt)))
        .returning();
      res.json({ updated: records.length > 0 });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === AVATAR UPLOAD/DELETE ===
  app.post("/api/upload-avatar", upload.single("avatar"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = `${randomUUID()}${ext}`;
      const key = `avatars/${filename}`;
      await uploadToR2(key, req.file.buffer, req.file.mimetype || 'image/jpeg');
      const avatarUrl = `/api/avatars/${filename}`;
      const { profileId } = req.body;
      if (profileId) {
        const existing = await db.select().from(profiles).where(eq(profiles.id, profileId));
        if (existing.length > 0 && existing[0].avatarUrl) {
          const oldFilename = existing[0].avatarUrl.split('/').pop();
          if (oldFilename) {
            await deleteFromR2(`avatars/${oldFilename}`);
          }
        }
        await db.update(profiles).set({ avatarUrl }).where(eq(profiles.id, profileId));
      }
      res.json({ avatarUrl });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.get("/api/avatars/:filename", async (req, res) => {
    try {
      const key = `avatars/${req.params.filename}`;
      const result = await getFromR2(key);
      if (!result) return res.status(404).json({ error: "Not found" });
      res.setHeader('Content-Type', result.contentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      result.body.pipe(res);
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.delete("/api/avatar/:profileId", async (req, res) => {
    try {
      const { profileId } = req.params;
      const existing = await db.select().from(profiles).where(eq(profiles.id, profileId));
      if (existing.length > 0 && existing[0].avatarUrl) {
        const filename = existing[0].avatarUrl.split('/').pop();
        if (filename) {
          await deleteFromR2(`avatars/${filename}`);
        }
        await db.update(profiles).set({ avatarUrl: '' }).where(eq(profiles.id, profileId));
      }
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === SEED DEMO DATA ===
  app.post("/api/seed-demo", async (req, res) => {
    try {
      const coachId = randomUUID();
      const client1Id = randomUUID();
      const client2Id = randomUUID();

      const [coachProfile] = await db.insert(profiles).values({
        id: coachId,
        name: 'Coach Mike',
        role: 'coach',
        weightUnit: 'kg',
        coachCode: generateCode(),
      }).returning();

      const client1ProfileId = randomUUID();
      const client2ProfileId = randomUUID();

      await db.insert(profiles).values([
        { id: client1ProfileId, name: 'Sarah J.', role: 'client', weightUnit: 'kg', coachCode: generateCode() },
        { id: client2ProfileId, name: 'Alex T.', role: 'client', weightUnit: 'kg', coachCode: generateCode() },
      ]);

      await db.insert(clients).values([
        { id: client1Id, coachId, clientProfileId: client1ProfileId, name: 'Sarah J.' },
        { id: client2Id, coachId, clientProfileId: client2ProfileId, name: 'Alex T.' },
      ]);

      function ex(name: string, repsSets: string, weight: string, rpe: string, completed = false, clientNotes = '', coachComment = '', videoUrl = '') {
        return { id: randomUUID(), name, weight, repsSets, rpe, isCompleted: completed, notes: '', clientNotes, coachComment, videoUrl };
      }

      function makeWeeks(dpw: number, wks: number, dayTemplates: any[][]) {
        const weeks: any[] = [];
        for (let w = 1; w <= wks; w++) {
          const days: any[] = [];
          for (let d = 1; d <= dpw; d++) {
            const tpl = dayTemplates[(d - 1) % dayTemplates.length];
            days.push({ dayNumber: d, exercises: tpl.map((e: any) => ({ ...e, id: randomUUID() })) });
          }
          weeks.push({ weekNumber: w, days });
        }
        return weeks;
      }

      const sarahWeeks = makeWeeks(4, 8, [
        [ex('Back Squat','5x5','80','8',true,'Felt strong','Great job'), ex('Romanian Deadlift','3x10','60','7',true), ex('Leg Press','4x12','120','7',true), ex('Walking Lunges','3x12 each','16','6')],
        [ex('Bench Press','5x5','50','8',true,'Elbow flare','Tuck elbows more'), ex('Incline DB Press','4x8','18','7',true), ex('Cable Flyes','3x15','10','6'), ex('Tricep Pushdown','3x12','20','7')],
        [ex('Deadlift','3x5','100','9',true,'PR attempt!','Incredible pull!'), ex('Pull-ups','4x6','BW','8',true), ex('Barbell Row','4x8','50','7'), ex('Face Pulls','3x15','12','5')],
        [ex('Overhead Press','4x6','35','8'), ex('Lateral Raises','4x12','8','7'), ex('Rear Delt Flyes','3x15','6','6'), ex('Barbell Curl','3x10','20','6')],
      ]);

      const alexWeeks = makeWeeks(3, 6, [
        [ex('Squat','4x8','70','7',true,'Knees feel better'), ex('Leg Curl','3x12','35','7',true), ex('Leg Extension','3x12','40','7',true), ex('Calf Raise','4x15','60','6')],
        [ex('Bench Press','4x8','65','7',true,'','Good tempo'), ex('DB Row','4x10','28','7',true), ex('Dips','3x10','BW+10','8'), ex('Cable Curl','3x12','15','6')],
        [ex('Sumo Deadlift','3x6','110','8',false,'Lower back sore'), ex('Lat Pulldown','4x10','55','7'), ex('Seated OHP','3x10','25','7'), ex('Hammer Curls','3x10','14','6')],
      ]);

      const [sarahProg] = await db.insert(programs).values({
        id: randomUUID(),
        title: 'Strength Block A',
        description: '8-week progressive overload for Sarah',
        weeks: sarahWeeks,
        daysPerWeek: 4,
        shareCode: '',
        coachId,
        clientId: client1Id,
        status: 'active',
      }).returning();

      const [alexProg] = await db.insert(programs).values({
        id: randomUUID(),
        title: 'Hypertrophy Phase 1',
        description: '6-week muscle building for Alex',
        weeks: alexWeeks,
        daysPerWeek: 3,
        shareCode: '',
        coachId,
        clientId: client2Id,
        status: 'active',
      }).returning();

      await db.insert(notifications).values([
        { id: randomUUID(), profileId: coachId, type: 'video', title: 'Form Check Video', message: 'Sarah uploaded a video for Bench Press', programId: sarahProg.id, programTitle: sarahProg.title, exerciseName: 'Bench Press', fromRole: 'client' },
        { id: randomUUID(), profileId: coachId, type: 'notes', title: 'New Client Notes', message: 'Sarah added notes on Deadlift', programId: sarahProg.id, programTitle: sarahProg.title, exerciseName: 'Deadlift', fromRole: 'client' },
        { id: randomUUID(), profileId: coachId, type: 'completion', title: 'Exercise Completed', message: 'Alex completed Bench Press', programId: alexProg.id, programTitle: alexProg.title, exerciseName: 'Bench Press', fromRole: 'client', read: true },
        { id: randomUUID(), profileId: client1ProfileId, type: 'comment', title: 'New Coach Feedback', message: 'Coach commented on Back Squat: "Great job"', programId: sarahProg.id, programTitle: sarahProg.title, exerciseName: 'Back Squat', fromRole: 'coach' },
        { id: randomUUID(), profileId: client1ProfileId, type: 'comment', title: 'New Coach Feedback', message: 'Coach commented on Bench Press: "Tuck elbows more"', programId: sarahProg.id, programTitle: sarahProg.title, exerciseName: 'Bench Press', fromRole: 'coach' },
        { id: randomUUID(), profileId: client2ProfileId, type: 'comment', title: 'New Coach Feedback', message: 'Coach commented on Bench Press: "Good tempo"', programId: alexProg.id, programTitle: alexProg.title, exerciseName: 'Bench Press', fromRole: 'coach' },
      ]);

      await db.insert(messages).values([
        { id: randomUUID(), coachId, clientProfileId: client1ProfileId, senderRole: 'coach', text: 'Hey Sarah! Great work on your squat PR this week. Keep pushing!' },
        { id: randomUUID(), coachId, clientProfileId: client1ProfileId, senderRole: 'client', text: 'Thanks Coach! My form felt solid. Should I go heavier next week?' },
        { id: randomUUID(), coachId, clientProfileId: client1ProfileId, senderRole: 'coach', text: 'Yes, try adding 2.5kg. Focus on bracing at the bottom.' },
        { id: randomUUID(), coachId, clientProfileId: client2ProfileId, senderRole: 'coach', text: 'Alex, I noticed your deadlift notes mention lower back soreness. Let\'s talk about your setup.' },
        { id: randomUUID(), coachId, clientProfileId: client2ProfileId, senderRole: 'client', text: 'Yeah it was bothering me. Maybe I need to work on my hip hinge?' },
      ]);

      await db.insert(prs).values([
        { id: randomUUID(), profileId: coachId, liftType: 'squat', weight: 145, unit: 'kg', date: new Date(Date.now() - 7 * 86400000).toISOString(), notes: 'Comp squat PR' },
        { id: randomUUID(), profileId: coachId, liftType: 'bench', weight: 115, unit: 'kg', date: new Date(Date.now() - 14 * 86400000).toISOString(), notes: '' },
        { id: randomUUID(), profileId: coachId, liftType: 'deadlift', weight: 185, unit: 'kg', date: new Date(Date.now() - 3 * 86400000).toISOString(), notes: 'Conventional' },
      ]);

      res.json({ profileId: coachId, message: 'Demo data seeded' });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === ACCOUNT DELETION ===
  app.post("/api/account/delete", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: "Not authenticated" });

      const decoded = verifyToken(authHeader.slice(7));
      if (!decoded) return res.status(401).json({ error: "Invalid token" });

      const { confirmation } = req.body;
      if (confirmation !== 'DELETE') return res.status(400).json({ error: "Must confirm with DELETE" });

      const profileId = decoded.profileId;

      const profile = await db.select().from(profiles).where(eq(profiles.id, profileId)).then(r => r[0]);
      if (profile?.avatarUrl) {
        const avatarFilename = profile.avatarUrl.split('/').pop();
        if (avatarFilename) {
          await deleteFromR2(`avatars/${avatarFilename}`);
        }
      }

      const userVideos = await db.select().from(videoUploads).where(eq(videoUploads.uploadedBy, profileId));
      const coachVideos = await db.select().from(videoUploads).where(eq(videoUploads.coachId, profileId));
      for (const vid of [...userVideos, ...coachVideos]) {
        await deleteFromR2(`videos/${vid.filename}`);
      }
      if (userVideos.length > 0) {
        await db.delete(videoUploads).where(eq(videoUploads.uploadedBy, profileId));
      }
      if (coachVideos.length > 0) {
        await db.delete(videoUploads).where(eq(videoUploads.coachId, profileId));
      }

      const coachClients = await db.select().from(clients).where(eq(clients.coachId, profileId));
      const clientRecords = await db.select().from(clients).where(eq(clients.clientProfileId, profileId));
      const allClientIds = [...coachClients.map(c => c.id), ...clientRecords.map(c => c.id)];

      if (allClientIds.length > 0) {
        await db.delete(programs).where(inArray(programs.clientId, allClientIds));
      }
      await db.delete(programs).where(eq(programs.coachId, profileId));
      await db.delete(messages).where(eq(messages.coachId, profileId));
      await db.delete(messages).where(eq(messages.clientProfileId, profileId));
      await db.delete(notifications).where(eq(notifications.profileId, profileId));
      await db.delete(prs).where(eq(prs.profileId, profileId));
      await db.delete(clients).where(eq(clients.coachId, profileId));
      await db.delete(clients).where(eq(clients.clientProfileId, profileId));
      await db.delete(users).where(eq(users.id, decoded.userId));
      await db.delete(profiles).where(eq(profiles.id, profileId));

      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === DELETE SINGLE NOTIFICATION ===
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await db.delete(notifications).where(eq(notifications.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  // === DELETE NOTIFICATIONS BY PROGRAM ===
  app.delete("/api/notifications/by-program/:programId", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      await db.delete(notifications).where(
        and(eq(notifications.profileId, profileId), eq(notifications.programId, req.params.programId))
      );
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  app.put("/api/notifications/read-by-program/:programId", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      await db.update(notifications).set({ read: true }).where(
        and(eq(notifications.profileId, profileId), eq(notifications.programId, req.params.programId))
      );
      res.json({ ok: true });
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  const legalPageStyle = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #121212; color: #E5E5E5; font-family: 'Rubik', sans-serif; line-height: 1.7; padding: 24px; }
      .container { max-width: 680px; margin: 0 auto; }
      .back { display: inline-block; color: #E8512F; text-decoration: none; font-weight: 600; font-size: 14px; margin-bottom: 24px; }
      .back:hover { text-decoration: underline; }
      h1 { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 8px; }
      .updated { font-size: 13px; color: #888; margin-bottom: 32px; }
      h2 { font-size: 18px; font-weight: 600; color: #E8512F; margin-top: 28px; margin-bottom: 10px; }
      p, li { font-size: 15px; color: #ccc; margin-bottom: 10px; }
      ul { padding-left: 20px; margin-bottom: 12px; }
      a { color: #E8512F; }
    </style>`;

  app.get("/privacy", (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Privacy Policy - LiftFlow</title>${legalPageStyle}</head><body><div class="container">
      <a class="back" href="javascript:history.back()">Back</a>
      <h1>Privacy Policy</h1>
      <p class="updated">Last updated: February 2026</p>

      <h2>1. Information We Collect</h2>
      <p>When you use LiftFlow, we collect the following types of information:</p>
      <ul>
        <li><strong>Account information:</strong> Your email address, name, and hashed password when you create an account.</li>
        <li><strong>Profile information:</strong> Your profile picture (optional), role selection (coach or client), and preferred weight unit.</li>
        <li><strong>Workout data:</strong> Exercises, weights, sets, reps, RPE values, workout notes, and coach comments stored within your training programs.</li>
        <li><strong>Personal records (PRs):</strong> Squat, bench press, and deadlift records you choose to log.</li>
        <li><strong>Form check videos:</strong> Training videos you record and upload through the app for coach review.</li>
        <li><strong>Messages:</strong> Chat messages exchanged between coaches and clients within the app.</li>
        <li><strong>Usage data:</strong> Basic information about how you interact with the app, such as login timestamps.</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <p>We use your information solely to provide and improve the LiftFlow service:</p>
      <ul>
        <li>To create and manage your account</li>
        <li>To sync your workout programs, personal records, and messages across your devices</li>
        <li>To facilitate the coach-client relationship, including program sharing and form check reviews</li>
        <li>To display your profile picture to your connected coach or clients</li>
        <li>To send you relevant in-app notifications about your training</li>
      </ul>

      <h2>3. Data Storage & Security</h2>
      <p>Your data is securely stored on our servers using industry-standard security practices. Passwords are hashed using bcrypt and are never stored in plain text. All data is transmitted over encrypted HTTPS connections. We take reasonable technical and organizational measures to protect your information from unauthorized access, alteration, or destruction.</p>

      <h2>4. Video Uploads & Auto-Deletion</h2>
      <p>Form check videos you upload are stored on our servers and are only accessible by you and your connected coach. Videos are <strong>not</strong> shared publicly or with any other users. To protect your privacy and manage storage, videos are automatically deleted according to the following schedule:</p>
      <ul>
        <li><strong>3 days</strong> after your coach views the video</li>
        <li><strong>7 days</strong> after upload if the video has not been viewed by your coach</li>
      </ul>

      <h2>5. Profile Pictures</h2>
      <p>If you upload a profile picture, it is visible to your connected coach (if you are a client) or your connected clients (if you are a coach). When you upload a new profile picture, the previous one is automatically deleted. You can remove your profile picture at any time from the Profile screen.</p>

      <h2>6. Third-Party Sharing</h2>
      <p>We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing or advertising purposes. Your information stays within LiftFlow and is used solely to provide our service to you. We do not use third-party analytics or advertising SDKs.</p>

      <h2>7. Data Retention</h2>
      <p>We retain your account data for as long as your account is active. If you delete your account, all associated data — including your profile, programs, personal records, messages, videos, and profile picture — is permanently and immediately deleted from our servers. This action cannot be undone.</p>

      <h2>8. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access</strong> your personal data through the app at any time</li>
        <li><strong>Update</strong> your personal information (name, profile picture, weight unit) from the Profile screen</li>
        <li><strong>Delete</strong> your account and all associated data permanently from the Profile screen</li>
        <li><strong>Request</strong> a copy of your data by contacting us at the email below</li>
      </ul>

      <h2>9. Children's Privacy</h2>
      <p>LiftFlow is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete that information promptly. If you believe a child under 13 has provided us with personal data, please contact us immediately.</p>

      <h2>10. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. When we make significant changes, we will notify you through the app or by updating the "Last updated" date at the top of this page. We encourage you to review this policy periodically.</p>

      <h2>11. Contact Us</h2>
      <p>If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at <a href="mailto:support@liftflow.app">support@liftflow.app</a>.</p>
    </div></body></html>`);
  });

  app.get("/terms", (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Terms of Service - LiftFlow</title>${legalPageStyle}</head><body><div class="container">
      <a class="back" href="javascript:history.back()">Back</a>
      <h1>Terms of Service</h1>
      <p class="updated">Last updated: February 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By creating an account or using LiftFlow, you agree to be bound by these Terms of Service and our <a href="/privacy">Privacy Policy</a>. If you do not agree to these terms, please do not use the app.</p>

      <h2>2. Eligibility</h2>
      <p>You must be at least 13 years old to create an account and use LiftFlow. If you are between 13 and 18 years old, you must have the consent of a parent or legal guardian. By using the app, you represent that you meet these age requirements.</p>

      <h2>3. Description of Service</h2>
      <p>LiftFlow is a fitness coaching platform that connects coaches and clients. Coaches can create and assign training programs, review form-check videos, and communicate with clients through in-app messaging. The service is provided for personal, non-commercial fitness coaching purposes.</p>

      <h2>4. User Accounts</h2>
      <p>You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to:</p>
      <ul>
        <li>Provide accurate and complete information when creating your account</li>
        <li>Keep your password secure and not share it with others</li>
        <li>Notify us immediately of any unauthorized use of your account</li>
      </ul>
      <p>LiftFlow is not liable for any loss or damage resulting from unauthorized access to your account.</p>

      <h2>5. User Content</h2>
      <p>You retain ownership of all content you create or upload to LiftFlow, including workout data, training videos, profile pictures, and notes. By using the service, you grant LiftFlow a limited, non-exclusive license to store, process, and display your content as necessary to provide the service. This license ends when you delete your content or your account.</p>

      <h2>6. Acceptable Use</h2>
      <p>You agree not to use LiftFlow to:</p>
      <ul>
        <li>Harass, abuse, or threaten other users</li>
        <li>Upload harmful, offensive, inappropriate, or illegal content</li>
        <li>Attempt to gain unauthorized access to other accounts or systems</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code of the app</li>
        <li>Use the platform for any purpose other than its intended fitness coaching functionality</li>
        <li>Create multiple accounts for the purpose of abuse or circumventing restrictions</li>
      </ul>

      <h2>7. Coach-Client Relationship</h2>
      <p>LiftFlow is a platform that facilitates communication between coaches and clients. LiftFlow does not employ, endorse, or certify any coaches on the platform. LiftFlow is not a medical provider, fitness advisor, or healthcare professional. Any fitness advice provided through the platform is the sole responsibility of the coach providing it. Always consult a qualified medical professional before starting any exercise program.</p>

      <h2>8. Account Deletion</h2>
      <p>You may delete your account at any time from the Profile screen within the app. Upon deletion, all of your data — including your profile, programs, personal records, messages, videos, and profile picture — will be permanently and immediately removed from our servers. This action cannot be undone.</p>

      <h2>9. Termination</h2>
      <p>We reserve the right to suspend or terminate your account at any time if we reasonably believe you have violated these Terms of Service. Upon termination, your right to use LiftFlow will immediately cease. We may also remove any content that violates these terms.</p>

      <h2>10. Disclaimer of Warranties</h2>
      <p>LiftFlow is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee that the service will be uninterrupted, secure, or error-free.</p>

      <h2>11. Limitation of Liability</h2>
      <p>To the fullest extent permitted by applicable law, LiftFlow and its owners, operators, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service, including but not limited to any injuries sustained during workouts, loss of data, or service interruptions.</p>

      <h2>12. Governing Law</h2>
      <p>These Terms of Service shall be governed by and construed in accordance with the laws of the jurisdiction in which LiftFlow operates, without regard to its conflict of law provisions.</p>

      <h2>13. Changes to Terms</h2>
      <p>We may update these Terms of Service from time to time. When we make significant changes, we will update the "Last updated" date at the top of this page. Continued use of LiftFlow after changes are posted constitutes your acceptance of the revised terms. We encourage you to review these terms periodically.</p>

      <h2>14. Contact Us</h2>
      <p>If you have any questions about these Terms of Service, please contact us at <a href="mailto:support@liftflow.app">support@liftflow.app</a>.</p>
    </div></body></html>`);
  });

  async function cleanupExpiredVideos() {
    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const toDelete = await db.select({
        id: videoUploads.id, filename: videoUploads.filename,
        programId: videoUploads.programId, exerciseId: videoUploads.exerciseId,
      }).from(videoUploads).where(
        or(
          and(isNotNull(videoUploads.coachViewedAt), lt(videoUploads.coachViewedAt, threeDaysAgo)),
          and(isNull(videoUploads.coachViewedAt), lt(videoUploads.uploadedAt, sevenDaysAgo))
        )
      );

      for (const record of toDelete) {
        const allPrograms = await db.select().from(programs)
          .where(eq(programs.id, record.programId));

        for (const prog of allPrograms) {
          const weeks = Array.isArray(prog.weeks) ? (prog.weeks as any[]) : [];
          let changed = false;
          for (const week of weeks) {
            for (const day of (week.days || [])) {
              for (const ex of (day.exercises || [])) {
                if (ex.id === record.exerciseId && ex.videoUrl && ex.videoUrl.includes(record.filename)) {
                  ex.videoUrl = '';
                  changed = true;
                }
              }
            }
          }
          if (changed) {
            await db.update(programs).set({ weeks }).where(eq(programs.id, prog.id));
          }
        }

        await db.delete(videoUploads).where(eq(videoUploads.id, record.id));

        try {
          await deleteFromR2(`videos/${record.filename}`);
        } catch (r2Err) {
          console.error(`[Video Cleanup] R2 delete failed for ${record.filename}:`, r2Err);
        }
      }

      if (toDelete.length > 0) {
        console.log(`[Video Cleanup] Deleted ${toDelete.length} expired video(s)`);
      }
    } catch (err) {
      console.error('[Video Cleanup] Error:', err);
    }
  }

  setInterval(cleanupExpiredVideos, 60 * 60 * 1000);
  cleanupExpiredVideos();

  app.post("/api/webhooks/payment", async (req, res) => {
    try {
      console.log('[Payment Webhook] Received body:', JSON.stringify(req.body));
      const { webhookSecret, email, plan, durationDays, userCount, tier, status, clientCount, maxClients, quantity } = req.body;

      const expectedSecret = process.env.LIFTFLOW_WEBHOOK_SECRET;
      if (!expectedSecret || webhookSecret !== expectedSecret) {
        return res.status(401).json({ success: false, error: "Invalid webhook secret" });
      }

      if (!email) {
        return res.status(400).json({ success: false, error: "Missing email" });
      }

      const resolvedTier = tier || plan || 'free';
      const rawCount = userCount || clientCount || maxClients || quantity;
      const resolvedUserLimit = rawCount
        ? Number(rawCount)
        : resolvedTier === 'tier_5' ? 5
        : resolvedTier === 'tier_10' ? 10
        : resolvedTier === 'enterprise' ? 999
        : 15;

      const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const userProfile = await db.select().from(profiles).where(eq(profiles.id, user[0].profileId)).limit(1);
      if (userProfile.length === 0) {
        return res.status(404).json({ success: false, error: "Profile not found" });
      }

      if (status === 'cancelled' || resolvedTier === 'free') {
        const currentProfile = userProfile[0];
        if (currentProfile.planExpiresAt && new Date(currentProfile.planExpiresAt) > new Date()) {
          await db.update(profiles).set({
            plan: currentProfile.plan || 'free',
            planUserLimit: currentProfile.planUserLimit || 1,
            planExpiresAt: currentProfile.planExpiresAt,
            planCancelledAt: new Date(),
          }).where(eq(profiles.id, currentProfile.id));
          console.log(`[Payment Webhook] Cancellation for ${email}: keeping plan until ${currentProfile.planExpiresAt}`);
        } else {
          await db.update(profiles).set({
            plan: 'free',
            planUserLimit: 1,
            planExpiresAt: null,
            planCancelledAt: new Date(),
          }).where(eq(profiles.id, currentProfile.id));
        }
      } else {
        const expiresAt = durationDays
          ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        await db.update(profiles).set({
          plan: resolvedTier,
          planUserLimit: resolvedUserLimit,
          planExpiresAt: expiresAt,
        }).where(eq(profiles.id, userProfile[0].id));
      }

      console.log(`[Payment Webhook] Updated plan for ${email}: ${resolvedTier}, limit: ${resolvedUserLimit}`);
      res.json({ success: true, email, plan: resolvedTier });
    } catch (e: any) {
      console.error('[Payment Webhook] Error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/dashboard", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });

      await checkAndDowngradeExpiredPlan(profileId);
      const [profileResult] = await db.select().from(profiles).where(eq(profiles.id, profileId));
      if (!profileResult) return res.status(404).json({ error: "Profile not found" });

      const programColumns = {
        id: programs.id, title: programs.title, description: programs.description,
        weeks: programs.weeks, daysPerWeek: programs.daysPerWeek, shareCode: programs.shareCode,
        coachId: programs.coachId, clientId: programs.clientId, status: programs.status,
        publishedWeeks: programs.publishedWeeks,
        updatedAt: programs.updatedAt, updatedBy: programs.updatedBy, createdAt: programs.createdAt,
      };

      if (profileResult.role === 'coach') {
        const [userPrograms, allPRs, allNotifs, clientResults] = await Promise.all([
          db.select(programColumns).from(programs).where(eq(programs.coachId, profileId)),
          db.select().from(prs).where(eq(prs.profileId, profileId)),
          db.select().from(notifications).where(eq(notifications.profileId, profileId)).orderBy(desc(notifications.createdAt)),
          db.select({
            id: clients.id, coachId: clients.coachId, clientProfileId: clients.clientProfileId,
            name: clients.name, joinedAt: clients.joinedAt, avatarUrl: profiles.avatarUrl,
          }).from(clients)
            .leftJoin(profiles, eq(clients.clientProfileId, profiles.id))
            .where(eq(clients.coachId, profileId))
            .orderBy(desc(clients.joinedAt)),
        ]);
        const coachClients = clientResults.map(c => ({ ...c, avatarUrl: c.avatarUrl || '' }));

        const latestMessages: Record<string, any> = {};
        if (coachClients.length > 0) {
          const clientProfileIds = coachClients.map(c => c.clientProfileId);
          for (const cpId of clientProfileIds) {
            const [latestMsg] = await db.select({ text: messages.text, senderRole: messages.senderRole, createdAt: messages.createdAt })
              .from(messages)
              .where(and(eq(messages.coachId, profileId), eq(messages.clientProfileId, cpId)))
              .orderBy(desc(messages.createdAt))
              .limit(1);
            if (latestMsg) {
              latestMessages[cpId] = { text: latestMsg.text, senderRole: latestMsg.senderRole, createdAt: latestMsg.createdAt.toISOString() };
            }
          }
        }

        res.json({ profile: profileResult, programs: userPrograms, prs: allPRs, notifications: allNotifs, clients: coachClients, latestMessages });
      } else {
        const [clientRecords, allPRs, allNotifs] = await Promise.all([
          db.select().from(clients).where(eq(clients.clientProfileId, profileId)),
          db.select().from(prs).where(eq(prs.profileId, profileId)),
          db.select().from(notifications).where(eq(notifications.profileId, profileId)).orderBy(desc(notifications.createdAt)),
        ]);
        const clientRecordIds = new Set(clientRecords.map(c => c.id));
        const userPrograms = await db.select(programColumns).from(programs).where(
          or(
            and(eq(programs.coachId, profileId), isNull(programs.clientId)),
            ...(clientRecordIds.size > 0 ? [inArray(programs.clientId, Array.from(clientRecordIds))] : [])
          )
        );

        res.json({ profile: profileResult, programs: userPrograms, prs: allPRs, notifications: allNotifs, clients: [], latestMessages: {} });
      }
    } catch (e: any) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
  });

  const httpServer = createServer(app);

  const { setupWebSocket } = await import("./websocket");
  setupWebSocket(httpServer);

  return httpServer;
}
