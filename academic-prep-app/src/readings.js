'use strict';

const path = require('path');
const readingsData = require(path.resolve(__dirname, '..', 'data', 'readings.json'));
const coursesData = require(path.resolve(__dirname, '..', 'data', 'courses.json'));

const QUARTER_START = new Date(coursesData.quarter.start);
const QUARTER_END = new Date(coursesData.quarter.end);

/**
 * Returns the current week number within the quarter (1-indexed).
 * Returns 0 if before quarter start, 11+ if after quarter end.
 */
function getQuarterWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(QUARTER_START);
  start.setHours(0, 0, 0, 0);
  const diffMs = d - start;
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * Get the day name for a given date
 */
function getDayName(date = new Date()) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

/**
 * Get the next upcoming PHOT 214 reading (Light, Science & Magic chapter)
 * based on upcoming hard deadlines, sorted by due date.
 */
function getNextPhot214Reading(today = new Date()) {
  const todayStr = today.toISOString().split('T')[0];
  const lsmReadings = readingsData.resources.filter(r =>
    r.course === 'PHOT 214' && r.type === 'book' && r.hardDeadline
  );
  // Find the soonest upcoming (not yet past)
  const upcoming = lsmReadings
    .filter(r => r.hardDeadline >= todayStr)
    .sort((a, b) => a.hardDeadline.localeCompare(b.hardDeadline));
  return upcoming[0] || null;
}

/**
 * Get a daily reading recommendation based on day of week and quarter week.
 * @param {Date} date
 * @returns {Object} resource object with added daysUntilDue if applicable
 */
function getDailyReading(date = new Date()) {
  const dayName = getDayName(date);
  const weekNum = getQuarterWeek(date);
  const rotation = readingsData.weeklyRotation[dayName];
  const todayStr = date.toISOString().split('T')[0];

  let targetCourse = rotation.course;

  // Tuesday & Thursday: prioritize the next LSM chapter due
  if (dayName === 'Tuesday' || dayName === 'Thursday') {
    const lsmReading = getNextPhot214Reading(date);
    if (lsmReading) {
      const dueDate = new Date(lsmReading.hardDeadline);
      const daysUntil = Math.ceil((dueDate - date) / (1000 * 60 * 60 * 24));
      return {
        ...lsmReading,
        dayFocus: rotation.focus,
        daysUntilDue: daysUntil,
        quarterWeek: weekNum,
      };
    }
  }

  // Weekend: rotate across all courses by week number
  if (dayName === 'Saturday' || dayName === 'Sunday') {
    const allCourses = ['PHOT 218', 'PHOT 214', 'PHOT 215', 'SFIN 220'];
    targetCourse = allCourses[(weekNum - 1) % 4];
  }

  // Find resources matching the target course and current week
  const candidates = readingsData.resources.filter(r => {
    if (r.course !== targetCourse) return false;
    if (r.weeks && !r.weeks.includes(weekNum)) return false;
    return true;
  });

  // Prefer items with critical/hardDeadline that haven't passed
  const critical = candidates.filter(r => r.critical && r.hardDeadline && r.hardDeadline >= todayStr);
  if (critical.length > 0) {
    const r = critical[0];
    const dueDate = new Date(r.hardDeadline);
    const daysUntil = Math.ceil((dueDate - date) / (1000 * 60 * 60 * 24));
    return { ...r, dayFocus: rotation.focus, daysUntilDue: daysUntil, quarterWeek: weekNum };
  }

  // Fall back to first matching candidate, or any resource from that course
  const fallback = candidates[0] || readingsData.resources.find(r => r.course === targetCourse);
  if (fallback) {
    return { ...fallback, dayFocus: rotation.focus, quarterWeek: weekNum };
  }

  return null;
}

/**
 * Check if any hard-coded deadlines are within N days
 */
function getUpcomingHardDeadlines(withinDays = 7, today = new Date()) {
  const todayStr = today.toISOString().split('T')[0];
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + withinDays);
  const futureStr = futureDate.toISOString().split('T')[0];

  return coursesData.hardCodedDeadlines.filter(d => {
    return d.dueDate >= todayStr && d.dueDate <= futureStr;
  });
}

/**
 * Get all hard-coded deadlines due today
 */
function getHardDeadlinesToday(today = new Date()) {
  const todayStr = today.toISOString().split('T')[0];
  return coursesData.hardCodedDeadlines.filter(d => d.dueDate === todayStr);
}

module.exports = {
  getDailyReading,
  getNextPhot214Reading,
  getUpcomingHardDeadlines,
  getHardDeadlinesToday,
  getQuarterWeek,
  getDayName,
};
