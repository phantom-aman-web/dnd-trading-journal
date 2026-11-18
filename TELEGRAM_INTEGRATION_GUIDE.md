# AlphaPips — Telegram Integration Guide
## Automated Trade Publishing + Trading To-Do Notifications + Durable Delivery

This guide provides the complete production configuration, architectural details, and operational setup for the AlphaPips Telegram integration.

---

## 1. Architecture Overview

The AlphaPips Telegram integration connects your trading journal to the Telegram Bot API to fulfill two primary capabilities:

1. **Automatic Trade Publishing:** Whenever an executed trade is created or closed in AlphaPips, a durable outbox job formats the trade details (using Standard, ICT 2022, or Custom templates), attaches relevant chart screenshots, and publishes the post to your designated Telegram channel.
2. **Trading To-Do Private Reminders:** Private notifications are dispatched to your personal Telegram conversation for tasks scheduled in Trading To-Do, featuring interactive inline buttons (*Mark Complete*, *Snooze 15m*, *Snooze 1h*).

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                         AlphaPips Application                          │
   │                                                                        │
   │  ┌───────────────┐     ┌─────────────────────┐     ┌────────────────┐  │
   │  │  Trades Log   │     │   Trading To-Do     │     │ Settings Tab   │  │
   │  │ (Save/Update) │     │  (Create/Reschedule)│     │  (Telegram)    │  │
   │  └───────┬───────┘     └──────────┬──────────┘     └───────┬────────┘  │
   │          │                        │                        │           │
   │          ▼                        ▼                        ▼           │
   │  ┌──────────────────────────────────────────────────────────────────┐  │
   │  │             Durable Outbox Queue (TelegramDelivery)              │  │
   │  │     - Idempotency Keys        - Atomic Worker Claim Leases       │  │
   │  │     - Exponential Backoff     - Secure Server-Side Decryption    │  │
   │  └────────────────────────────────┬─────────────────────────────────┘  │
   └───────────────────────────────────┼────────────────────────────────────┘
                                       │
                        HTTPS / Telegram Bot API
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │ Public/Private Channel│             │ Private User Chat     │
        │  (Trade Publications  │             │  (To-Do Reminders &   │
        │   & Closure Updates)  │             │   Inline Action Cbs)  │
        └───────────────────────┘             └───────────────────────┘
```

---

## 2. Environment Variables

Configure the following environment variables in your production environment (e.g. Vercel, Railway, Docker, or `.env`):

| Variable | Required | Description | Example / Recommendation |
| :--- | :---: | :--- | :--- |
| `TELEGRAM_TOKEN_ENCRYPTION_KEY` | **Required** | Dedicated key for AES-256-GCM token encryption at rest. Fails closed on new token saves if missing or invalid. (Decryption retains legacy fallback to `SESSION_SECRET` for existing tokens). | `openssl rand -hex 32` |
| `CRON_SECRET` | Recommended (Vercel) | Secret string configured in Vercel Project Settings. Vercel Cron automatically attaches `Authorization: Bearer <CRON_SECRET>` to cron invocations. | `openssl rand -hex 32` |
| `TELEGRAM_WORKER_SECRET` | Recommended (External) | Secret token to authenticate external cron or curl requests to `/api/telegram/worker` via `Authorization: Bearer <SECRET>` or `x-worker-secret`. | `openssl rand -hex 24` |
| `TELEGRAM_WEBHOOK_BASE_URL` | Optional | Public HTTPS domain of your deployed AlphaPips instance used for automated webhook registration. | `https://journal.yourdomain.com` |

---

## 3. BotFather Setup (Creating Your Bot)

1. Open Telegram and search for [`@BotFather`](https://t.me/BotFather).
2. Send `/newbot`.
3. Enter a display name for your bot (e.g. `My Trading Journal Bot`).
4. Enter a unique username ending in `bot` (e.g. `MyAlphaPipsBot`).
5. @BotFather will return your **HTTP API Token** (e.g. `7123456789:AAH_randomBotTokenStringHere`).
6. Copy this token and enter it in **AlphaPips -> Settings -> Telegram -> Step 1**.

> [!IMPORTANT]
> Never share or commit your bot token. In AlphaPips, tokens are encrypted with AES-256-GCM before database storage and are never exposed in browser code, API responses, or server logs.

---

## 4. Configuring Your Trade Channel

1. Open Telegram and create a new channel (or use an existing public or private channel).
2. Open channel settings -> **Administrators** -> **Add Administrator**.
3. Search for your bot username and add it as an administrator.
4. Ensure the permission **Post Messages** (and optionally **Edit Messages**) is enabled.
5. Obtain the channel identifier:
   - For **Public Channels**: Use the username, e.g. `@mytradingchannel`.
   - For **Private Channels**: Use the negative numeric ID, e.g. `-1001234567890`. (You can find this using @JsonDumpBot or Telegram Web URL).
6. Enter the channel ID in **AlphaPips -> Settings -> Telegram -> Step 2**, then click **Verify & Send Test**.

---

## 5. Linking Private To-Do Reminders

AlphaPips uses a cryptographically secure, single-use linking token flow:

1. In **Settings -> Telegram**, click **Link Personal Telegram**.
2. A modal displays a deep link: `https://t.me/YourBotUsername?start=<ONE_TIME_TOKEN>`.
3. Click **Open Telegram** (or scan the link on your mobile device).
4. Tap **START** in Telegram.
5. The AlphaPips webhook validates the token, associates your private chat ID, and replies with a confirmation message.
6. The modal in AlphaPips updates in real-time to confirmed status.

---

## 6. Message Templates & Customization

AlphaPips offers three message formatting engines:

### A. Universal Standard Template
Includes Asset, Direction, Session, Strategy, Timeframe, Planned Entry / Stop Loss / Take Profit, Risk %, Planned R:R, Net P&L, Description notes, and formatted hashtags.

### B. ICT 2022 Mentorship Template
Formats Inner Circle Trader (ICT) concepts:
- **High-Time-Frame Context:** Draw on Liquidity (DOL), HTF PD Array, Market Bias, Confluences.
- **ICT 2022 Entry Execution:** Liquidity Sweeps, Market Structure Shifts (MSS), Entry FVGs / IFVGs.
- **Management & Metrics:** Risk %, R:R, Outcome, Final R, Net P&L.
- **Lessons & Psychology:** Execution and emotional discipline notes.

### C. Custom Template
Allows arbitrary text with supported dynamic placeholders:
- `{{asset}}`
- `{{direction}}`
- `{{session}}`
- `{{timeframe}}`
- `{{strategy}}`
- `{{entry}}`
- `{{stop_loss}}`
- `{{take_profit}}`
- `{{risk_percent}}`
- `{{risk_reward}}`
- `{{actual_r}}`
- `{{outcome}}`
- `{{net_pnl}}`
- `{{tags}}`
- `{{description}}`
- `{{account}}`
- `{{grade}}`

---

## 7. Scheduled Worker & Deployment Configuration

For To-Do reminders that trigger at future dates/times, a server-side cron or scheduler is required to invoke the worker endpoint (`/api/telegram/worker`).

### Configuring Environment Variables in Vercel
To configure these variables in Vercel:
1. Open the [Vercel Dashboard](https://vercel.com) and select your AlphaPips project.
2. Go to **Settings** -> **Environment Variables**.
3. Add the following keys:
   - `TELEGRAM_TOKEN_ENCRYPTION_KEY`: A dedicated 32+ character key (e.g. `openssl rand -hex 32`).
   - `TELEGRAM_WORKER_SECRET`: A secure random secret string (e.g. `openssl rand -hex 24`). **Required** for authenticating the external scheduler.
   - `CRON_SECRET`: Optional/Recommended fallback key (e.g. `openssl rand -hex 32`). Vercel Cron automatically attaches `Authorization: Bearer <CRON_SECRET>` to native cron invocations.
   - `TELEGRAM_WEBHOOK_BASE_URL`: Your deployment URL (e.g. `https://alphapips.vercel.app`).
4. Trigger a new deployment (or redeploy) so the serverless functions receive the updated environment.

---

### Option A: External Free Scheduler — cron-job.org (Recommended for Vercel Hobby)

The free **Vercel Hobby plan** only permits native cron jobs to run **at most once per day** (`0 0 * * *`). To achieve frequent, prompt delivery of Trading To-Do notifications and queued trade publications on the Hobby plan without upgrading to Pro, use a free external scheduler such as **[cron-job.org](https://cron-job.org)**.

#### Step-by-Step cron-job.org Setup:

1. **Sign Up / Log In:** Create a free account at [https://cron-job.org](https://cron-job.org).
2. **Create New Cron Job:** In the console, click **Create Cronjob**.
3. **Job Details:**
   - **Title:** `AlphaPips Telegram Worker`
   - **URL:** `https://YOUR_PRODUCTION_DOMAIN/api/telegram/worker`
   - **Request Method:** `GET`
4. **Schedule:**
   - Select **Every 1 minute** (or choose custom schedule `* * * * *`).
5. **Request Headers (Crucial Security Step):**
   - Click on the **Advanced** or **Headers** section.
   - Add a custom header:
     - **Header Name:** `Authorization`
     - **Header Value:** `Bearer YOUR_TELEGRAM_WORKER_SECRET`
     *(Replace `YOUR_TELEGRAM_WORKER_SECRET` with the exact secret you configured in your Vercel Environment Variables).*
6. **Save & Activate:** Click **Create**.

> [!IMPORTANT]
> **External Scheduler Security & Operational Requirements:**
> 1. **Secret Must Never Appear in the URL:** Never append `?secret=...` or `?token=...` to the URL. The worker endpoint strictly rejects query string credentials with HTTP 401 to prevent token leakage in proxy logs, browser histories, and referrer headers. Always transmit credentials via the `Authorization: Bearer <SECRET>` header.
> 2. **HTTPS is Mandatory:** Always use `https://` in the cron-job.org URL. Unencrypted HTTP requests are insecure and will fail in production.
> 3. **Environment Parity:** The exact secret value configured in cron-job.org must match `TELEGRAM_WORKER_SECRET` in your Vercel project settings.
> 4. **Monitor Execution History:** In cron-job.org, open the **History** tab to inspect the recent runs. You should see HTTP `200 OK` status with a concise JSON response (e.g. `{"success": true, "result": {"claimed": 0, "delivered": 0}}`) and low execution latency (< 2 seconds).
> 5. **Native Vercel Daily Fallback:** The repository's `vercel.json` retains a daily midnight UTC schedule (`0 0 * * *`). This is fully compliant with Vercel Hobby limitations and acts as an automatic daily safety net if the external scheduler is ever paused.

---

### Option B: Native Vercel Cron (Daily Fallback or Pro Plan)

The repository's `vercel.json` is configured with a Vercel Hobby-compliant daily schedule:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/telegram/worker",
      "schedule": "0 0 * * *"
    }
  ]
}
```

- **Hobby Plan Compatibility:** A daily schedule (`0 0 * * *`) ensures Vercel Hobby deployments succeed without plan errors, while providing a daily catch-up sweep.
- **Vercel Pro/Enterprise:** If you ever upgrade to Vercel Pro, you may adjust `vercel.json`'s schedule to `* * * * *` to run natively every minute without an external service.
- **Authentication:** When `CRON_SECRET` is configured in Vercel, native Vercel Cron automatically attaches `Authorization: Bearer <CRON_SECRET>`. The worker authenticates this seamlessly.

---

### Option C: Linux / Server Crontab (Alternative for VPS/Self-Hosted)

If you run a Linux server, VPS, or Raspberry Pi, you can trigger the worker every minute with a crontab entry:
```bash
* * * * * curl -s -X GET -H "Authorization: Bearer YOUR_TELEGRAM_WORKER_SECRET" https://YOUR_PRODUCTION_DOMAIN/api/telegram/worker > /dev/null 2>&1
```

---

## 8. Troubleshooting & FAQ

### 1. Telegram API Error 403: Bot was blocked by the user
**Cause:** The user blocked or stopped the bot in Telegram.
**Fix:** Open Telegram, search for your bot, and tap `Restart` or send `/start`.

### 2. Telegram API Error 400: Chat not found
**Cause:** The channel identifier is incorrect, or the bot was not added to the channel.
**Fix:** Add the bot as an administrator to the channel before running verification.

### 3. Telegram API Error 400: Not enough rights to post
**Cause:** The bot is added as a member or administrator without the "Post Messages" permission.
**Fix:** In Channel Settings -> Administrators, toggle on "Post Messages".

### 4. Are No-Trade Observations published?
**No.** No-Trade Observations are market notes and are strictly segregated from trade execution datasets. They are never published to Telegram.
