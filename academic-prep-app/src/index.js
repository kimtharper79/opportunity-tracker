'use strict';

const { validateConfig } = require('./config');
const { getAllTasks } = require('./tasks');
const { buildBriefing, formatTerminalBriefing, buildNotificationSummary, buildEmailHTML } = require('./briefing');
const { notify } = require('./notify');
const { startServer } = require('./server');

const args = process.argv.slice(2);
const RUN_NOW = args.includes('--now');
const DRY_RUN = args.includes('--dry-run');
const WEB = args.includes('--web');
const PORT = (() => {
  const p = args.find(a => a.startsWith('--port='));
  return p ? parseInt(p.split('=')[1], 10) : 3000;
})();

async function runBriefing() {
  const config = validateConfig();
  const today = new Date();

  const tasks = getAllTasks();
  console.log(`   ✅ ${tasks.length} task(s) loaded from local data.`);

  const briefing = buildBriefing(tasks, today);
  const terminalOutput = formatTerminalBriefing(briefing);
  const notificationSummary = buildNotificationSummary(briefing);
  const emailHTML = buildEmailHTML(briefing);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Briefing output:\n');
    console.log(terminalOutput);
    console.log('\n[DRY RUN] Notification summary:');
    console.log(notificationSummary);
    console.log('\n[DRY RUN] Email would be sent:', config.emailEnabled ? 'YES' : 'NO (not configured)');
    return;
  }

  await notify(config, terminalOutput, notificationSummary, emailHTML, today);
}

async function startScheduler() {
  const config = validateConfig();
  const cron = require('node-cron');
  const { notificationHour, notificationMinute, notificationTime } = config;
  const cronExpression = `${notificationMinute} ${notificationHour} * * *`;

  console.log(`\n📅 Academic Prep Scheduler started.`);
  console.log(`   Daily briefing scheduled for: ${notificationTime}`);
  console.log(`   Cron expression: ${cronExpression}`);
  console.log(`   Press Ctrl+C to stop.\n`);

  cron.schedule(cronExpression, async () => {
    console.log(`\n⏰ Running scheduled briefing at ${new Date().toLocaleTimeString()}...`);
    try {
      await runBriefing();
    } catch (err) {
      console.error('❌ Briefing failed:', err.message);
    }
  });
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

(async () => {
  try {
    if (WEB) {
      startServer(PORT);
    } else if (RUN_NOW) {
      await runBriefing();
    } else {
      await startScheduler();
    }
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
