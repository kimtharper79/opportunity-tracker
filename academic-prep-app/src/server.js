'use strict';

const express = require('express');
const path = require('path');
const { getAllTasks, addTask, updateTask, deleteTask, markDone, markNotStarted } = require('./tasks');
const { buildBriefing, formatTerminalBriefing } = require('./briefing');

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// ─── API: Tasks ───────────────────────────────────────────────────────────────

app.get('/api/tasks', (req, res) => {
  res.json(getAllTasks());
});

app.post('/api/tasks', (req, res) => {
  const task = addTask(req.body);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const updated = updateTask(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
});

app.delete('/api/tasks/:id', (req, res) => {
  const ok = deleteTask(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Task not found' });
  res.json({ ok: true });
});

app.post('/api/tasks/:id/done', (req, res) => {
  const updated = markDone(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
});

app.post('/api/tasks/:id/undone', (req, res) => {
  const updated = markNotStarted(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
});

// ─── API: Briefing ────────────────────────────────────────────────────────────

app.get('/api/briefing', (req, res) => {
  const tasks = getAllTasks();
  const briefing = buildBriefing(tasks, new Date());
  res.json(briefing);
});

// ─── Start ────────────────────────────────────────────────────────────────────

function startServer(port = 3000) {
  app.listen(port, () => {
    console.log(`\n🌐 Academic Prep App running at http://localhost:${port}`);
    console.log('   Open that URL in your browser to manage tasks.\n');
  });
}

module.exports = { startServer };
