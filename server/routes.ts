import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { db } from "./db";
import { profiles, programs, clients, prs, notifications, messages, users, videoUploads } from "../shared/schema";
import { eq, desc, and, or, inArray, ilike, lt, isNull, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || 'liftflow-dev-secret';

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

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // === AUTH ===
  app.post("/api/auth/register", async (req, res) => {
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/auth/login", async (req, res) => {
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: "Not authenticated" });

      const decoded = verifyToken(authHeader.slice(7));
      if (!decoded) return res.status(401).json({ error: "Invalid token" });

      const [profile] = await db.select().from(profiles).where(eq(profiles.id, decoded.profileId));
      if (!profile) return res.status(404).json({ error: "Profile not found" });

      res.json({ profile });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/profiles/:id", async (req, res) => {
    try {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, req.params.id));
      if (!profile) return res.status(404).json({ error: "Not found" });
      res.json(profile);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/profiles/:id", async (req, res) => {
    try {
      const { name, role, weightUnit, coachCode } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (weightUnit !== undefined) updates.weightUnit = weightUnit;
      if (coachCode !== undefined) updates.coachCode = coachCode;
      const [updated] = await db.update(profiles).set(updates).where(eq(profiles.id, req.params.id)).returning();
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/profiles/:id/reset-code", async (req, res) => {
    try {
      const newCode = generateCode();
      const [updated] = await db.update(profiles).set({ coachCode: newCode }).where(eq(profiles.id, req.params.id)).returning();
      res.json({ coachCode: updated.coachCode });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Find coach by code
  app.get("/api/coaches/by-code/:code", async (req, res) => {
    try {
      const allProfiles = await db.select().from(profiles);
      const coach = allProfiles.find(p => p.coachCode === req.params.code.toUpperCase() && p.role === 'coach');
      if (!coach) return res.status(404).json({ error: "Coach not found" });
      res.json({ id: coach.id, name: coach.name, coachCode: coach.coachCode });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === PROGRAMS ===
  app.get("/api/programs", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      const profile = await db.select().from(profiles).where(eq(profiles.id, profileId));
      if (!profile.length) return res.status(404).json({ error: "Profile not found" });

      const clientRecords = await db.select().from(clients).where(eq(clients.clientProfileId, profileId));
      const clientRecordIds = clientRecords.map(c => c.id);

      const conditions = [eq(programs.coachId, profileId)];
      if (clientRecordIds.length > 0) {
        conditions.push(inArray(programs.clientId, clientRecordIds));
      }

      const result = await db.select().from(programs).where(or(...conditions)).orderBy(desc(programs.createdAt));
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/programs/:id", async (req, res) => {
    try {
      const [program] = await db.select().from(programs).where(eq(programs.id, req.params.id));
      if (!program) return res.status(404).json({ error: "Not found" });
      res.json(program);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/programs", async (req, res) => {
    try {
      const { title, description, weeks, daysPerWeek, coachId, clientId, status } = req.body;
      const [program] = await db.insert(programs).values({
        id: randomUUID(),
        title,
        description: description || '',
        weeks,
        daysPerWeek: daysPerWeek || 3,
        shareCode: generateCode(),
        coachId,
        clientId: clientId || null,
        status: status || 'active',
      }).returning();
      res.json(program);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/programs/:id", async (req, res) => {
    try {
      const { title, description, weeks, daysPerWeek, clientId, status } = req.body;
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (weeks !== undefined) updates.weeks = weeks;
      if (daysPerWeek !== undefined) updates.daysPerWeek = daysPerWeek;
      if (clientId !== undefined) updates.clientId = clientId;
      if (status !== undefined) updates.status = status;
      const [updated] = await db.update(programs).set(updates).where(eq(programs.id, req.params.id)).returning();
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/programs/:id", async (req, res) => {
    try {
      await db.delete(programs).where(eq(programs.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === CLIENTS ===
  app.get("/api/clients", async (req, res) => {
    try {
      const coachId = req.query.coachId as string;
      if (!coachId) return res.status(400).json({ error: "coachId required" });
      const result = await db.select().from(clients).where(eq(clients.coachId, coachId)).orderBy(desc(clients.joinedAt));
      const enriched = await Promise.all(result.map(async (c) => {
        if (c.clientProfileId) {
          const [prof] = await db.select({ avatarUrl: profiles.avatarUrl }).from(profiles).where(eq(profiles.id, c.clientProfileId));
          return { ...c, avatarUrl: prof?.avatarUrl || '' };
        }
        return { ...c, avatarUrl: '' };
      }));
      res.json(enriched);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      await db.delete(clients).where(eq(clients.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Join coach by code
  app.post("/api/join-coach", async (req, res) => {
    try {
      const { code, clientProfileId, clientName } = req.body;
      const allProfiles = await db.select().from(profiles);
      const coach = allProfiles.find(p => p.coachCode === code.toUpperCase() && p.role === 'coach');
      if (!coach) return res.status(404).json({ error: "Invalid coach code" });

      const existing = await db.select().from(clients).where(
        and(eq(clients.coachId, coach.id), eq(clients.clientProfileId, clientProfileId))
      );
      if (existing.length > 0) return res.json({ coach: { id: coach.id, name: coach.name }, client: existing[0] });

      const anyCoach = await db.select().from(clients).where(eq(clients.clientProfileId, clientProfileId));
      if (anyCoach.length > 0) {
        return res.status(400).json({ error: "You already have a coach. Remove your current coach before joining a new one." });
      }

      const coachProfile = await db.select().from(profiles).where(eq(profiles.id, coach.id)).limit(1);
      if (coachProfile.length > 0) {
        const plan = coachProfile[0].plan || 'free';
        const limit = coachProfile[0].planUserLimit || 1;
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/leave-coach", async (req, res) => {
    try {
      const { clientProfileId } = req.body;
      if (!clientProfileId) return res.status(400).json({ error: "clientProfileId required" });
      await db.delete(clients).where(eq(clients.clientProfileId, clientProfileId));
      await db.delete(messages).where(eq(messages.clientProfileId, clientProfileId));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === PRs ===
  app.get("/api/prs", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      const result = await db.select().from(prs).where(eq(prs.profileId, profileId));
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/prs/:id", async (req, res) => {
    try {
      await db.delete(prs).where(eq(prs.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === NOTIFICATIONS ===
  app.get("/api/notifications", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      const result = await db.select().from(notifications).where(eq(notifications.profileId, profileId)).orderBy(desc(notifications.createdAt));
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const { profileId, type, title, message, programId, programTitle, exerciseName, fromRole } = req.body;
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
      res.json(notif);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      await db.update(notifications).set({ read: true }).where(eq(notifications.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      await db.update(notifications).set({ read: true }).where(eq(notifications.profileId, profileId));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/notifications", async (req, res) => {
    try {
      const profileId = req.query.profileId as string;
      if (!profileId) return res.status(400).json({ error: "profileId required" });
      await db.delete(notifications).where(eq(notifications.profileId, profileId));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === MESSAGES (Chat) ===
  app.get("/api/messages", async (req, res) => {
    try {
      const { coachId, clientProfileId } = req.query;
      if (!coachId || !clientProfileId) return res.status(400).json({ error: "coachId and clientProfileId required" });
      const result = await db.select().from(messages)
        .where(and(eq(messages.coachId, coachId as string), eq(messages.clientProfileId, clientProfileId as string)))
        .orderBy(messages.createdAt);
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/messages/latest", async (req, res) => {
    try {
      const coachId = req.query.coachId as string;
      if (!coachId) return res.status(400).json({ error: "coachId required" });
      const allCoachClients = await db.select().from(clients).where(eq(clients.coachId, coachId));
      const result: Record<string, { text: string; senderRole: string; createdAt: string }> = {};
      for (const c of allCoachClients) {
        const [latest] = await db.select().from(messages)
          .where(and(eq(messages.coachId, coachId), eq(messages.clientProfileId, c.clientProfileId)))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        if (latest) {
          result[c.clientProfileId] = {
            text: latest.text,
            senderRole: latest.senderRole,
            createdAt: latest.createdAt.toISOString(),
          };
        }
      }
      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const { coachId, clientProfileId, senderRole, text: msgText } = req.body;
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

      await db.insert(notifications).values({
        id: randomUUID(),
        profileId: targetProfileId,
        type: 'chat',
        title: `Message from ${senderName}`,
        message: msgText.length > 80 ? msgText.slice(0, 80) + '...' : msgText,
        programId: coachId,
        programTitle: clientProfileId,
        exerciseName: senderName,
        fromRole: senderRole,
      });

      res.json(msg);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === VIDEO UPLOAD ===
  app.post("/api/upload-video", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const videoUrl = `/api/videos/${req.file.filename}`;
      const { programId, exerciseId, uploadedBy, coachId } = req.body;
      if (programId && exerciseId && uploadedBy && coachId) {
        await db.insert(videoUploads).values({
          id: randomUUID(),
          filename: req.file.filename,
          programId,
          exerciseId,
          uploadedBy,
          coachId,
        });
      }
      res.json({ videoUrl });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/videos/:filename", (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
    res.sendFile(filePath);
  });

  app.post("/api/videos/:filename/viewed", async (req, res) => {
    try {
      const { filename } = req.params;
      const records = await db.update(videoUploads)
        .set({ coachViewedAt: new Date() })
        .where(and(eq(videoUploads.filename, filename), isNull(videoUploads.coachViewedAt)))
        .returning();
      res.json({ updated: records.length > 0 });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === AVATAR UPLOAD/DELETE ===
  app.post("/api/upload-avatar", upload.single("avatar"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const avatarUrl = `/api/avatars/${req.file.filename}`;
      const { profileId } = req.body;
      if (profileId) {
        const existing = await db.select().from(profiles).where(eq(profiles.id, profileId));
        if (existing.length > 0 && existing[0].avatarUrl) {
          const oldFilename = existing[0].avatarUrl.split('/').pop();
          if (oldFilename) {
            const oldPath = path.join(uploadsDir, oldFilename);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
        }
        await db.update(profiles).set({ avatarUrl }).where(eq(profiles.id, profileId));
      }
      res.json({ avatarUrl });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/avatars/:filename", (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
    res.sendFile(filePath);
  });

  app.delete("/api/avatar/:profileId", async (req, res) => {
    try {
      const { profileId } = req.params;
      const existing = await db.select().from(profiles).where(eq(profiles.id, profileId));
      if (existing.length > 0 && existing[0].avatarUrl) {
        const filename = existing[0].avatarUrl.split('/').pop();
        if (filename) {
          const filePath = path.join(uploadsDir, filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await db.update(profiles).set({ avatarUrl: '' }).where(eq(profiles.id, profileId));
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
        shareCode: generateCode(),
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
        shareCode: generateCode(),
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
          const avatarPath = path.join(uploadsDir, avatarFilename);
          if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
        }
      }

      const userVideos = await db.select().from(videoUploads).where(eq(videoUploads.uploadedBy, profileId));
      const coachVideos = await db.select().from(videoUploads).where(eq(videoUploads.coachId, profileId));
      for (const vid of [...userVideos, ...coachVideos]) {
        const vidPath = path.join(uploadsDir, vid.filename);
        if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // === DELETE SINGLE NOTIFICATION ===
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await db.delete(notifications).where(eq(notifications.id, req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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

      const viewedExpired = await db.select().from(videoUploads)
        .where(and(isNotNull(videoUploads.coachViewedAt), lt(videoUploads.coachViewedAt, threeDaysAgo)));

      const unviewedExpired = await db.select().from(videoUploads)
        .where(and(isNull(videoUploads.coachViewedAt), lt(videoUploads.uploadedAt, sevenDaysAgo)));

      const toDelete = [...viewedExpired, ...unviewedExpired];

      for (const record of toDelete) {
        const filePath = path.join(uploadsDir, record.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        const allPrograms = await db.select().from(programs)
          .where(eq(programs.id, record.programId));

        for (const prog of allPrograms) {
          const weeks = prog.weeks as any[];
          let changed = false;
          for (const week of weeks) {
            for (const day of week.days) {
              for (const ex of day.exercises) {
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
        await db.update(profiles).set({
          plan: 'free',
          planUserLimit: 1,
          planExpiresAt: null,
        }).where(eq(profiles.id, userProfile[0].id));
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

  const httpServer = createServer(app);
  return httpServer;
}
