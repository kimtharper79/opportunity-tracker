'use strict';

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.resolve(__dirname, '..', 'data', 'cache.json');
const LOG_PATH = path.resolve(__dirname, '..', 'logs', 'errors.log');

function logError(message, error) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}${error ? ': ' + (error.message || error) : ''}\n`;
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch {
    // If we can't log, just console.error — never crash silently
    console.error('Failed to write to error log:', line);
  }
  console.error(line.trim());
}

function saveCache(data) {
  try {
    const payload = {
      savedAt: new Date().toISOString(),
      data,
    };
    fs.writeFileSync(CACHE_PATH, JSON.stringify(payload, null, 2));
  } catch (err) {
    logError('Failed to save cache', err);
  }
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = fs.readFileSync(CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    logError('Failed to load cache', err);
    return null;
  }
}

module.exports = { saveCache, loadCache, logError };
