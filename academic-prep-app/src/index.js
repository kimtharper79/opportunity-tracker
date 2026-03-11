'use strict';

const { validateConfig } = require('./config');
const { fetchAllTasks } = require('./notion');
const { buildBriefing, formatTerminalBriefing, buildNotificationSummary, buildEmailHTML } = require('./briefing');
const { notify } = require('./notify');
const { logError } = require('./cache');

const args = process.argv.slice(2);
const RUN_NOW = args.includes('--now');
const DRY_RUN = args.includes('--dry-run');

async function runBriefing() {
  const config = validateConfig();
  const today = new Date();

  console.log(`\n⏳ Fetching data from Notion...`);
  const { tasks, fromCache, cachedAt, error } = await fetchAllTasks(config);

  if (error && tasks.length === 0) {
    console.error('\n❌ Could not fetch Notion data and no cache is available.');
    console.error('   Run the app when connected to the internet first to build a cache.');
    process.exit(1);
  }

  if (fromCache) {
    console.log(`   📦 Using cached data from ${cachedAt}`);
  } else {
    console.log(`   ✅ Notion data loaded — ${tasks.length} tasks found.`);
  }

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
      logError('Scheduled briefing failed', err);
      console.error('❌ Briefing failed — see logs/errors.log for details.');
    }
  });
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

(async () => {
  try {
    if (RUN_NOW) {
      await runBriefing();
    } else {
      await startScheduler();
    }
  } catch (err) {
    logError('Fatal startup error', err);
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  }
})();
