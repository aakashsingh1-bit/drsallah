const crypto = require('crypto');
const nodemailer = require('nodemailer');

const getFromAddress = () => {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const user = process.env.EMAIL_USER;
  // Gmail SMTP requires From to match the authenticated account (or an alias).
  if (user && from && !from.includes(user)) {
    const name = (from.match(/^(.+)</) || [])[1]?.trim() || 'Dr. Sallah Platform';
    return `${name} <${user}>`;
  }
  return from;
};

const getReplyTo = () => process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER;

const getMessageDomain = () => {
  const email = process.env.EMAIL_USER || 'drsallah.com';
  return email.includes('@') ? email.split('@')[1] : 'drsallah.com';
};

const createTransport = () => {
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });
};

const buildEmailHeaders = () => ({
  'Message-ID': `<${crypto.randomUUID()}@${getMessageDomain()}>`,
  'Reply-To': getReplyTo(),
  'X-Mailer': 'Dr-Sallah-Platform',
});

const wrapEmailHtml = ({ title, bodyHtml, footerNote }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#1a237e;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:bold;">
              Dr. Sallah Education Platform
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;font-size:12px;line-height:1.5;color:#6b7280;">
              ${footerNote || 'This is an automated message from Dr. Sallah Education Platform. Please do not reply to this email.'}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = createTransport();
  const info = await transporter.sendMail({
    from: getFromAddress(),
    to,
    replyTo: getReplyTo(),
    subject,
    text,
    html,
    headers: buildEmailHeaders(),
  });
  return info;
};

const sendOTPEmail = async (email, otp, type = 'verify') => {
  const subjects = {
    verify: 'Your Dr. Sallah verification code',
    password_reset: 'Your Dr. Sallah password reset code',
  };
  const subject = subjects[type] || subjects.verify;
  const purpose = type === 'password_reset' ? 'reset your password' : 'verify your email address';

  const text = [
    'Dr. Sallah Education Platform',
    '',
    `Use this code to ${purpose}:`,
    '',
    otp,
    '',
    'This code expires in 5 minutes.',
    '',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');

  const html = wrapEmailHtml({
    title: subject,
    bodyHtml: `
      <p>Hello,</p>
      <p>Use the verification code below to ${purpose}:</p>
      <p style="margin:24px 0;font-size:32px;font-weight:bold;letter-spacing:6px;color:#1a237e;">${otp}</p>
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });

  return sendEmail({ to: email, subject, text, html });
};

const sendSecurityAlertEmail = async (email, details) => {
  const subject = 'Security alert on your Dr. Sallah account';
  const text = [
    'Dr. Sallah Education Platform',
    '',
    'Security Alert',
    '',
    details.message,
    '',
    `Time: ${new Date().toLocaleString()}`,
    `IP: ${details.ip || 'Unknown'}`,
    '',
    'If this was not you, please contact support immediately.',
  ].join('\n');

  const html = wrapEmailHtml({
    title: subject,
    bodyHtml: `
      <p><strong>Security Alert</strong></p>
      <p>${details.message}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>IP:</strong> ${details.ip || 'Unknown'}</p>
      <p>If this was not you, please contact support immediately.</p>
    `,
    footerNote: 'This security notification was sent because activity was detected on your Dr. Sallah account.',
  });

  return sendEmail({ to: email, subject, text, html });
};

module.exports = { sendEmail, sendOTPEmail, sendSecurityAlertEmail };
