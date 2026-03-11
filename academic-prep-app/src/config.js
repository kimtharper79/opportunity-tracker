'use strict';

const path = require('path');
const fs = require('fs');

// Load .env from the app root directory (optional — only needed for email)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

function validateConfig() {
  const notificationTime = process.env.NOTIFICATION_TIME || '07:30';
  const timeParts = notificationTime.split(':');
  if (timeParts.length !== 2 || isNaN(timeParts[0]) || isNaN(timeParts[1])) {
    console.error(`❌ Invalid NOTIFICATION_TIME format: "${notificationTime}". Expected HH:MM (24-hour).`);
    process.exit(1);
  }

  return {
    notificationTime,
    notificationHour: parseInt(timeParts[0], 10),
    notificationMinute: parseInt(timeParts[1], 10),
    userEmail: process.env.USER_EMAIL || null,
    smtp: {
      host: process.env.SMTP_HOST || null,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || null,
      pass: process.env.SMTP_PASS || null,
    },
    emailEnabled: !!(
      process.env.USER_EMAIL &&
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ),
  };
}

module.exports = { validateConfig };
