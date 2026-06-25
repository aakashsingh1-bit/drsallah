const crypto = require('crypto');
const nodemailer = require('nodemailer');

const getSmtpConfig = () => {
  const authUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const fromEmail = process.env.SMTP_USER_EMAIL;

  return {
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST,
    port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT, 10) || 587,
    // SMTP login — SMTP2GO uses account username (e.g. sisgain); cPanel uses full email
    user: authUser,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    fromEmail: fromEmail || authUser,
    fromName: process.env.SMTP_FROM_NAME || 'Dr. Sallah Platform',
    replyTo: process.env.EMAIL_REPLY_TO || fromEmail || authUser,
  };
};

const getFromAddress = () => {
  const { fromEmail, fromName } = getSmtpConfig();

  // SMTP2GO requires From to be a verified sender — never use legacy Gmail EMAIL_FROM
  if (process.env.SMTP_USER_EMAIL) {
    return `${fromName} <${process.env.SMTP_USER_EMAIL}>`;
  }

  const explicitFrom = process.env.EMAIL_FROM;
  if (explicitFrom) return explicitFrom;
  if (!fromEmail) return fromName;
  if (fromEmail.includes('<')) return fromEmail;

  return `${fromName} <${fromEmail}>`;
};

const getReplyTo = () => getSmtpConfig().replyTo;

const getMessageDomain = () => {
  const { fromEmail } = getSmtpConfig();
  const email = fromEmail || 'drsallah.com';
  return email.includes('@') ? email.split('@')[1] : email;
};

const createTransport = () => {
  const { host, port, user, pass } = getSmtpConfig();

  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
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
  try {
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
  } catch (err) {
    const { host, port, user } = getSmtpConfig();
    console.error(`Email send failed [${host}:${port} user=${user}]:`, err.message);
    throw err;
  }
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
