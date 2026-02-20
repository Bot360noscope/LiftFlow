# LiftFlow - Fitness Coaching Mobile App

## Overview
LiftFlow is a mobile fitness coaching app built with Expo + Express. It centers on the **coach-client workflow**: coaches build programs using an Excel-style spreadsheet builder, clients fill in their actual weights/reps/completion/notes/videos, and coaches review and comment.

## Architecture
- **Frontend**: Expo Router (file-based routing) with React Native on port 8081
- **Backend**: Express serving on port 5000 (landing page + REST API)
- **Database**: PostgreSQL via Drizzle ORM (shared/schema.ts)
- **Data Flow**: Frontend → lib/storage.ts (API client) → Express API → PostgreSQL
- **Video**: expo-image-picker for native camera recording, multer for server-side upload handling
- **Theme**: Dark mode with energetic orange/red palette (#E8512F)

## Database Schema (shared/schema.ts)
- **profiles**: id, name, role (coach/client), weightUnit, coachCode, createdAt
- **programs**: id, profileId, clientId, title, totalWeeks, daysPerWeek, rowCount, shareCode, exercises (JSONB), createdAt, updatedAt
- **clients**: id, coachId, name, email, joinedAt
- **prs**: id, profileId, liftType, weight, date
- **notifications**: id, profileId, title, message, type, isRead, createdAt

## API Endpoints (server/routes.ts)
- POST /api/profiles, GET /api/profiles/:id, PUT /api/profiles/:id
- GET /api/programs?profileId=X, GET /api/programs/:id, POST /api/programs, PUT /api/programs/:id, DELETE /api/programs/:id
- GET /api/clients?coachId=X, POST /api/clients, DELETE /api/clients/:id
- GET /api/prs?profileId=X, POST /api/prs, DELETE /api/prs/:id
- GET /api/notifications?profileId=X, POST /api/notifications, PUT /api/notifications/:id/read
- POST /api/upload-video, GET /api/videos/:filename
- POST /api/seed-demo, POST /api/join-coach

## Key Data Model
- **Program exercises**: Stored as JSONB array of WorkoutWeek → WorkoutDay → Exercise objects
- **Exercise**: exerciseName, prescription, weight, rpe, videoUrl, isCompleted, clientNotes, coachComment
- **Client editing**: Clients can only modify weight, completion, notes, and videos; exercise prescription is coach-controlled

## Core Screens
- **Home** (tabs/index.tsx): Role-based dashboard, coach code display, stats, recent programs, client cards
- **Programs** (tabs/programs.tsx): List of all programs with share codes, progress bars
- **Program Detail** (program/[id].tsx): Excel-style spreadsheet with week selector, day columns, exercise rows. Video recording via native camera
- **Progress** (tabs/progress.tsx): PR tracking for squat/bench/deadlift with estimated total
- **Profile** (tabs/profile.tsx): Name, role toggle, weight unit, coach code, "Load Demo Data" button
- **Client Detail** (client/[id].tsx): Client's programs with "New Program" button
- **Create Program** (create-program.tsx): Configure weeks/days/rows or use quick-start template
- **Add PR** (add-pr.tsx): Log personal records

## User Preferences
- Fonts: Rubik (400, 500, 600, 700)
- Dark theme with orange primary color
- Coach-client workflow is the core feature
