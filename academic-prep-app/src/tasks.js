'use strict';

const fs = require('fs');
const path = require('path');

const TASKS_FILE = path.resolve(__dirname, '..', 'data', 'tasks.json');

function loadTasks() {
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, '[]', 'utf8');
  }
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
}

function saveTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function getAllTasks() {
  return loadTasks();
}

function addTask(taskData) {
  const tasks = loadTasks();
  const newTask = {
    id: `task-${Date.now()}`,
    task: taskData.task || '(Untitled)',
    course: taskData.course || null,
    dueDate: taskData.dueDate || null,
    type: taskData.type || null,
    status: '⬜ Not Started',
    weight: taskData.weight || null,
    zeroLatePolicy: taskData.zeroLatePolicy === true || taskData.zeroLatePolicy === 'true',
    passFail: taskData.passFail === true || taskData.passFail === 'true',
    timeEst: taskData.timeEst || null,
    quickNotes: taskData.quickNotes || null,
    url: taskData.url || null,
  };
  tasks.push(newTask);
  saveTasks(tasks);
  return newTask;
}

function updateTask(id, updates) {
  const tasks = loadTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...updates };
  saveTasks(tasks);
  return tasks[idx];
}

function deleteTask(id) {
  const tasks = loadTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  saveTasks(tasks);
  return true;
}

function markDone(id) {
  return updateTask(id, { status: '✅ Done' });
}

function markNotStarted(id) {
  return updateTask(id, { status: '⬜ Not Started' });
}

function filterByDateRange(tasks, fromDate, toDate) {
  return tasks.filter(t => {
    if (!t.dueDate) return false;
    return t.dueDate >= fromDate && t.dueDate <= toDate;
  });
}

function filterIncomplete(tasks) {
  return tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return !s.includes('done') && !s.includes('submitted');
  });
}

module.exports = {
  getAllTasks,
  addTask,
  updateTask,
  deleteTask,
  markDone,
  markNotStarted,
  filterByDateRange,
  filterIncomplete,
};
