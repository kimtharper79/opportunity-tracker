# Academic Prep App — Spring 2026

A personal daily briefing tool that connects to your Notion workspace and tells you exactly what to read, watch, do, or prepare for — every morning. Built for maintaining a 4.0 GPA across four demanding courses with zero-tolerance late policies.

---

## Features

- **Live Notion integration** — queries your Spring 2026 Master Tracker database
- **Smart daily briefing** — not a raw data dump; context-aware reading recommendations, critique prep, ELO tracking
- **Hard-coded deadline layer** — critical dates (LSM chapters, pre-quarter tasks) surface even if not in Notion
- **Zero-late policy enforcement** — 🚨 flag on every task, in every output, always
- **Fallback cache** — if Notion is unreachable, uses last successful snapshot
- **Daily scheduler** — runs at your configured time via cron
- **Desktop notification** — push notification at scheduled time
- **Optional email** — HTML-formatted briefing sent to your inbox

---

## Prerequisites

- **Node.js** >= 18.0.0
- **Notion API key** (integration connected to your workspace)
- A Notion integration with access to database `43d1cdf7-2436-4de6-84f8-2defd508756d`

---

## Setup

### 1. Install dependencies

```bash
cd academic-prep-app
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=43d1cdf7-2436-4de6-84f8-2defd508756d
NOTIFICATION_TIME=07:30

# Email — leave blank to disable
USER_EMAIL=you@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
```

> **Notion API key:** Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations), create an integration, copy the secret, and share your database with it.

> **Gmail SMTP:** Use an App Password, not your main password. Enable 2FA first, then generate at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

---

## Usage

### Run an immediate briefing (test)

```bash
node src/index.js --now
```

### Start the daily scheduler

```bash
node src/index.js
```

The briefing will run every day at the time set in `NOTIFICATION_TIME` (default: `07:30`).

### Dry run (no notifications sent)

```bash
node src/index.js --now --dry-run
```

---

## Running in the Background with pm2

Install pm2 globally:

```bash
npm install -g pm2
```

Start the app:

```bash
pm2 start src/index.js --name academic-prep
```

Save the process list so it restarts after reboot:

```bash
pm2 save
pm2 startup
# Follow the printed command to enable startup
```

Useful pm2 commands:

```bash
pm2 status          # Check if running
pm2 logs academic-prep   # View live logs
pm2 stop academic-prep   # Stop
pm2 restart academic-prep  # Restart
pm2 delete academic-prep   # Remove from pm2
```

---

## File Structure

```
academic-prep-app/
├── .env                  # Your secrets (gitignored)
├── .env.example          # Template — copy to .env
├── .gitignore
├── package.json
├── README.md
├── src/
│   ├── index.js          # Entry point + scheduler
│   ├── notion.js         # Notion API client + query functions
│   ├── briefing.js       # Daily briefing logic + formatting
│   ├── notify.js         # Desktop notification + email
│   ├── readings.js       # Reading schedule logic
│   ├── config.js         # Environment validation
│   └── cache.js          # Local JSON caching layer
├── data/
│   ├── courses.json      # Course schedule, hard-coded deadlines
│   ├── readings.json     # Full resource list (all 4 courses)
│   └── cache.json        # Auto-generated — last Notion snapshot
└── logs/
    └── errors.log        # API errors with timestamps
```

---

## Courses Covered

| Code | Name | Schedule | Room |
|------|------|----------|------|
| PHOT 218 🔵 | Analog Photography | Mon/Wed 8:00–10:30 AM | ALEXAN 114 |
| PHOT 215 🟢 | History of Photography | Mon/Wed 11:00 AM–1:30 PM | ALEXAN 108 |
| SFIN 220 🟣 | Studio Finance / Contemporary Art | Mon/Wed 2:00–4:30 PM | ALEXAN 206 |
| PHOT 214 🟠 | Studio Photography / Lighting | Tue/Thu 8:00–10:30 AM | GRASCO 127 |

**Quarter dates:** March 23 – May 27, 2026

---

## Critical Notes

- **PHOT 218** has no fixed calendar dates — assignments are sequential. The app will flag "Verify with Prof. Nolan" when tasks have no due date.
- **Zero Late Policy** — 🚨 appears on every view for affected tasks. This is never suppressed.
- **PHOT 215 Video Essay** (40% of grade) — standing reminder appears every week from Week 4 onward.
- **SFIN 220 Reading Responses** — log all responses, submit your best 10 at quarter end. The briefing tracks your running count from Notion.
- **ELO tracking** — if within 3 weeks of May 27 and ELOs are incomplete, briefing escalates to 🚨.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Missing required environment variables` | Copy `.env.example` to `.env` and fill in values |
| `Notion API error` | Check your `NOTION_API_KEY` and that your integration has access to the database |
| `No deadlines found in Notion` | Verify `NOTION_DATABASE_ID` matches your database |
| Desktop notification not showing | Ensure `node-notifier` is installed and your OS allows notifications |
| Email not sending | Check SMTP credentials; for Gmail, use an App Password |
| Briefing not running at scheduled time | Confirm `pm2` is running: `pm2 status` |

Errors are logged to `logs/errors.log` with timestamps.

---

## Notion Database Schema

Your database at `43d1cdf7-2436-4de6-84f8-2defd508756d` should have these fields:

| Field | Type |
|-------|------|
| Task | Title |
| Course | Select |
| Due Date | Date |
| Type | Select |
| Status | Select |
| Urgency | Select |
| Weight | Text |
| Zero Late Policy | Checkbox |
| Pass / Fail | Checkbox |
| Time Est (hrs) | Text |
| Quick Notes | Text |
