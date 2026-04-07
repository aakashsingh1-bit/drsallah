const nodemailer = require('nodemailer');

const createTransport = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransport();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
  return info;
};

const sendOTPEmail = async (email, otp, type = 'verify') => {
  const subjects = {
    verify: 'Verify Your Email - Dr. Sallah Platform',
    password_reset: 'Password Reset OTP - Dr. Sallah Platform',
  };
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:8px">
      <h2 style="color:#1a237e">Dr. Sallah Education Platform</h2>
      <p>Your OTP code is:</p>
      <h1 style="letter-spacing:8px;color:#1a237e;font-size:40px">${otp}</h1>
      <p>This code expires in <strong>5 minutes</strong>.</p>
      <p style="color:#999;font-size:12px">If you did not request this, please ignore this email.</p>
    </div>
  `;
  return sendEmail({ to: email, subject: subjects[type] || subjects.verify, html });
};

const sendSecurityAlertEmail = async (email, details) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #eee;border-radius:8px">
      <h2 style="color:#c62828">⚠️ Security Alert - Dr. Sallah Platform</h2>
      <p>${details.message}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>IP:</strong> ${details.ip || 'Unknown'}</p>
      <p style="color:#999;font-size:12px">If this was not you, please contact support immediately.</p>
    </div>
  `;
  return sendEmail({ to: email, subject: '⚠️ Security Alert - Dr. Sallah Platform', html });
};

module.exports = { sendEmail, sendOTPEmail, sendSecurityAlertEmail };