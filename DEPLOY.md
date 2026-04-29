# Vanderkamp PR Command Center — Deploy to Vercel

This is everything you need to put the tool online for your team. Allow about 15 minutes start to finish.

---

## What you'll end up with

- A live URL like `vanderkamp-pr.vercel.app` you can share with your team
- Your Anthropic API key kept safely on the server (never exposed to anyone using the site)
- Shared state across your team — everyone sees the same dashboard, library, and SEO tracker

---

## What you need before you start

1. Your Vercel account (you said you have one)
2. Your Anthropic API key (from https://console.anthropic.com/settings/keys — create one if you haven't)
3. This folder, unzipped on your computer

---

## Step 1 — Upload to Vercel

1. Go to https://vercel.com/new
2. You'll see a section that says "Import Git Repository" and another that says **"Deploy a Template"** or just **"Continue with..."** — what you want is the option to upload a folder. If you don't see it, click "Other" or scroll down.
3. The simplest path: at https://vercel.com/new, look for **"Import Third-Party Git Repository →"** and ignore that. Instead, scroll to the section that says **"Clone Template"** or use the CLI option below.

**The easiest path is the Vercel CLI:**

Open Terminal (Mac) or Command Prompt (Windows). You don't need to know anything about it — just type the commands exactly.

```
npm install -g vercel
cd /path/to/vanderkamp-pr        # change to wherever you unzipped this folder
vercel
```

The first time you run `vercel`, it will:
- Ask you to log in (opens a browser, click confirm)
- Ask "Set up and deploy?" → press Enter for Yes
- Ask "Which scope?" → pick your account
- Ask "Link to existing project?" → press N (No)
- Ask "Project name?" → press Enter to accept `vanderkamp-pr`
- Ask "Directory?" → press Enter to accept the current directory
- Ask "Want to override settings?" → press N (No)

It will deploy and give you a preview URL. **Don't share this URL yet** — there are 2 more steps.

---

## Step 2 — Add your Anthropic API key

1. Go to https://vercel.com/dashboard
2. Click your `vanderkamp-pr` project
3. Click **Settings** in the top tabs
4. Click **Environment Variables** in the left sidebar
5. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** paste your Anthropic API key (starts with `sk-ant-...`)
   - **Environment:** check all three (Production, Preview, Development)
6. Click **Save**

---

## Step 3 — Set up Vercel KV (the shared database)

This is what lets your whole team see the same dashboard.

1. Still in your project on Vercel, click the **Storage** tab at the top
2. Click **Create Database** → choose **KV** (Redis-compatible)
3. Name it anything — `vanderkamp-kv` is fine
4. Pick a region close to you (US East is the typical default)
5. Click **Create**
6. After it's created, Vercel will offer to **Connect to Project** — connect it to `vanderkamp-pr`
7. Vercel automatically adds three environment variables for you (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`). You don't need to do anything with them.

---

## Step 4 — Redeploy so the new env vars take effect

Environment variables only apply to *new* deployments, so:

1. In your project on Vercel, click the **Deployments** tab at the top
2. Find your most recent deployment (top of the list)
3. Click the **⋯** menu on the right → **Redeploy**
4. Confirm. Wait about 60 seconds for it to finish.

---

## You're live

Your URL is `vanderkamp-pr.vercel.app` (or whatever Vercel showed you in Step 1). Open it. Try running a research cycle on the Weddings track to confirm the API key works. Try checking off an item on the dashboard, then have a teammate open the same URL — they should see your check-off appear.

---

## Sharing with your team

Just send them the URL. They visit, they use it. There's no login. **Anyone with the URL can use the tool and run up your API budget**, so:

- Don't post the URL anywhere public
- Don't index it in Google (the `noindex` meta tag in the HTML helps, but isn't bulletproof)
- If you ever lose track of who has it, regenerate your Anthropic API key (revokes the old one) and re-do Step 2

---

## How much will this cost?

- **Vercel hosting:** free tier covers this easily (you'd need ~100K function invocations/month to hit the limit — well beyond a 3-person team's usage)
- **Vercel KV:** free tier gives 30K commands/month + 256MB storage — way more than this tool will use
- **Anthropic API:** budget about $0.05–$0.20 per research cycle. A team running 5 cycles/week ≈ $5–$10/month.

---

## When you want to make changes

If I send you an updated `VanderkampPR.jsx` (or any other file), the path to update is:

1. Replace the file in your local folder
2. In Terminal: `cd` to the folder, run `vercel --prod`
3. Wait ~60 seconds, your live site updates

---

## If something breaks

**"ANTHROPIC_API_KEY not configured"** — Step 2 didn't take effect. Confirm the env var is set, then redo Step 4 (redeploy).

**Dashboard shows my changes but teammate sees old data** — Vercel KV setup didn't complete. Confirm Step 3, redo Step 4. The tool is designed to fall back to localStorage so the UI works even if KV isn't connected — but you won't have shared state until KV is live.

**Research cycle starts but never returns opportunities** — Open browser DevTools (F12) → Console tab. Errors will be visible there. Most common cause: API key is invalid or out of credits. Check https://console.anthropic.com/settings/billing.

**Nothing loads at all** — Open the URL, view source, look for errors. Sometimes a Vercel deployment fails silently — re-running `vercel --prod` from your local folder usually fixes it.

---

## Quick reference: the file structure

```
vanderkamp-pr/
├── api/
│   ├── claude.js          # Proxies Claude API calls (keeps API key server-side)
│   └── storage.js         # Reads/writes to Vercel KV (shared team state)
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx           # React entry point
│   └── VanderkampPR.jsx   # The actual tool component
├── index.html
├── package.json
├── vite.config.js
└── DEPLOY.md              # This file
```

If you ever want to change the tool's behavior, the place to edit is `src/VanderkampPR.jsx`. Everything else is plumbing.
