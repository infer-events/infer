---
name: infer-setup
description: Use when setting up Infer analytics in a new project, integrating the SDK, or configuring the MCP server. Triggers on "set up analytics", "add tracking", "integrate infer", "install infer", or when a project has no analytics and the user wants to add it.
---

# Infer Setup — The Wizard

This is the full setup wizard. It detects your current state and walks you through
everything step by step, asking before each change.

## How Infer Works

- **Write key** (`pk_write_...`): Public. Embedded in app JS. Can ONLY send events.
- **Read key** (`pk_read_...`): Secret. In `~/.infer/config.json`. Used by this MCP server to query data.
- **SDK** (`@inferevents/sdk`): Installed in the user's app. Tracks events.
- **MCP server** (`@inferevents/mcp`): Already running if you're reading this.

## Entry Points

There are two ways users arrive here:

### Entry A: User says "set up Infer" or invokes /infer-setup
Start from Step 1 below.

### Entry B: User pasted a setup prompt from infer.events/signup
The prompt contains credentials inline. Extract them and skip to Step 3.
Look for: `projectId`, `writeKey`, `readKey`, `endpoint` in the pasted text.

## The Wizard

### Step 1: Check current state

Read `~/.infer/config.json`. Three possible states:

**State: Config exists with valid read key**
→ Say: "Found existing Infer config (project: [id]). Skipping auth."
→ Jump to Step 3.

**State: Config exists but key is invalid or expired**
→ Say: "Found Infer config but the key seems invalid. Let's reconnect."
→ Proceed to Step 2.

**State: No config file**
→ Say: "No Infer account connected. Let's get you set up."
→ Proceed to Step 2.

### Step 2: Connect account

Ask the user:

> Do you have an Infer account?
> A) Yes, I have my keys
> B) No, I need to sign up

**If A (has keys):**
Ask: "Paste your read key (starts with pk_read_) and write key (starts with pk_write_)."
Save read key to `~/.infer/config.json`:
```json
{
  "apiKey": "pk_read_...",
  "endpoint": "https://api.infer.events",
  "projectId": "extracted from key or asked"
}
```
Hold the write key for Step 4.

**If B (needs signup):**
Say: "Opening infer.events/signup in your browser. Create an account there, then
paste the setup command it gives you back here."

Run: `open https://infer.events/signup` (or the appropriate URL)

Wait for the user to paste back the setup prompt or keys. When they do,
extract the credentials and save to `~/.infer/config.json`.

### Step 3: Check MCP server

The MCP server is already running if the user is reading this skill. But check
if the config is complete:

1. Verify `~/.infer/config.json` has `apiKey`, `endpoint`
2. Test connectivity: call `get_top_events(time_range="last_24h")` as a ping
3. If it works: "MCP server connected and working."
4. If it fails: troubleshoot (wrong endpoint, invalid key, network issue)

### Step 4: Detect project

Read `package.json` in the current working directory.

**Framework detection:**

| Signal | Framework | Entry point |
|--------|-----------|-------------|
| `"next"` in deps + `src/app/` exists | Next.js App Router | `src/app/layout.tsx` |
| `"next"` in deps + `src/pages/` exists | Next.js Pages Router | `src/pages/_app.tsx` |
| `"react-scripts"` in deps | Create React App | `src/index.tsx` |
| `"vite"` in devDeps + `"react"` in deps | Vite + React | `src/main.tsx` |
| `"expo"` in deps | Expo / React Native | `App.tsx` or `app/_layout.tsx` |
| `"nuxt"` in deps | Nuxt.js | `app.vue` or `plugins/` |
| `"@sveltejs/kit"` in devDeps | SvelteKit | `src/routes/+layout.svelte` |
| None detected | Unknown | Ask user |

Tell the user what you detected:
"Detected **[framework]** project. Entry point: `[path]`."

If `@inferevents/sdk` is already in dependencies:
"SDK already installed. Checking integration..."
→ Skip to Step 6.

### Step 5: Install SDK

Ask: "Install @inferevents/sdk? (This adds the tracking library to your project)"

If yes:
```bash
npm install @inferevents/sdk
```

If SDK is not published to npm yet, install from local path or suggest:
```bash
npm install @inferevents/sdk@latest
```

### Step 6: Integrate SDK

Ask: "Add tracking to [detected entry point]? I'll create the analytics module and
wire it into your app. I'll ask before changing each file."

**Then create files based on detected framework:**

#### Next.js App Router

**Gate 1:** "Create `src/lib/analytics.ts`?"
```typescript
import { init, track, identify, page, reset } from "@inferevents/sdk";

export function initAnalytics() {
  if (typeof window === "undefined") return;
  init({
    projectId: "[WRITE_KEY]",
    endpoint: "[ENDPOINT]",
    autoTrack: true,
    debug: process.env.NODE_ENV === "development",
  });
}

export { track, identify, page, reset };
```

**Gate 2:** "Create `src/components/analytics-provider.tsx`?"
```typescript
"use client";
import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

export function AnalyticsProvider() {
  useEffect(() => { initAnalytics(); }, []);
  return null;
}
```

**Gate 3:** "Add `<AnalyticsProvider />` to `src/app/layout.tsx`?"
- Import the component
- Add inside `<body>` tag

#### Next.js Pages Router

**Gate 1:** Create `src/lib/analytics.ts` (same as above)
**Gate 2:** Add to `src/pages/_app.tsx`:
```typescript
import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

// Inside the component:
useEffect(() => { initAnalytics(); }, []);
```

#### Vite / CRA / Plain React

**Gate 1:** Create `src/lib/analytics.ts` (same as above)
**Gate 2:** Add to `src/main.tsx`:
```typescript
import { initAnalytics } from "./lib/analytics";
initAnalytics();
```

### Step 7: Build tracking plan

Ask: "Want me to analyze your codebase and suggest what events to track?"

If yes, read the `infer://tracking-plan` resource and follow it completely.
It will:
1. Deep dive into the codebase to understand the product
2. Map the user journey (entry → activation → core action → engagement)
3. Propose specific events at specific file:line locations
4. Present a table for approval
5. Implement only the approved events

This is the most valuable step — it's doing the PM's job of deciding what to measure,
based on the actual code, not guessing.

### Step 8: Verify

Say: "Let me verify everything is working."

1. Ask the user to open their app in the browser
2. Wait 15 seconds for the batch to flush
3. Run `get_top_events(time_range="last_24h")`
4. If events found: "✓ Events flowing. [N] events received."
5. If no events: troubleshoot (check write key, check console errors, check app is running)

### Step 9: Suggest automation

Say:

> Everything is set up! Here are some things you can ask me:
>
> - "What's happening in my app?" — quick overview
> - "What's my retention?" — are users coming back?
> - "Show me top events" — what users do most
>
> For automated monitoring:
> - `/schedule daily "Run Infer analytics health check"`
> - `/loop 24h "Check analytics and flag anything unusual"`

## From the Website: The One-Liner

When a user signs up on the website, the signup page should show:

```
Open Claude Code and paste this:

Install @inferevents/mcp as an MCP server (add to your MCP settings:
{"mcpServers":{"infer":{"command":"npx","args":["@inferevents/mcp"]}}}),
then save this config to ~/.infer/config.json:
{"apiKey":"[READ_KEY]","endpoint":"[ENDPOINT]","projectId":"[PROJECT_ID]"}.
Then run /infer-setup to integrate the SDK into your current project.
```

This installs the MCP server, saves credentials, and triggers the setup wizard.
The wizard handles the rest (detect framework, install SDK, configure, verify).

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No events found" after setup | Write key wrong or app not running | Check write key in analytics.ts, check browser console |
| 401 from API | Invalid or wrong key type | Write key for SDK, read key for MCP |
| SDK not initializing | SSR calling init() | Check `typeof window !== "undefined"` guard |
| MCP server can't connect | Wrong endpoint or read key | Check ~/.infer/config.json |
| Auto-track not firing | autoTrack not set | Set `autoTrack: true` in init() |
