# LiftFlow - Fitness Coaching Mobile App

## Overview
LiftFlow is a mobile fitness coaching app built with Expo + Express. It centers on the **coach-client workflow**: coaches build programs using an Excel-style spreadsheet builder, clients fill in their actual weights/reps/completion/notes/videos, and coaches review and comment.

## Architecture
- **Frontend**: Expo Router (file-based routing) with React Native on port 8081
- **Backend**: Express serving on port 5000 (landing page + REST API)
- **Database**: PostgreSQL via Drizzle ORM (shared/schema.ts)
- **Data Flow**: Frontend → lib/storage.ts (API client) → Express API → PostgreSQL
- **WebSocket**: Real-time messaging and notifications via ws library on /ws path. Server: server/websocket.ts broadcasts events. Client: lib/websocket.ts manages connection, auto-reconnect, and event listeners. Events: new_message, message_sent, new_notification
- **Polling**: Home screen polls /api/dashboard every 10 seconds. Chat screens use 15-30s fallback polling with WebSocket as primary. Tab badge uses 10s polling + WebSocket
- **Caching**: All data cached in AsyncStorage (lib/storage.ts persistCache/loadCacheFromDisk). App loads instantly from cache, refreshes in background
- **Video/File Storage**: Cloudflare R2 (S3-compatible) via @aws-sdk/client-s3. Videos and avatars stored in R2 bucket `liftflow-uploads` under `videos/` and `avatars/` prefixes. Multer with memory storage for upload handling, auto-cleanup (3 days after coach views, 7 days if unviewed). R2 client helper in server/r2.ts
- **Theme**: Light/Dark mode with energetic orange/red palette (#E8512F). Theme context in lib/theme-context.tsx provides useTheme() hook. Colors defined in constants/colors.ts with darkColors and lightColors. Toggle in Profile settings. Persisted to AsyncStorage under 'liftflow_theme' key. All screens use useTheme() for dynamic colors via inline style overrides on key elements

## Database Schema (shared/schema.ts)
- **profiles**: id, name, role (coach/client), weightUnit, coachCode, pushToken, plan, planUserLimit, planExpiresAt, createdAt
- **programs**: id, profileId, clientId, title, totalWeeks, daysPerWeek, rowCount, shareCode, exercises (JSONB), createdAt, updatedAt
- **clients**: id, coachId, name, email, joinedAt
- **prs**: id, profileId, liftType, weight, date
- **notifications**: id, profileId, title, message, type, isRead, createdAt
- **messages**: id, coachId, clientProfileId, senderRole, text, createdAt
- **video_uploads**: id, filename, programId, exerciseId, uploadedBy, coachId, coachViewedAt, uploadedAt

## API Endpoints (server/routes.ts)
- POST /api/profiles, GET /api/profiles/:id, PUT /api/profiles/:id
- GET /api/programs?profileId=X, GET /api/programs/:id, POST /api/programs, PUT /api/programs/:id, DELETE /api/programs/:id
- GET /api/clients?coachId=X, POST /api/clients, DELETE /api/clients/:id
- GET /api/prs?profileId=X, POST /api/prs, DELETE /api/prs/:id
- GET /api/notifications?profileId=X, POST /api/notifications, PUT /api/notifications/:id/read
- POST /api/upload-video, GET /api/videos/:filename, POST /api/videos/:filename/viewed
- GET /api/messages?coachId=X&clientProfileId=Y, POST /api/messages
- GET /api/clients/search?coachId=X&q=query
- POST /api/seed-demo, POST /api/join-coach, POST /api/leave-coach, POST /api/remove-client
- POST /api/webhooks/payment (Stripe webhook for subscription updates)

## Key Data Model
- **Program exercises**: Stored as JSONB array of WorkoutWeek → WorkoutDay → Exercise objects
- **Exercise**: exerciseName, prescription, weight, rpe, videoUrl, isCompleted, clientNotes, coachComment
- **Client editing**: Clients can only modify weight, completion, notes, and videos; exercise prescription is coach-controlled

## Core Screens
- **Home** (tabs/index.tsx): Role-based dashboard, coach code display, stats, recent programs, client cards
- **Programs** (tabs/programs.tsx): List of all programs with share codes, progress bars
- **Program Detail** (program/[id].tsx): Excel-style spreadsheet with week selector, day columns, exercise rows. Video recording via native camera. Long-press week/day chips to delete them, long-press exercise to delete. Plan lock banner when coach exceeds client limit on shared programs
- **Progress** (tabs/progress.tsx): PR tracking for squat/bench/deadlift with estimated total
- **Profile** (tabs/profile.tsx): Name, role toggle, weight unit, coach code, plan card (Free/Premium with client count), "Load Demo Data" button
- **Chat Tab** (tabs/chat.tsx): Coach sees client list, client sees direct chat. Coach taps client to open conversation
- **Conversation** (conversation.tsx): Standalone chat screen between coach and specific client, auto-refresh. Plan lock banner replaces input when coach exceeds client limit
- **Client Detail** (client/[id].tsx): Client's programs with "New Program" button, chat button in header
- **Create Program** (create-program.tsx): Configure weeks/days/rows or use quick-start template
- **Add PR** (add-pr.tsx): Log personal records

## Apple App Store Compliance (Feb 2026)
- **Privacy Policy**: Comprehensive policy at GET /privacy with data collection details, video auto-deletion schedule, children's privacy (13+), user rights, profile picture handling
- **Terms of Service**: Full terms at GET /terms with eligibility (13+), termination clause, governing law, account deletion rights
- **In-App Legal Links**: Privacy Policy and Terms accessible from Profile screen (required by Apple)
- **Permissions**: NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSMicrophoneUsageDescription set in app.json
- **Account Deletion**: Full data cleanup including avatar files, video files, and all DB records
- **Accessibility**: accessibilityLabel and accessibilityRole on key interactive elements across all screens
- **Video Recording**: 60-second max enforced at camera level via videoMaxDuration. Records at Medium quality. No native iOS editing screen (allowsEditing: false) — goes directly to custom trim screen. "Save Original to Photos" button saves to camera roll via expo-media-library. Video processing: on-device trim+compress via react-native-compressor (production builds) using startTime/endTime options, falls back to server-side ffmpeg trim (Expo Go/web). Delete video button available.
- **Push Notifications**: expo-notifications for iOS/Android. Push tokens stored in profiles.pushToken. Registration in lib/push-notifications.ts on login. Server sends via Expo Push API (exp.host/--/api/v2/push/send) when notifications or chat messages are created. Deep linking: tapping chat notification opens conversation, tapping other notifications opens program detail.

## User Preferences
- Fonts: Rubik (400, 500, 600, 700)
- Dark theme with orange primary color
- Coach-client workflow is the core feature
