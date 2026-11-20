# MMV-HUB

**MMV-HUB** is a personal-use, mobile-first, offline-first Progressive Web App (PWA) styled after Google Material Design 3. It unifies expenses, subscriptions, habits, tasks, calendar events, focus sessions, and private notes under a single **zero-knowledge AES-256-GCM encrypted vault** with real-time cross-device synchronization via Cloud Firestore.

---

## Table of Contents

1. [Key Features & Page Guide](#key-features--page-guide)
2. [Security & Sync Architecture](#security--sync-architecture)
3. [Android App](#android-app)
4. [Local Development & GitHub Setup](#local-development--github-setup)
5. [Project Structure](#project-structure)
6. [Roadmap Status](#roadmap-status)

---

## Key Features & Page Guide

### 1. Navigation & Workspace Shell
- **Google-Style Top Bar**: Clean 3-zone header featuring the `MMV-HUB` wordmark, single-line desktop section navigation, **Reminders Bell**, **Google 9-Dot App Launcher**, and **Account & Quick Theme Menu**.
- **Reminders Bell (`Upcoming` & `Missed`)**: Top-bar bell popover split into **Upcoming** (next 7–14 days across tasks, habits, events, and renewals) and **Missed** (overdue tasks, passed habit targets, elapsed events, and overdue renewals), complete with click-to-edit modals and 1-tap **Complete**, **Snooze to Tomorrow**, and **Log Paid** actions.
- **9-Dot App Launcher**: Primary navigation launcher across mobile and desktop—instant 3×3 grid routing to **Home**, **Purchases**, **Subscriptions**, **Habits**, **Tasks**, **Calendar**, **Themes**, **Reminders**, and **Settings** (with no bottom navigation bar clutter).
- **Hidden Scrollbars & Material 3 FAB**: Edge-to-edge scrolling without visible scrollbars and a quick mobile Floating Action Button on module views for rapid creation.
- **Offline-First & Installable PWA**: Service worker asset precaching (`vite-plugin-pwa`), IndexedDB encrypted storage, offline connectivity banner, and one-tap install prompts on desktop, Android, and iOS.

### 2. Home (`HomeView`)
- **Snapshot Strip**: Real-time summary across **Month Net Spend** (with monthly savings goal headroom), **Today's Goals** (with a combined SVG Progress Ring across scheduled habits & tasks due today), **Open Tasks** (with overdue alert), and **30d Renewals** (direct jump to Subscriptions).
- **Smart Reminder Alert Strip**: Surfaces urgent/due tasks, expiring trials, habits, and events with 1-tap notification dispatch.
- **Today's Focus Panel**:
  - **Today / Tasks / Habits** views with inline quick-add, 1-tap habit streak checkoff, task completion, starring, and **1-tap Snooze to Tomorrow**.
  - **Focus Timer Tab**: `25m Focus`, `15m Sprint`, and `5m Break` Pomodoro presets with progress bar, Web Audio completion chime, notification trigger, and encrypted daily session counter.
- **7-Day Interactive Mini-Schedule**: Click any upcoming day chip to inspect scheduled events, tasks due that day, and subscription renewals—complete with **1-tap Log Paid** directly from Home.
- **Recent Wallet Activity & Encrypted Scratchpad**: Quick transaction log and an auto-saving personal encrypted memo card.

### 3. Purchases & Subscriptions (`PurchasesView`)
- **Purchases Ledger**:
  - Google Wallet / Finance style spending analytics across **Month**, **30d**, **YTD**, and **All Time**.
  - Month-over-month delta (`% vs prev mo`), daily spending pace, end-of-month projection, net spend vs. gross + refunds, and daily/monthly spend sparkline.
  - Filter by **Category**, **Payment Method**, **Tag**, **Refunds**, and **Reimbursements** (`Awaiting payback` / `Paid back` 1-tap toggle).
  - One-click **CSV Export** for external spreadsheet analysis.
- **Subscriptions & Free Trials**:
  - Normalized **Monthly Equivalent** and **Annualized** cost breakdown.
  - **Next 30 Days** renewal forecast, free-trial countdown alerts (`reminderDays` window), and category share breakdown.
  - **1-Tap Log Payment**: Records an expense entry automatically and advances `nextBillingDate` by billing cycle (`weekly`, `monthly`, `quarterly`, `yearly`).
  - Pause/resume plans without losing history (`pausedMonthlySavings` calculation).

### 4. Habits (`HabitsView`)
- **3 Views**:
  - **Daily Focus**: Centered 7-day sliding selector with Google Fit-style daily ring, morning/afternoon/evening schedule filtering, multi-unit counters (e.g., glasses of water), and streak counters.
  - **Matrix Grid**: `7d`, `14d`, or `30d` scrollable completion table with per-habit streak & completion rate and 1-click historical cell toggling.
  - **Calendar Backfill**: Full 42-cell monthly grid (honors Sunday/Monday week start) to mark or backfill past days per habit or all habits together.
- **Flexible Recurrence Rules**: `daily`, `weekdays`, `weekly`, `monthly` (specific dates or end-of-month `-1`), or `custom` (chosen weekdays or `every N days` interval).

### 4b. Goals (`GoalsView`)
- Long-term goals measured by a **number target** (e.g. 0 → 5,000 saved), **milestones**, **linked tasks & habits**, or a **combined** average.
- Inline `+ / −` and "Log amount" for numeric goals, tap-to-check milestones, pace indicator vs. target date (On track / Behind), pause / complete / reopen with undo.
- Link any task or habit from its editor ("Linked Goal") or via **Add task** on a goal card; deleting a goal unlinks them (undo restores links).
- Goals widget on Home, Goals reminders toggle, Ctrl+K search, included in readable JSON backups.

### 5. Tasks (`TasksView`)
- **Google Tasks Clone**: Multiple custom task lists (`My Tasks`, `Starred`, custom lists), inline composer with Today / Tomorrow / Next week quick chips, due times, and repeating task auto-generation upon completion.
- **List & Board Modes**: Toggle between focused single-list view and multi-list Kanban board on desktop.
- **Full Task Details**: Priorities (`low`, `medium`, `high`), subtasks, move between lists, manual reorder arrows, undoable completion/deletion snackbars, and bulk clear completed.

### 6. Calendar (`CalendarView`)
- **3 Views**: **Month**, **Week**, and **Schedule (Agenda)**.
- **Unified Calendar Layers**: Toggle visibility for **Calendar Events**, **Due Tasks**, and **Subscription Renewals** on one timeline.
- **Recurring Events**: Supports `none`, `daily`, `weekly`, `monthly`, and `yearly` event recurrences with color coding and Sunday/Monday week start preference.

### 7. Settings (`SettingsView`)
- **Themes & Appearance**:
  - **Light / Dark / System** mode with zero-flash initial boot.
  - **6 Material You Accent Palettes**: `Google Blue`, `Emerald`, `Slate`, `Plum`, `Amber`, and `Crimson`.
  - **Interface Density** (`Comfortable` / `Compact`), **Calendar Week Start** (`Sunday` / `Monday`), Currency symbol, Monthly Budget, Monthly Savings Goal, and Auto-Lock timeout.
- **Notification Reminders**:
  - Granular switches for **Tasks**, **Habits**, **Renewals**, and **Events**, configurable **Daily Digest Time**, manual **Test Notification**, **Send Due Reminders Now**, and a live queue of currently due alerts.
  - **Customize Notifications**: individual alerts vs. a single digest, max alerts per batch, chime, timed-task / default event / renewal / return-window lead times, high-priority-only and overdue filters, urgent alerts during quiet hours, active weekdays, optional **Evening Wrap-up**, bell "Upcoming" range (1–30 days), and missed-count badge on the bell + installed app icon. Tapping a notification focuses the app (`public/notification-handler.js`).
- **Home Widgets**: show/hide, reorder, and set half/full width for every Home card (also available via the **Customize** button on Home). Extra optional widgets: **Quick Actions**, **Habit Streaks**, **Countdowns** (milestone events).
- **Vault Security & Portable Backups**:
  - Rotate Master Passphrase (re-encrypts every record in IndexedDB + Firestore cleanly).
  - Export **Encrypted JSON** (zero-knowledge portable snapshot) or **Readable JSON**, import backups, or wipe local device storage.

---

## Security & Sync Architecture

MMV-HUB encrypts **all user content client-side** before saving to local IndexedDB (`mmv_hub_vault_db`) or syncing to Cloud Firestore. Firestore never stores plaintext titles, amounts, notes, tasks, habits, or events.

| Layer | Specification |
| :--- | :--- |
| **Symmetric Cipher** | `AES-256-GCM` with random 96-bit (`12`-byte) IV per record write |
| **Key Derivation** | `PBKDF2-SHA256`, `150,000` iterations, 128-bit random Base64 `vaultSalt` |
| **Key Verifier** | Plaintext `'MMV_HUB_VAULT_KEY_VERIFIED_V1'` encrypted under the vault key |
| **Local Offline Store** | IndexedDB `mmv_hub_vault_db` (`vaultMeta` + `records` stores) |
| **Conflict Resolution** | Deterministic Last-Write-Wins on `clientUpdatedAt` (epoch ms), tie-broken by monotonic `version`, with `deleted: true` soft-delete tombstones |

### Firestore Collection Structure
- **Project ID**: `semiotic-bonus-drwfn`
- **Firestore Database ID**: `ai-studio-4a400113-6c7d-4163-883a-9c7cb1d20090`
- **Auth Provider**: Firebase Authentication with Google Sign-In (`email_verified == true`)

```text
/users/{uid}
  ├─ uid: string
  ├─ email: string
  ├─ displayName: string
  ├─ vaultSalt: string            # Base64 16-byte PBKDF2 salt
  ├─ verifierIv: string           # Base64 12-byte AES-GCM IV
  ├─ verifierCiphertext: string   # Base64 AES-GCM ciphertext of verifier constant
  ├─ createdAt: Timestamp
  └─ updatedAt: Timestamp

/users/{uid}/vaultItems/{itemId}
  ├─ ownerId: string              # Must match request.auth.uid
  ├─ kind: "purchase" | "habit" | "task" | "tasklist" | "subscription" | "calendar" | "prefs"
  ├─ iv: string                   # Base64 12-byte AES-GCM IV
  ├─ ciphertext: string           # Base64 AES-GCM JSON payload (<= 32,768 chars)
  ├─ version: int                 # Monotonic >= 1
  ├─ deleted: boolean             # Tombstone flag for cross-device deletes
  ├─ clientUpdatedAt: int         # Epoch milliseconds
  ├─ createdAt: Timestamp
  └─ updatedAt: Timestamp
```

---

## Android App

The Android app is this same web app wrapped with **Capacitor 8** (`android/`), plus native code for widgets, reminders and system integrations. It reads and writes the exact same encrypted vault format as the web app.

### Install / update
1. On your phone open **[Releases → android-latest](https://github.com/workmmv5-afk/MMVHUB/releases/tag/android-latest)** and download `MMV-HUB-<version>.apk`.
2. Open it and allow "Install unknown apps" for your browser when asked.
3. Later builds install over it as normal updates (same signing key).

> Coming from the old 1.0.x APK? It was signed with a different key, so uninstall it first. Sign in with Google (web) or export a backup before uninstalling.

### What's native
| Area | Details |
| :--- | :--- |
| Reminders | Next 7 days planned in JS and scheduled with Android alarms (fire while closed). Done / Snooze / Mark paid buttons, nag mode, quiet hours, active days, pop-up / vibrate / sound channels. |
| Widgets | Today, Quick add, Spending, Goals — theme, transparency, accent, rows, content, hide amounts / hide when locked (Settings → Phone Widgets). |
| Unlock | PIN (4–6 digits) + fingerprint via Android Keystore (`@capgo/capacitor-native-biometric`). |
| System | Launcher shortcuts, Quick Settings tile, Share-to-task, NFC habit check-in links, Material You accent, privacy screen (`FLAG_SECURE`), ongoing Today / Focus notifications. |

### How builds work
- `.github/workflows/android.yml` runs on every push to `main`: type-check → `vite build` → `cap sync android` → Gradle `assembleRelease` → publishes the **android-latest** release.
- Release signing uses repository secrets `MMV_KEYSTORE_BASE64` and `MMV_KEYSTORE_PASSWORD` (PKCS#12, alias `mmvhub`). **The keystore is never committed** — keep your offline copy safe; losing it means future APKs can't update the installed app.
- Local build (optional): Android Studio / JDK 21 → `npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`.

### Google sign-in in the app (one-time setup)
The app signs in with Android's native account picker (Credential Manager) and passes the Google token to Firebase. Google only issues tokens to registered apps, so once:
1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials?project=semiotic-bonus-drwfn) for the Firebase project (`semiotic-bonus-drwfn`).
2. **Create credentials → OAuth client ID → Android**.
3. Package name `com.mmvhub.mobile`, SHA-1 `E5:05:CB:42:B9:D7:E6:AE:60:C4:10:23:31:C9:DB:AD:16:42:74:B2` (release key).
4. Save. No new APK is needed — sign-in works within a few minutes.

---

## Local Development & GitHub Setup

### Prerequisites
- Node.js `>= 20`
- npm / bun

### Installation & Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Run TypeScript type check
npm run lint

# Run unit tests (crypto, reminders, widgets, i18n, dates)
npm test

# Build production PWA bundle (dist/)
npm run build
```

### Environment Variables
Copy `.env.example` to `.env` if needed for custom deployment metadata:

```env
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="MY_APP_URL"
```

### Firebase Configuration
The web client reads Firebase settings from `firebase-applet-config.json` and deploys security rules defined in `firestore.rules` (validated against `firebase-blueprint.json`). Before deploying rules publicly, verify security rules linting:

```bash
npx eslint firestore.rules
```

---

## Project Structure

```text
src/
├── components/
│   ├── ErrorBoundary.tsx     # Global runtime & Firestore error boundary
│   ├── ItemModals.tsx        # Material 3 bottom-sheet / modal editors
│   ├── PWAInstallButton.tsx  # Chromium & iOS Safari install trigger
│   └── VaultGate.tsx         # Passphrase / Device Key setup & unlock screen
├── context/
│   └── VaultContext.tsx      # Decrypted state, AES-GCM persistence & reminder loop
├── hooks/
│   └── usePWAInstall.ts      # beforeinstallprompt & standalone mode detection
├── lib/
│   ├── crypto.ts             # PBKDF2-SHA256 & AES-256-GCM Web Crypto primitives
│   ├── firebase.ts           # Firebase Auth & Firestore named DB initialization
│   ├── format.ts             # Dates, currency, streaks & recurrence evaluation
│   ├── indexeddb.ts          # Offline-first encrypted local IndexedDB layer
│   ├── notifications.ts      # Upcoming/Missed & due reminder collectors + alerts
│   └── syncEngine.ts         # Real-time Firestore push & snapshot reconciliation
├── views/
│   ├── CalendarView.tsx      # Month, Week & Schedule multi-layer calendar
│   ├── HabitsView.tsx        # Daily Focus, 7/14/30d Matrix & Calendar backfill
│   ├── HomeView.tsx          # Focus timer, 7-day schedule, daily ring & scratchpad
│   ├── PurchasesView.tsx     # Expense analytics, CSV export & Subscriptions tracker
│   ├── SettingsView.tsx      # Themes, reminder alerts, sync, passphrase & backups
│   └── TasksView.tsx         # Google Tasks lists, Kanban board & repeating tasks
├── App.tsx                   # Top bar, Bell reminders, 9-dot launcher & modal shell
├── index.css                 # Tailwind v4 + 6 Material You theme tokens + hidden scrollbars
└── types.ts                  # Shared encrypted payload TypeScript schemas
```

---

## Roadmap Status

**85 of 100 shipped** · 20 existed before v2.0, 65 added since · 15 not done (reasons below).

| Status | Items |
| :--- | :--- |
| ✅ Already in v1 | 003, 008, 009, 011, 014, 015, 017, 021, 023, 027, 031, 034 (built-in smart views), 035, 039, 040, 051, 054, 055, 091, 099 |
| ✅ Added in v2.0 | 001, 002, 004, 006 (Goals page), 007, 010, 012, 013, 016, 018, 019, 020, 024, 025, 026, 028, 029, 030, 032, 033, 036, 037, 038, 042, 043, 044, 045, 046, 047, 049, 050, 052, 053, 057, 058 (sound / vibrate / pop-up channels), 059, 060, 061, 062, 063, 064, 065, 066, 068, 069, 070, 072, 073, 077, 080, 081 (fingerprint), 082, 084, 085, 086, 088, 089, 092, 093, 095, 096, 097, 098, 100 |
| ✅ Added in v2.1 | 022 Habit routines (step-by-step runner) |
| ⏳ Not yet | 041 Drag-to-reschedule · 048 Per-event timezone — feasible, not built yet |
| 🚫 Needs backend / rules change | 071 Device sessions, 094 Notes drawer (new Firestore kinds must be added to `firestore.rules` and deployed first) |
| 🚫 Unsafe or breaks compatibility | 076 Tombstone GC (devices offline >90 days could resurrect data), 083 Duress PIN, 087 Argon2id, 090 KDF tuner (existing vaults & other devices could no longer unlock) |
| 🚫 Out of scope for this app | 005 On-device OCR (large ML model), 056 Geofencing, 067 Wear OS, 074 Conflict merge UI, 075 P2P QR transfer, 078 Web-worker decrypt, 079 Periodic background sync |

The original wish list is kept below for reference.

## 100 Future New Functions Roadmap

### Category A: Purchases & Personal Finance (001–010)
- **001. Multi-Currency Live Ledger**: Record purchases in foreign currencies with encrypted exchange-rate snapshots converted into your base currency.
- **002. Split Expense & Shared IOU Tracking**: Split a purchase evenly or by custom shares and track who owes you under Reimbursements.
- **003. Category Monthly Envelope Budgets**: Set individual monthly caps per category (Groceries, Dining, Tech) with live remaining progress bars.
- **004. Encrypted Receipt Photo Vault**: Capture and compress receipt images client-side, encrypt with AES-256-GCM, and attach to purchase records.
- **005. Local Browser Receipt OCR**: Extract merchant name, date, and total on-device via WebAssembly/ML Kit before saving an entry.
- **006. Savings Buckets & Goal Jars**: Track dedicated personal sinking funds (Emergency Fund, Travel, Hardware Upgrade) with progress milestones.
- **007. Merchant Spend Leaderboard**: Rank top merchants by frequency, average ticket size, and total annualized outlay.
- **008. Income & Net Cashflow Entries**: Optional paycheck and side-income log entries to compute true monthly savings rate alongside spending.
- **009. Refund Deadline Countdown**: Flag recent big-ticket purchases with return-window expiry dates inside Upcoming Reminders.
- **010. Cashback & Card Rewards Estimator**: Associate credit cards with category reward multipliers to see estimated points earned per purchase.

### Category B: Subscriptions & Bills (011–020)
- **011. Price Hike History Log**: Record historical subscription price changes to visualize inflation per service over time.
- **012. Seat & Family Share Tracker**: Track shared slots on family plans and log split reimbursements automatically.
- **013. Annual vs. Monthly Savings Calculator**: Highlight potential yearly savings when switching eligible monthly plans to annual billing.
- **014. Virtual Card Expiry Linker**: Associate subscriptions with payment card last-4 digits and alert before card expiration months.
- **015. Usage-Value Audit Prompt**: Periodic quarterly prompt asking "Did you use this service?" to surface underused subscriptions for cancellation.
- **016. Free-Trial Auto-Cancellation Checklist**: Step-by-step reminder workflow 48h and 2h before a trial converts to paid billing.
- **017. Prorated Mid-Cycle Upgrade Tracker**: Handle plan tier upgrades/downgrades while keeping cumulative spend history intact.
- **018. One-Time Annual Bill Forecasting**: Dedicated yearly calendar heatmap showing heavy renewal months ahead of time.
- **019. Cancellation Proof Archive**: Store cancellation confirmation numbers, screenshots, and final billing dates on archived subscriptions.
- **020. Variable Utility Bill Estimator**: Support non-fixed recurring bills (electricity, water) using rolling 3-month averages in forecasts.

### Category C: Habits & Streaks (021–030)
- **021. Freeze / Rest Day Tokens**: Grant configurable streak-freeze tokens so illness or travel never breaks a long-running streak unfairly.
- **022. Habit Chains & Routine Stacking**: Group morning or evening habits into a sequential guided flow with a "Next Habit" timer.
- **023. Quit / Negative Habit Mode**: Track days abstained (e.g., no sugar, zero impulse spend) counting upward with relapse recovery notes.
- **024. Quantitative Trend Charts**: Line and bar charts showing numeric habit averages (e.g., liters of water, pages read) across 30/90/365 days.
- **025. Correlated Habit Insights**: Local statistical comparison showing how completing Habit A affects completion rates of Habit B.
- **026. Year-in-Pixels 365-Day Heatmap**: Full GitHub-style 52-week contribution heatmap per habit with tap-to-inspect daily logs.
- **027. Flexible Weekly Quota Habits**: Support "3 times per week on any days" targets without locking to specific weekday indices.
- **028. Micro-Journal Prompt on Check-in**: Optional 1-line reflection popup right after logging a completed habit.
- **029. Built-In Habit Stopwatch & Timer**: Embed a live duration timer inside time-based habits (e.g., 20m meditation) that auto-logs on finish.
- **030. Habit Milestone Trophies**: Track personal best milestones (7d, 30d, 100d, 365d) inside your encrypted profile without external gamification servers.

### Category D: Tasks & Productivity (031–040)
- **031. Natural Language Quick-Add Parser**: Type `"Pay rent tomorrow 9am !high"` to auto-populate due date, due time, and priority.
- **032. Task Timeboxing onto Calendar**: Drag or assign a duration block (`30m`, `1h`) to project tasks directly onto the Week Calendar timeline.
- **033. Waiting-For & Blocked Dependencies**: Mark a task as dependent on another task so blocked items stay hidden from Today's queue.
- **034. Saved Smart Filters & Views**: Create custom filter views (`High Priority + Work`, `No Due Date`, `Weekend Errands`).
- **035. Pomodoro Session Linker**: Bind Focus Timer runs to a specific Task ID to accumulate total focused minutes per task.
- **036. Markdown Rich Notes & Code Blocks**: Render formatted checklists, links, and inline code inside task detail drawers.
- **037. Reusable Project Checklists / Templates**: Save packing lists or weekly review checklists as 1-click spawnable task templates.
- **038. Automatic Daily Carryover Wizard**: Morning review sheet listing yesterday's unfinished tasks for bulk Reschedule, Defer, or Complete.
- **039. Batch Multi-Select Toolbar**: Select multiple tasks to bulk-move lists, shift due dates, change priority, or mark complete.
- **040. Eisenhower Priority Matrix View**: 2×2 quadrant view sorting tasks by urgency (`dueDate` proximity) and importance (`priority`).

### Category E: Calendar & Time Management (041–050)
- **041. Drag-to-Reschedule Week Grid**: Drag events and timeblocked tasks smoothly between hourly slots in the Week view.
- **042. External `.ics` Feed Import & Export**: Export your encrypted schedule as standard iCalendar `.ics` or import external holiday calendars locally.
- **043. Custom Event Color Labels & Categories**: Assign personal color meanings (`Deep Work`, `Health`, `Personal`, `Finance`) consistently across views.
- **044. Multi-Day Span & Travel Time Blocks**: Render multi-day trips as continuous top banners and attach optional buffer travel minutes before/after events.
- **045. Countdown Widget Tiles for Milestones**: Track days remaining until major target calendar dates (exams, trips, anniversaries) on Home.
- **046. Year-at-a-Glance Mini-Calendar**: 12-month compact density view highlighting busy weeks, vacations, and high-renewal clusters.
- **047. Birthday & Anniversary Age Calculator**: Special yearly recurrence mode displaying turning age or milestone year automatically.
- **048. Timezone Override per Event**: Attach specific timezone offsets to flight or remote meeting events without shifting local recurring items.
- **049. Daily Agenda Morning Briefing Card**: Consolidated 24-hour timeline combining weather-free schedule blocks, due tasks, and habit windows.
- **050. Free-Slot Finder**: Highlight open `30m`, `60m`, and `120m` unscheduled gaps in your current week for deep work.

### Category F: Reminders & Smart Alerts (051–060)
- **051. Granular Pre-Event Offsets**: Per-item reminder offsets (`At time`, `10m before`, `1h before`, `1d before`, `3d before`).
- **052. Custom Snooze Presets (`15m`, `1h`, `Tonight`, `Next Week`)**: Expanded snooze menu inside both the Bell popover and Android notification actions.
- **053. Persistent Nagging Mode for Critical Tasks**: Optional repeating reminder every 10 minutes on Android until acknowledged or completed.
- **054. Quiet Hours / Do-Not-Disturb Schedule**: Suppress non-urgent habit and digest notifications between configurable sleep hours (`22:30`–`07:00`).
- **055. Missed Reminders Bulk Recovery**: One-tap `"Reschedule all missed to Today"` or `"Mark all missed reviewed"` inside the Bell popover.
- **056. Location-Triggered Reminders (Android APK)**: Local geofence alerts via Android `GeofencingClient` (e.g., remind when arriving home or near grocery store).
- **057. Evening Wrap-Up Digest Notification**: Scheduled 9:00 PM summary listing remaining daily habits and tomorrow's first calendar event.
- **058. Custom Alert Ringtone & Vibration Patterns**: Distinct Android notification channels for urgent bills vs. gentle habit nudges.
- **059. Snooze History & Procrastination Counter**: Surface tasks snoozed more than 3 times so you can break them down or drop them.
- **060. Upcoming 30-Day Horizon Filter**: Toggle Bell popover range between `Today`, `7 Days`, and `30 Days`.

### Category G: Android Companion APK & Native Widgets (061–070)
- **061. Android Quick-Settings Tile**: Pull-down system shade tile for instant Expense Quick-Log or Focus Timer start from any screen.
- **062. Lock-Screen Today Summary Notification**: Ongoing, dismissible low-priority status notification showing remaining tasks and habits for the day.
- **063. Specialized Glance Widgets by Module**: Separate `2x2` Habit Streak Grid Widget, `4x1` Quick-Add Bar Widget, and `4x2` Subscription Renewal Ticker.
- **064. App Shortcuts (Long-Press Launcher Menu)**: Long-press the MMV-HUB app icon on Android to jump straight into New Expense, New Task, or Today's Habits.
- **065. Android Share-Sheet Receipt / Link Capture**: Share URLs or bank transaction text directly into MMV-HUB from other Android apps to pre-fill Task or Purchase modals.
- **066. Dynamic Material You Wallpaper Monet Colors**: Automatically sample Android 12+ system wallpaper color tokens alongside the 6 built-in themes.
- **067. Wear OS Companion Tile**: Glanceable smartwatch tile to check off daily habits, view next task, and pause/start focus timers from your wrist.
- **068. NFC Tag Habit Triggers**: Tap a physical NFC sticker (e.g., on desk or pill bottle) to auto-increment a specific encrypted habit in Android.
- **069. Haptic Feedback Precision Profile**: Subtle tactile ticks on habit completions, slider drags, and timer finishes.
- **070. Foreground Focus Timer Notification**: Persistent live countdown chronometer notification with Pause/Stop buttons even when screen is locked.

### Category H: Cross-Device Sync & Offline Storage (071–080)
- **071. Multi-Device Connected Sessions Registry**: View active synced web browsers and Android APK installations with last-seen timestamps.
- **072. Offline Sync Queue Inspector**: Inspect pending encrypted mutation payloads queued locally before reconnection, with manual retry per record.
- **073. Delta Compression for Large Vaults**: Batch multiple rapid edits (e.g., bulk checklist creation) into atomic Firestore `WriteBatch` commits under 500 ops.
- **074. Conflict Diff Resolver UI**: When two offline devices edit the exact same item simultaneously, offer a side-by-side merge prompt instead of silent overwrite.
- **075. Encrypted Peer-to-Peer QR Transfer**: Transfer the local device vault over local Wi-Fi / WebRTC or QR chunks without touching cloud storage.
- **076. Automatic Tombstone Garbage Collection**: Periodically prune old `deleted: true` cloud tombstones older than 90 days after all registered devices confirm sync.
- **077. Local IndexedDB / Room Quota Meter**: Visual storage breakdown showing encrypted payload footprint across purchases, habits, tasks, and notes.
- **078. Instant Cache Warm-Up on New Login**: Streamlined batch decryption pipeline on fresh devices using a Web Worker / Kotlin Coroutine dispatcher pool.
- **079. Background Sync via Periodic Background Sync API**: Silent service worker wakeups on Chromium Android to pull cloud changes even before opening the PWA.
- **080. Export/Import Single-Module Bundles**: Export only Tasks or only Habits in encrypted or plaintext JSON for selective archiving.

### Category I: Vault Security, Privacy & Backups (081–090)
- **081. WebAuthn / Passkey PRF Vault Unlock**: Unlock the AES vault key on Web and Android using hardware fingerprint/FaceID via WebAuthn PRF extension.
- **082. Emergency Recovery Key (24-Word BIP39 Paper Code)**: Generate an offline printable recovery mnemonic capable of unwrapping your vault passphrase.
- **083. Duress / Decoy Vault PIN**: Secondary unlock PIN opening an empty or innocuous decoy workspace for high-privacy travel scenarios.
- **084. Auto-Redacted Clipboard Copy**: Auto-clear copied notes or vault backup text from the system clipboard after 30 seconds.
- **085. Scheduled Automatic Encrypted Drive/Local Backups**: Weekly prompt or Android WorkManager job saving `.mmvvault` encrypted snapshots to chosen device folders.
- **086. Tamper-Evident Security Audit Log**: Encrypted local log tracking vault unlocks, failed passphrase attempts, key rotations, and exports.
- **087. Configurable Argon2id KDF Upgrade Path**: Optional migration from PBKDF2-150k to memory-hard Argon2id for passphrase derivation on supported clients.
- **088. Blur-on-App-Switch Privacy Shield**: Hide sensitive financial figures on `visibilitychange` / Android recents thumbnail (`FLAG_SECURE`).
- **089. Zero-History Incognito Scratchpad Mode**: Ephemeral quick-memo mode that clears automatically on vault lock without persisting to Firestore.
- **090. Custom Key-Derivation Iteration Tuner**: Let advanced users increase PBKDF2 iterations (`150k` -> `600k`) when rotating their master passphrase.

### Category J: Personalization, Search & Insights (091–100)
- **091. Global Encrypted Command Palette (`Ctrl+K`)**: Instant client-side fuzzy search across decrypted purchases, tasks, habits, events, notes, and app views.
- **092. Keyboard Shortcuts Cheat-Sheet (`?`)**: Fast desktop keyboard navigation (`g h` Home, `g t` Tasks, `n t` New Task, `n p` Log Spend).
- **093. Custom Home Card Reordering & Visibility**: Drag-and-drop widget layout on `HomeView` to hide unused modules or pin favorite trackers to the top.
- **094. Encrypted Rich Markdown Vault Notes**: Dedicated personal wiki/notes drawer with folders, pinned notes, and instant backlinks to tasks or expenses.
- **095. Weekly Personal Review Report**: Auto-generated client-side Sunday digest summarizing net spend vs. budget, habit consistency `%`, and tasks closed.
- **096. Custom Theme Color Picker**: Full HSL accent seed color generator creating live Material 3 tonal tokens beyond the 6 preset themes.
- **097. Right-to-Left & Multi-Locale Date Formatting**: User-selectable date formats (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`) and `12h` vs `24h` clock override.
- **098. Soundscape & Ambient Focus Audio**: Optional offline brown-noise / rain synthesizer via Web Audio API bundled inside the Pomodoro Focus Timer.
- **099. OLED True-Black Dark Theme**: Optional `#000000` pure black surface toggle inside Appearance settings for AMOLED Android battery savings.
- **100. Annual "Year in Review" Summary Card**: Client-side year-end retrospective aggregating total saved, longest streak, top spending month, and completed tasks.
