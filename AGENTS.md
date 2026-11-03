# Yalcit Developer & Agent Principles

This document tracks key principles, architectural decisions, security rules, and engineering constraints for **Yalcit** (*Yet Another Live Classroom Interaction Tool*). It serves as the authoritative guide for both developers and AI coding agents working on this codebase.

---

## 1. Visual Excellence & UX Design
- **Premium Classroom Aesthetics**: Never use plain, unstyled HTML elements. Maintain vibrant modern color palettes, sleek dark mode surfaces (`slate-950`/`slate-900`), smooth gradients, and subtle glassmorphic panels (`backdrop-blur`).
- **Micro-Animations & Audio Feedback**:
  - Interactive elements (buttons, answer cards, modals) must include hover/active transitions and clear visual feedback.
  - Synthesized Web Audio sound effects ([`src/lib/soundEffects.ts`](src/lib/soundEffects.ts)) provide zero-dependency audio cues for countdown ticks, question reveals, answer locks, and podium fanfare, controlled globally via [`SoundToggle`](src/components/SoundToggle.tsx).
- **Presenter View (Projection-First)**:
  - Designed for classroom projectors and large screens: high-contrast typography, animated vote distribution charts (`Recharts`), celebratory podium (`canvas-confetti`), fullscreen toggle (`F`), and keyboard navigation (`Space` / `ArrowRight`).
  - **Live Pacing Controls**: Display real-time participation progress (`X / Y Answered`). Allow the presenter to either **Jump to Next Question** immediately once all students have answered or **Interrupt & Finish Question Now** at any time.
- **Student View (Mobile-First & Resilient)**:
  - Large touch targets, instant answer lock-in feedback, and zero-friction anonymous joining via 6-character PIN or QR code.
  - **Tab-Switch Resilience**: Persist unsubmitted draft selections in `sessionStorage` keyed by `(sessionId, questionId)` so students never lose their selection when switching mobile tabs or waking their screen.
  - **Anti-Flicker Transitions**: Never render correctness banners (`Correct` / `Incorrect`) until the student's actual response state for the current question has finished hydrating (`responseLoaded`).

---

## 2. Supabase & Database Architecture
- **Reusable Quiz vs. Live Session Separation**:
  - `quizzes` and `questions` store reusable templates owned by a `presenter_id` (with `is_public` and `is_demo` flags).
  - `sessions` represent live classroom runs referencing a `quiz_id`, tracking `status` (`waiting` → `active` → `finished`), `current_question_id`, `question_started_at`, and `scoring_mode` (`speed` vs. `standard`).
- **Row-Level Security (RLS) & Anti-Cheat**:
  - RLS must be enabled on **every** table (`profiles`, `quizzes`, `questions`, `question_answers`, `sessions`, `session_participants`, `responses`).
  - **Strict Answer Isolation**: Correct answers live in `public.question_answers`, which is readable **only** by the quiz owner (`presenter_id = (select auth.uid())`) or for public community templates. Students never query `question_answers` directly.
  - **Server-Side Grading Trigger**: Student submissions into `public.responses` are graded automatically on the server via the `BEFORE INSERT` trigger `public.handle_response_scoring()`, which computes `is_correct` and `points_awarded` (time-decay speed bonus or flat standard points).
- **Database Security & Performance Rules (Supabase Advisor Compliance)**:
  - **Immutable `search_path` on Functions**: Every `plpgsql` function (especially `SECURITY DEFINER` functions and triggers) **must** explicitly declare `set search_path = public, pg_temp;`.
  - **Least-Privilege Function Execution**: Revoke `EXECUTE` from `anon, public` on administrative/helper RPCs (e.g., `enable_demo_quizzes`, `disable_demo_quizzes`) and grant only to `authenticated`.
  - **InitPlan-Optimized RLS Policies**: Always wrap `auth.uid()` and `auth.jwt()` in scalar subqueries—e.g., `(select auth.uid())`—inside RLS `USING` and `WITH CHECK` clauses so PostgreSQL caches the value once per query instead of re-evaluating per row.
  - **No Duplicate Permissive Policies**: Consolidate multiple `SELECT` policies on the same table and role into a single policy using `OR` conditions.
  - **Indexed Foreign Keys**: Every foreign key column (`quiz_id`, `session_id`, `question_id`, `participant_id`, `presenter_id`, `current_question_id`) must have a covering B-tree index.
- **Anonymous Auth & Realtime Sync**:
  - Students authenticate seamlessly via `supabase.auth.signInAnonymously()`, receiving a real `auth.users` UUID for clean RLS enforcement.
  - Use **Supabase Presence** (`room:<code_upper>`) for live lobby/active participant rosters and **Postgres Changes** (`sessions`, `responses`, `session_participants`) for durable state transitions, with a lightweight polling fallback so missed WebSocket frames never stall a classroom.

---

## 3. Code Quality, Modularity & Testing
- **TypeScript Strictness**: Strict mode enabled, zero unused locals/parameters, no implicit `any`. Keep [`src/types/supabase.ts`](src/types/supabase.ts) synchronized with database migrations.
- **Modular Feature Structure**:
  - Organize domain logic under `src/features/presenter/` and `src/features/student/`.
  - Keep complex modals and forms extracted into focused subcomponents (`src/features/presenter/components/HostSessionModal.tsx`, `SessionHistoryModal.tsx`, `QuizCreatorForm.tsx`).
  - Use custom hooks (`useSessionPresenter`, `useSessionStudent`) to encapsulate Supabase Realtime subscriptions and state transitions.
- **Visual Media Verification**:
  - Whenever seeding or updating external image URLs (such as Unsplash URLs in demo quizzes), **always** download and visually inspect every image before committing to verify it matches the educational prompt.
- **BDD & Build Verification**:
  - Run `npm run build` (`tsc -b && vite build`) and `npm run test` (Cucumber BDD suite in `features/`) before pushing changes.
- **Multi-Platform Deployment Compatibility**:
  - Maintain dual deployment support for **GitHub Pages** (`.github/workflows/deploy.yml` with dynamic `VITE_BASE_PATH` and `dist/404.html` SPA fallback) and root-domain hosts (**Vercel / Cloudflare Pages** via `vercel.json` and `public/_redirects`).
  - Never commit `.env` or `supabase.credentials` to git; only `VITE_SUPABASE_URL` and the public `VITE_SUPABASE_ANON_KEY` may be used in client builds.
