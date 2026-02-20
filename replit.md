# LiftFlow - Fitness Coaching Mobile App

## Overview
LiftFlow is a mobile fitness coaching app built with Expo + Express. It centers on the **coach-client workflow**: coaches build programs using an Excel-style spreadsheet builder, clients fill in their actual weights/reps/completion/notes/videos, and coaches review and comment.

## Architecture
- **Frontend**: Expo Router (file-based routing) with React Native
- **Backend**: Express serving on port 5000 (landing page + API placeholder)
- **Data**: AsyncStorage for local persistence (programs, PRs, profile)
- **Theme**: Dark mode with energetic orange/red palette (#E8512F)

## Key Data Model (lib/storage.ts)
- **Program**: Has `totalWeeks`, `daysPerWeek`, `rowCount`, and a `cells` record keyed by `{row}-{week}-{day}`
- **CellData**: Each cell holds exerciseName, prescription, weight, RPE, videoUrl, isCompleted, clientNotes, coachComment
- **LiftPR**: squat/deadlift/bench personal records
- **UserProfile**: name, role (coach/client), weightUnit, coachCode

## Core Screens
- **Home** (tabs/index.tsx): Role-based dashboard, coach code display, stats, recent programs
- **Programs** (tabs/programs.tsx): List of all programs with share codes, progress bars
- **Program Detail** (program/[id].tsx): **Excel-style spreadsheet** - week selector, day columns, exercise rows as cells. Tap cell to edit (exercise name, prescription, weight, RPE, completion, client notes, coach comment, video)
- **Progress** (tabs/progress.tsx): PR tracking for squat/bench/deadlift with estimated total
- **Profile** (tabs/profile.tsx): Name, role toggle (coach/client), weight unit, coach code
- **Create Program** (create-program.tsx): Configure weeks/days/rows or use quick-start template
- **Add PR** (add-pr.tsx): Log personal records

## User Preferences
- Fonts: Rubik (400, 500, 600, 700)
- Dark theme with orange primary color
- Coach-client workflow is the core feature
