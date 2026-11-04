# YALCIT — Yet Another Live Classroom Interaction Tool

> 🌐 **Live Application:** Available to use at [**https://quiz.practicenow.eu**](https://quiz.practicenow.eu) (or via [https://yalcit.practicenow.eu](https://yalcit.practicenow.eu)).

**Yalcit** is a real-time classroom quiz and live interaction platform built with **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Supabase** (PostgreSQL, Row-Level Security, Realtime Presence & Postgres Changes, and Storage).

---

## ✨ Key Features

- **Instant Student Join (No Account Required)**: Students join via a 6-character room code or QR code using Supabase Anonymous Auth, with late-joiner support and local draft answer persistence across tab switches.
- **Live Presenter Control & Projection**:
  - Real-time student lobby via Supabase Presence.
  - Multiple-choice (with optional question & option images) and open-ended questions.
  - Instant question interruption (`⚡ Interrupt & Finish Question Now`), keyboard shortcuts (`Space` / `→` to advance, `F` for fullscreen), and synthesized Web Audio sound effects with mute toggle.
  - Animated live vote distribution charts (Recharts) and celebratory podium reveal.
- **Speed-Based & Standard Scoring**: Presenters choose between time-decay speed-bonus scoring (500–1,000 pts) or flat scoring (100 pts) when launching a session, graded securely server-side via PostgreSQL triggers.
- **Reusable Quiz Library & Community Sharing**:
  - Create, edit, duplicate/fork, and share public quizzes.
  - Organize and search thousands of quizzes with **Categories**, **Personal Folders**, and **`#tags`** (backed by PostgreSQL GIN indexes).
  - Built-in 12-question **🇫🇷 Learn French for Beginners (Demo)** quiz with toggle control.
  - Bulk JSON import/export (with folder, category, and tag support) and built-in interactive `(?)` User Guide (`USER_GUIDE.md`).
  - **Session History & CSV Gradebook Export** for teachers to download student rankings and accuracy.

---

## 🛠️ Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and fill in your Supabase project URL and publishable anon key:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

5. **Run Cucumber BDD tests**:
   ```bash
   npm run test
   ```

---

## 🚀 Automated Deployment (GitHub Pages & Vercel / Cloudflare Pages)

The project is pre-configured to deploy seamlessly to **both** GitHub Pages and root-domain hosts (Vercel, Cloudflare Pages, Netlify):

### 1. GitHub Pages (Automated via GitHub Actions)
- Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs automatically on every push to `main`.
- **One-time setup in GitHub**:
  1. Go to your repository on GitHub → **Settings** → **Pages**.
  2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
  3. Every push to `main` automatically builds and publishes to `https://<username>.github.io/yalcit/`.

### 2. Vercel / Cloudflare Pages / Netlify
- SPA routing rules are pre-configured in [`vercel.json`](vercel.json) and [`public/_redirects`](public/_redirects).
- Simply import the GitHub repository in Vercel or Cloudflare Pages (`Build command: npm run build`, `Output directory: dist`) and it will deploy to a root domain automatically on every push.
