'use strict';

const path = require('path');
const coursesData = require(path.resolve(__dirname, '..', 'data', 'courses.json'));
const {
  getDailyReading,
  getUpcomingHardDeadlines,
  getHardDeadlinesToday,
  getQuarterWeek,
  getDayName,
} = require('./readings');
const { filterByDateRange, filterIncomplete } = require('./notion');

// ─── Date Utilities ─────────────────────────────────────────────────────────

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDisplayDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatFullDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Quarter Awareness ───────────────────────────────────────────────────────

function getQuarterStatus(today) {
  const start = new Date(coursesData.quarter.start + 'T00:00:00');
  const end = new Date(coursesData.quarter.end + 'T23:59:59');
  if (today < start) return 'pre';
  if (today > end) return 'post';
  return 'active';
}

// ─── Today's Classes ────────────────────────────────────────────────────────

function getTodaysClasses(dayName) {
  return coursesData.courses.filter(c => c.schedule.includes(dayName));
}

// ─── ELO Status ─────────────────────────────────────────────────────────────

function getELOStatus(today) {
  const quarterEnd = new Date(coursesData.quarter.end + 'T23:59:59');
  const daysToEnd = Math.ceil((quarterEnd - today) / (1000 * 60 * 60 * 24));
  const within3Weeks = daysToEnd <= 21;

  return coursesData.courses
    .filter(c => c.elos && c.elos.required > 0)
    .map(c => ({
      code: c.code,
      required: c.elos.required,
      completed: c.elos.completed,
      missing: c.elos.required - c.elos.completed,
      urgent: within3Weeks && c.elos.completed < c.elos.required,
    }));
}

// ─── Video Essay Reminder ────────────────────────────────────────────────────

function shouldShowVideoEssayReminder(today) {
  const weekNum = getQuarterWeek(today);
  return weekNum >= 4;
}

// ─── Documentary Alignment ──────────────────────────────────────────────────

function getDocumentaryFlag(dayName, weekNum) {
  const flags = [];
  // FSA documentary week 5 — PHOT 215 aligns with "Where the Water Holds You"
  if (weekNum === 5 && (dayName === 'Monday' || dayName === 'Wednesday')) {
    flags.push('📽️  This week\'s PHOT 215 FSA content aligns with "Where the Water Holds You" documentary project.');
  }
  // SFIN 220 week 8 — archives/documentary
  if (weekNum === 8 && (dayName === 'Monday' || dayName === 'Wednesday')) {
    flags.push('📽️  SFIN 220 Week 8 covers archives/documentary — connects to "Thresholds" project.');
  }
  return flags;
}

// ─── Monterey Trip Warning ───────────────────────────────────────────────────

function getMontereyWarning(today, incompleteTasks) {
  const departure = new Date(coursesData.montereyTrip.departure + 'T00:00:00');
  const dayBefore = addDays(departure, -1);
  const todayStr = toISODate(today);
  const dayBeforeStr = toISODate(dayBefore);

  if (todayStr === dayBeforeStr) {
    const preQuarterTasks = incompleteTasks.filter(t => {
      return t.dueDate && t.dueDate < coursesData.quarter.start;
    });
    return {
      show: true,
      message: coursesData.montereyTrip.note,
      incompleteTasks: preQuarterTasks,
    };
  }
  return { show: false };
}

// ─── SFIN Reading Response Reminder ─────────────────────────────────────────

function getSFINReadingReminder(notionTasks) {
  const sfin = notionTasks.filter(t => {
    const course = (t.course || '').includes('SFIN');
    const isReading = (t.type || '').includes('Reading');
    const done = (t.status || '').toLowerCase().includes('done') ||
                 (t.status || '').toLowerCase().includes('submitted');
    return course && isReading && done;
  });
  return sfin.length;
}

// ─── Merge Notion + Hard-Coded Tasks ────────────────────────────────────────

function mergeWithHardCodedDeadlines(notionTasks, hardDeadlines) {
  // Convert hard-coded deadlines into task-like objects, avoiding duplicates
  const hardAsTasks = hardDeadlines.map(d => ({
    id: `hard-${d.task.substring(0, 20)}`,
    task: d.task,
    course: d.course,
    dueDate: d.dueDate,
    type: d.type,
    status: '⬜ Not Started',
    weight: d.weight || null,
    zeroLatePolicy: d.zeroLatePolicy,
    quickNotes: d.notes,
    timeEst: null,
    source: 'hard-coded',
  }));

  // Deduplicate: skip hard-coded items that already appear in Notion data
  const notionTaskNames = new Set(notionTasks.map(t => t.task.toLowerCase().trim()));
  const newHard = hardAsTasks.filter(h => !notionTaskNames.has(h.task.toLowerCase().trim()));

  return [...notionTasks, ...newHard];
}

// ─── Build Briefing Data Object ──────────────────────────────────────────────

function buildBriefing(notionTasks, today = new Date()) {
  const todayStr = toISODate(today);
  const dayName = getDayName(today);
  const weekNum = getQuarterWeek(today);
  const quarterStatus = getQuarterStatus(today);

  // Merge all hard-coded deadlines into task list
  const allHardDeadlines = require(path.resolve(__dirname, '..', 'data', 'courses.json')).hardCodedDeadlines;
  const allTasks = mergeWithHardCodedDeadlines(notionTasks, allHardDeadlines);
  const incompleteTasks = filterIncomplete(allTasks);

  // Date ranges
  const threeDaysOut = toISODate(addDays(today, 3));
  const sevenDaysOut = toISODate(addDays(today, 7));

  // Due today
  const dueToday = incompleteTasks.filter(t => t.dueDate === todayStr);

  // Due in next 3 days (not today)
  const dueNext3 = incompleteTasks
    .filter(t => t.dueDate && t.dueDate > todayStr && t.dueDate <= threeDaysOut)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Critiques and major projects within 7 days
  const upcomingCritiques = incompleteTasks.filter(t => {
    if (!t.dueDate) return false;
    const isCritique = (t.type || '').toLowerCase().includes('critique') ||
                       (t.type || '').toLowerCase().includes('major');
    return isCritique && t.dueDate >= todayStr && t.dueDate <= sevenDaysOut;
  });

  // ELO status
  const eloStatus = getELOStatus(today);

  // Today's reading
  const dailyReading = getDailyReading(today);

  // Upcoming hard deadlines (for reinforcement)
  const upcomingHard = getUpcomingHardDeadlines(7, today);

  // PHOT 218 — check if any task has no due date
  const phot218Missing = incompleteTasks.filter(t =>
    (t.course || '').includes('PHOT 218') && !t.dueDate
  );

  // Today's classes
  const todaysClasses = getTodaysClasses(dayName);

  // Monterey warning
  const monterey = getMontereyWarning(today, incompleteTasks);

  // Documentary flags
  const documentaryFlags = getDocumentaryFlag(dayName, weekNum);

  // Video essay reminder
  const showVideoEssay = shouldShowVideoEssayReminder(today);

  // SFIN reading response count
  const sfinResponseCount = getSFINReadingReminder(notionTasks);

  // Validate Notion data
  const notionEmpty = notionTasks.length === 0;

  return {
    today,
    todayStr,
    dayName,
    weekNum,
    quarterStatus,
    todaysClasses,
    dueToday,
    dueNext3,
    upcomingCritiques,
    eloStatus,
    dailyReading,
    upcomingHard,
    phot218Missing,
    monterey,
    documentaryFlags,
    showVideoEssay,
    sfinResponseCount,
    notionEmpty,
  };
}

// ─── Terminal Formatting ─────────────────────────────────────────────────────

const LINE = '════════════════════════════════════════════════════';
const DIVIDER = '────────────────────────────────────────────────────';

function formatTask(t) {
  const zeroLate = t.zeroLatePolicy ? ' 🚨' : '';
  const weight = t.weight ? ` [${t.weight}]` : '';
  const course = t.course ? ` | ${t.course}` : '';
  const type = t.type ? ` | ${t.type}` : '';
  const notes = t.quickNotes ? `\n     📌 ${t.quickNotes}` : '';
  return `  • ${t.task}${course}${type}${weight}${zeroLate}${notes}`;
}

function formatTerminalBriefing(briefing) {
  const lines = [];
  const { today, dayName, weekNum, quarterStatus } = briefing;

  lines.push('');
  lines.push(LINE);
  lines.push(`📚 DAILY ACADEMIC BRIEFING — ${formatFullDate(today)}`);
  if (quarterStatus === 'active') {
    lines.push(`   Spring 2026 · Week ${weekNum} · ${dayName}`);
  }
  lines.push(LINE);

  // ── Pre/Post Quarter ──
  if (quarterStatus === 'pre') {
    const start = coursesData.quarter.start;
    lines.push('');
    lines.push(`⏳ PRE-QUARTER MODE — Quarter begins ${formatDisplayDate(start)}`);
    lines.push('   Complete all pre-quarter tasks before classes start.');
  } else if (quarterStatus === 'post') {
    lines.push('');
    lines.push('🎓 QUARTER COMPLETE — Spring 2026 has ended. Great work, Kimberly!');
    lines.push('');
    return lines.join('\n');
  }

  // ── Monterey Warning ──
  if (briefing.monterey.show) {
    lines.push('');
    lines.push(`⚠️  ${briefing.monterey.message}`);
    if (briefing.monterey.incompleteTasks.length > 0) {
      lines.push('   Incomplete pre-quarter tasks:');
      briefing.monterey.incompleteTasks.forEach(t => lines.push(formatTask(t)));
    } else {
      lines.push('   ✅ All pre-quarter tasks complete — have a great trip!');
    }
  }

  // ── Today's Classes ──
  lines.push('');
  lines.push('📍 TODAY\'S CLASSES');
  if (briefing.todaysClasses.length === 0) {
    lines.push('   No classes today — studio/reading day.');
  } else {
    briefing.todaysClasses.forEach(c => {
      lines.push(`  ${c.emoji} ${c.code}: ${c.name}`);
      lines.push(`     🕐 ${c.time} · 📍 ${c.room}`);
      if (c.notes && (c.code === 'PHOT 218' || c.notes.includes('Verify'))) {
        lines.push(`     ℹ️  ${c.notes}`);
      }
    });
  }

  // ── Due Today ──
  lines.push('');
  lines.push('🚨 DUE TODAY');
  if (briefing.dueToday.length === 0) {
    lines.push('   Nothing due today — stay ahead.');
  } else {
    briefing.dueToday.forEach(t => lines.push(formatTask(t)));
  }

  // ── Next 3 Days ──
  lines.push('');
  lines.push('📅 NEXT 3 DAYS');
  if (briefing.dueNext3.length === 0) {
    lines.push('   Nothing due in the next 3 days.');
  } else {
    briefing.dueNext3.forEach(t => {
      const dateStr = formatDisplayDate(t.dueDate);
      lines.push(`  ${dateStr} — ${formatTask(t).trim()}`);
    });
  }

  // ── Today's Reading / Watching ──
  lines.push('');
  lines.push("📖 TODAY'S READING / WATCHING");
  if (briefing.dailyReading) {
    const r = briefing.dailyReading;
    const typeLabel = r.type === 'YouTube' ? '▶️  Watch' : r.type === 'podcast' ? '🎙️  Listen' : '📖 Read';
    lines.push(`  ${typeLabel}: ${r.title}`);
    if (r.author) lines.push(`     by ${r.author}`);
    if (r.url) lines.push(`     🔗 ${r.url}`);
    if (r.estimatedMinutes) lines.push(`     ⏱  Estimated time: ${r.estimatedMinutes} min`);
    if (r.context) lines.push(`     💡 ${r.context}`);
    if (r.daysUntilDue !== undefined) {
      const urgency = r.daysUntilDue <= 1 ? '🔴' : r.daysUntilDue <= 3 ? '🟠' : '🟡';
      lines.push(`     ${urgency} Due in ${r.daysUntilDue} day(s) — ${r.hardDeadline}`);
    }
    if (r.dayFocus) lines.push(`     📌 Today's focus: ${r.dayFocus}`);
  } else {
    lines.push('   No specific reading assigned — review most recent course materials.');
  }

  // ── Upcoming Critiques & Studio Prep ──
  lines.push('');
  lines.push('🎯 UPCOMING CRITIQUES & STUDIO PREP');
  const critiques = briefing.upcomingCritiques;
  const hardPrep = briefing.upcomingHard.filter(d =>
    d.type.includes('Critique') || d.type.includes('Major')
  );
  if (critiques.length === 0 && hardPrep.length === 0) {
    lines.push('   No critiques or major projects due within 7 days.');
  } else {
    [...critiques, ...hardPrep].forEach(t => {
      const dateStr = t.dueDate ? formatDisplayDate(t.dueDate) : '(date TBD)';
      const note = t.quickNotes || t.notes || '';
      lines.push(`  • ${t.task} | Due ${dateStr}${t.zeroLatePolicy ? ' 🚨' : ''}`);
      if (note) lines.push(`    📌 ${note}`);
    });
  }

  // ── Video Essay Reminder ──
  if (briefing.showVideoEssay) {
    lines.push('');
    lines.push('🎬 VIDEO ESSAY REMINDER (PHOT 215 — 40% of grade)');
    lines.push('   Track your progress. Script Draft due ~Week 6 (Class 11) · Storyboard due ~Class 14.');
    lines.push('   If you haven\'t touched the essay this week — block time today.');
  }

  // ── PHOT 218 Note ──
  if (briefing.phot218Missing.length > 0 && dayName === 'Monday') {
    lines.push('');
    lines.push('🔵 PHOT 218 NOTE');
    lines.push('   Some PHOT 218 tasks have no due date — assignments are sequential.');
    lines.push('   ℹ️  Verify current assignment with Prof. Nolan at class today.');
  }

  // ── SFIN 220 Reading Responses ──
  if (briefing.sfinResponseCount > 0 || dayName === 'Friday') {
    lines.push('');
    lines.push('🟣 SFIN 220 READING RESPONSES');
    lines.push(`   Logged responses: ${briefing.sfinResponseCount} / 10 (submit best 10 for grading)`);
    if (briefing.sfinResponseCount < 10) {
      lines.push('   Log every response — you select which 10 to submit at quarter end.');
    }
  }

  // ── ELO Status ──
  lines.push('');
  lines.push('🎟️  ELO STATUS');
  if (briefing.eloStatus.length === 0) {
    lines.push('   No ELOs tracked in data.');
  } else {
    briefing.eloStatus.forEach(e => {
      const urgentFlag = e.urgent ? ' 🚨 URGENT' : '';
      lines.push(`  ${e.code}: ${e.completed}/${e.required} completed${urgentFlag}`);
    });
  }

  // ── Documentary Alignment ──
  if (briefing.documentaryFlags.length > 0) {
    lines.push('');
    lines.push('🎞️  STRATEGIC FLAG — DOCUMENTARY ALIGNMENT');
    briefing.documentaryFlags.forEach(f => lines.push(`  ${f}`));
  }

  // ── Notion Sync Warning ──
  if (briefing.notionEmpty) {
    lines.push('');
    lines.push('⚠️  No deadlines found in Notion — verify database sync.');
    lines.push('   Check your NOTION_DATABASE_ID and API key in .env');
  }

  lines.push('');
  lines.push(LINE);
  lines.push('   Strategy with soul. Foundation before aesthetics.');
  lines.push(LINE);
  lines.push('');

  return lines.join('\n');
}

// ─── Short Notification Summary ──────────────────────────────────────────────

function buildNotificationSummary(briefing) {
  const dueCount = briefing.dueToday.length + briefing.dueNext3.length;
  const reading = briefing.dailyReading ? briefing.dailyReading.title : 'No reading assigned';
  const firstDue = briefing.dueToday[0] ? ` | ⚠️ ${briefing.dueToday[0].task}` : '';
  return `📚 ${dueCount} item(s) due this week | Today: ${reading}${firstDue}`;
}

// ─── HTML Email Format ────────────────────────────────────────────────────────

function buildEmailHTML(briefing) {
  const { today, dayName, weekNum, quarterStatus } = briefing;

  const taskRow = (t) => {
    const zl = t.zeroLatePolicy ? ' <span style="color:red">🚨</span>' : '';
    const w = t.weight ? ` <em>[${t.weight}]</em>` : '';
    return `<li><strong>${t.task}</strong> | ${t.course || ''} | ${t.type || ''}${w}${zl}${t.quickNotes ? `<br><small>📌 ${t.quickNotes}</small>` : ''}</li>`;
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 0 auto; padding: 20px; color: #1a1a1a; }
  h1 { background: #1a1a2e; color: white; padding: 16px 20px; font-size: 18px; margin: 0; }
  h2 { color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 4px; font-size: 15px; margin-top: 24px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 8px; line-height: 1.5; }
  .footer { background: #f0f0f0; padding: 12px 16px; text-align: center; font-style: italic; color: #555; margin-top: 24px; }
  .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px 14px; margin: 12px 0; }
  .urgent { color: #dc3545; }
  .week { color: #666; font-size: 13px; margin-top: 4px; }
</style>
</head>
<body>
<h1>📚 Daily Academic Briefing — ${formatFullDate(today)}</h1>
<p class="week">Spring 2026 · Week ${weekNum} · ${dayName}</p>

${quarterStatus === 'pre' ? `<div class="warning">⏳ Pre-Quarter Mode — Quarter begins ${formatDisplayDate(coursesData.quarter.start)}</div>` : ''}

<h2>📍 Today's Classes</h2>
${briefing.todaysClasses.length === 0
  ? '<p>No classes today — studio/reading day.</p>'
  : `<ul>${briefing.todaysClasses.map(c =>
    `<li>${c.emoji} <strong>${c.code}: ${c.name}</strong><br>🕐 ${c.time} · 📍 ${c.room}</li>`
  ).join('')}</ul>`
}

<h2>🚨 Due Today</h2>
${briefing.dueToday.length === 0
  ? '<p>Nothing due today — stay ahead.</p>'
  : `<ul>${briefing.dueToday.map(taskRow).join('')}</ul>`
}

<h2>📅 Next 3 Days</h2>
${briefing.dueNext3.length === 0
  ? '<p>Nothing due in the next 3 days.</p>'
  : `<ul>${briefing.dueNext3.map(t => `<li><strong>${formatDisplayDate(t.dueDate)}</strong> — ${t.task} | ${t.course || ''}${t.zeroLatePolicy ? ' <span class="urgent">🚨</span>' : ''}</li>`).join('')}</ul>`
}

<h2>📖 Today's Reading / Watching</h2>
${briefing.dailyReading ? (() => {
  const r = briefing.dailyReading;
  return `<ul><li><strong>${r.title}</strong>${r.author ? ` by ${r.author}` : ''}<br>
    ${r.url ? `🔗 <a href="${r.url}">${r.url}</a><br>` : ''}
    ⏱ ${r.estimatedMinutes} min${r.context ? `<br><em>${r.context}</em>` : ''}
    ${r.daysUntilDue !== undefined ? `<br>⏰ Due in ${r.daysUntilDue} day(s)` : ''}</li></ul>`;
})() : '<p>No specific reading assigned.</p>'}

<h2>🎯 Upcoming Critiques & Studio Prep</h2>
${briefing.upcomingCritiques.length === 0
  ? '<p>No critiques or major projects due within 7 days.</p>'
  : `<ul>${briefing.upcomingCritiques.map(t =>
    `<li><strong>${t.task}</strong> | Due ${formatDisplayDate(t.dueDate)}${t.zeroLatePolicy ? ' 🚨' : ''}${t.quickNotes ? `<br><small>📌 ${t.quickNotes}</small>` : ''}</li>`
  ).join('')}</ul>`
}

${briefing.showVideoEssay ? `
<div class="warning">
  🎬 <strong>Video Essay Reminder (PHOT 215 — 40% of grade)</strong><br>
  Script Draft due ~Week 6 (Class 11) · Storyboard due ~Class 14.
</div>` : ''}

<h2>🎟️ ELO Status</h2>
<ul>
${briefing.eloStatus.map(e =>
  `<li><strong>${e.code}</strong>: ${e.completed}/${e.required} completed${e.urgent ? ' <span class="urgent">🚨 URGENT</span>' : ''}</li>`
).join('')}
</ul>

${briefing.documentaryFlags.length > 0 ? `
<h2>🎞️ Strategic Flag — Documentary Alignment</h2>
<ul>${briefing.documentaryFlags.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}

${briefing.notionEmpty ? `<div class="warning">⚠️ No deadlines found in Notion — verify database sync.</div>` : ''}

<div class="footer">Strategy with soul. Foundation before aesthetics.</div>
</body>
</html>`;

  return html;
}

module.exports = {
  buildBriefing,
  formatTerminalBriefing,
  buildNotificationSummary,
  buildEmailHTML,
};
