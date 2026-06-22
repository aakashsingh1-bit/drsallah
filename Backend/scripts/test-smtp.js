/**
 * Run on the server after updating .env:
 *   node scripts/test-smtp.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

const rawUser = process.env.SMTP_USER || '';
const user = rawUser.includes('@') ? rawUser.trim() : (process.env.SMTP_USER_EMAIL || rawUser).trim();
const pass = (process.env.SMTP_PASS || '').trim();
const host = (process.env.SMTP_HOST || '').trim();
const port = parseInt(process.env.SMTP_PORT, 10) || 465;

if (!host || !user || !pass) {
  console.error('Missing SMTP_HOST, SMTP_USER/SMTP_USER_EMAIL, or SMTP_PASS in .env');
  process.exit(1);
}

console.log('Testing SMTP...');
console.log(`  Host: ${host}:${port}`);
console.log(`  User: ${user}`);
console.log(`  Pass length: ${pass.length} chars`);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user, pass },
  tls: { rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false' },
});

transporter
  .verify()
  .then(() => {
    console.log('SUCCESS — SMTP login works.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('FAILED —', err.message);
    if (err.message.includes('535')) {
      console.error('\n535 = wrong password or email account does not exist.');
      console.error('Fix in cPanel → Email Accounts → support@drsallahalzait.me → Change Password');
      console.error('Then in .env use quotes if password has special chars: SMTP_PASS="Your@Password"');
    }
    process.exit(1);
  });
