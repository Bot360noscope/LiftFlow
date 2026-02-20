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
      res.json(result);
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

      const [client] = await db.insert(clients).values({
        id: randomUUID(),
        coachId: coach.id,
        clientProfileId,
        name: clientName || 'Client',
      }).returning();
      res.json({ coach: { id: coach.id, name: coach.name }, client });
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

  app.post("/api/messages", async (req, res) => {
    try {
      const { coachId, clientProfileId, senderRole, text: msgText } = req.body;
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
        programId: '',
        programTitle: '',
        exerciseName: '',
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
      <p>When you use LiftFlow, we collect the following information:</p>
      <ul>
        <li>Account information: your email address and name</li>
        <li>Workout data: exercises, weights, sets, reps, and RPE values</li>
        <li>Personal records (PRs) you log</li>
        <li>Training videos you upload for form checks</li>
        <li>Chat messages between coaches and clients</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <p>We use your data to provide the LiftFlow coaching service, including syncing your workout programs, personal records, and messages across your devices. Your data powers the features you use every day.</p>

      <h2>3. Data Storage & Security</h2>
      <p>Your data is securely stored on our servers. Passwords are hashed using industry-standard algorithms and are never stored in plain text. We take reasonable measures to protect your information from unauthorized access.</p>

      <h2>4. Video Uploads</h2>
      <p>Training videos you upload are stored on our servers and are only accessible by you and your coach. Videos are not shared publicly or with any other users.</p>

      <h2>5. Third Parties</h2>
      <p>We do not sell or share your personal data with third parties. Your information stays within LiftFlow and is used solely to provide our service to you.</p>

      <h2>6. Account Deletion</h2>
      <p>You can permanently delete your account and all associated data at any time from the Profile screen within the app. Once deleted, your data cannot be recovered.</p>

      <h2>7. Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@liftflow.app">support@liftflow.app</a>.</p>
    </div></body></html>`);
  });

  app.get("/terms", (_req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Terms of Service - LiftFlow</title>${legalPageStyle}</head><body><div class="container">
      <a class="back" href="javascript:history.back()">Back</a>
      <h1>Terms of Service</h1>
      <p class="updated">Last updated: February 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>By accessing or using LiftFlow, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.</p>

      <h2>2. Description of Service</h2>
      <p>LiftFlow is a fitness coaching platform that connects coaches and clients. Coaches can create and assign training programs, review form-check videos, and communicate with clients through in-app messaging.</p>

      <h2>3. User Accounts</h2>
      <p>You are responsible for keeping your login credentials secure. You agree to notify us immediately of any unauthorized use of your account. LiftFlow is not liable for any loss resulting from unauthorized access to your account.</p>

      <h2>4. User Content</h2>
      <p>You retain ownership of all content you create or upload to LiftFlow, including workout data, training videos, and notes. By using the service, you grant LiftFlow a limited license to store and display your content as needed to provide the service.</p>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to use LiftFlow to:</p>
      <ul>
        <li>Harass, abuse, or threaten other users</li>
        <li>Upload harmful, offensive, or illegal content</li>
        <li>Attempt to gain unauthorized access to other accounts or systems</li>
        <li>Use the platform for any purpose other than its intended fitness coaching functionality</li>
      </ul>

      <h2>6. Coach-Client Relationship</h2>
      <p>LiftFlow is a platform that facilitates communication between coaches and clients. LiftFlow is not a medical provider, fitness advisor, or healthcare professional. Any fitness advice provided through the platform is the sole responsibility of the coach. Always consult a qualified professional before starting any exercise program.</p>

      <h2>7. Limitation of Liability</h2>
      <p>LiftFlow is provided "as is" without warranties of any kind. To the fullest extent permitted by law, LiftFlow shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service, including any injuries sustained during workouts.</p>

      <h2>8. Changes to Terms</h2>
      <p>We may update these Terms of Service from time to time. Continued use of LiftFlow after changes are posted constitutes your acceptance of the revised terms. We encourage you to review these terms periodically.</p>

      <h2>9. Contact Us</h2>
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

  const httpServer = createServer(app);
  return httpServer;
}
