'use strict';

const { Client } = require('@notionhq/client');
const { saveCache, loadCache, logError } = require('./cache');

let notionClient = null;

function getClient(apiKey) {
  if (!notionClient) {
    notionClient = new Client({ auth: apiKey });
  }
  return notionClient;
}

/**
 * Extract plain text from a Notion rich text array
 */
function richText(arr) {
  if (!arr || !Array.isArray(arr)) return '';
  return arr.map(r => r.plain_text || '').join('');
}

/**
 * Extract a property value safely from a Notion page
 */
function extractProperty(page, propName) {
  const prop = page.properties?.[propName];
  if (!prop) return null;

  switch (prop.type) {
    case 'title':
      return richText(prop.title);
    case 'rich_text':
      return richText(prop.rich_text);
    case 'select':
      return prop.select?.name || null;
    case 'multi_select':
      return (prop.multi_select || []).map(s => s.name);
    case 'date':
      return prop.date?.start || null;
    case 'checkbox':
      return prop.checkbox === true;
    case 'number':
      return prop.number;
    case 'url':
      return prop.url || null;
    case 'email':
      return prop.email || null;
    case 'phone_number':
      return prop.phone_number || null;
    default:
      return null;
  }
}

/**
 * Normalize a raw Notion page into a clean task object
 */
function normalizePage(page) {
  return {
    id: page.id,
    task: extractProperty(page, 'Task') || extractProperty(page, 'Name') || '(Untitled)',
    course: extractProperty(page, 'Course'),
    dueDate: extractProperty(page, 'Due Date'),
    type: extractProperty(page, 'Type'),
    status: extractProperty(page, 'Status'),
    urgency: extractProperty(page, 'Urgency'),
    weight: extractProperty(page, 'Weight'),
    zeroLatePolicy: extractProperty(page, 'Zero Late Policy') || false,
    passFail: extractProperty(page, 'Pass / Fail') || false,
    timeEst: extractProperty(page, 'Time Est (hrs)'),
    quickNotes: extractProperty(page, 'Quick Notes'),
    url: page.url || null,
  };
}

/**
 * Query all tasks from the Notion database.
 * Falls back to cache on API failure.
 */
async function fetchAllTasks(config) {
  const notion = getClient(config.notionApiKey);
  const allPages = [];

  try {
    let cursor = undefined;
    do {
      const response = await notion.databases.query({
        database_id: config.notionDatabaseId,
        start_cursor: cursor,
        page_size: 100,
      });

      allPages.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    const tasks = allPages.map(normalizePage);
    saveCache(tasks);
    return { tasks, fromCache: false };
  } catch (err) {
    logError('Notion API error — falling back to cache', err);

    const cached = loadCache();
    if (cached && cached.data) {
      console.warn(`⚠️  Using cached data from ${cached.savedAt}`);
      return { tasks: cached.data, fromCache: true, cachedAt: cached.savedAt };
    }

    logError('No cache available — no data to display', null);
    return { tasks: [], fromCache: false, error: err.message };
  }
}

/**
 * Filter tasks relevant to a given date range.
 * @param {Array} tasks
 * @param {string} fromDate - ISO date string (inclusive)
 * @param {string} toDate   - ISO date string (inclusive)
 */
function filterByDateRange(tasks, fromDate, toDate) {
  return tasks.filter(t => {
    if (!t.dueDate) return false;
    return t.dueDate >= fromDate && t.dueDate <= toDate;
  });
}

/**
 * Filter out completed/submitted tasks
 */
function filterIncomplete(tasks) {
  return tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return !s.includes('done') && !s.includes('submitted');
  });
}

module.exports = { fetchAllTasks, filterByDateRange, filterIncomplete };
