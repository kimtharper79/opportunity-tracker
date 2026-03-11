'use strict';

const { logError } = require('./cache');

/**
 * Send a desktop notification using node-notifier.
 * Gracefully degrades if node-notifier is unavailable (e.g., no display).
 */
async function sendDesktopNotification(summary) {
  try {
    const notifier = require('node-notifier');
    notifier.notify({
      title: '📚 Academic Briefing',
      message: summary,
      sound: true,
      wait: false,
    });
    console.log('🔔 Desktop notification sent.');
  } catch (err) {
    logError('Desktop notification failed (non-fatal)', err);
    console.warn('⚠️  Desktop notification unavailable — check node-notifier installation.');
  }
}

/**
 * Send an HTML email via nodemailer.
 * Only runs if email is configured in .env.
 */
async function sendEmail(config, subject, htmlBody) {
  if (!config.emailEnabled) {
    return;
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });

    const info = await transporter.sendMail({
      from: `"Academic Briefing" <${config.smtp.user}>`,
      to: config.userEmail,
      subject,
      html: htmlBody,
    });

    console.log(`📧 Email sent: ${info.messageId}`);
  } catch (err) {
    logError('Email send failed', err);
    console.warn('⚠️  Email failed — check SMTP settings in .env');
  }
}

/**
 * Run all notification channels for the daily briefing.
 */
async function notify(config, terminalOutput, notificationSummary, emailHTML, today) {
  // Always print to terminal
  console.log(terminalOutput);

  // Desktop notification
  await sendDesktopNotification(notificationSummary);

  // Email (if configured)
  if (config.emailEnabled) {
    const dateStr = today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    await sendEmail(config, `📚 Daily Academic Briefing — ${dateStr}`, emailHTML);
  }
}

module.exports = { notify, sendDesktopNotification, sendEmail };
