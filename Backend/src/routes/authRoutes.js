const express = require('express');
const router = express.Router();
const {
  register, verifyOTP, login, refreshToken, logout,
  forgotPassword, resetPassword, getMe, updateProfile,
  resendOTP, getRegistrationStatus, sendLoginOTP, verifyLoginOTP,
  resetDevice, deleteAccount,
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');

/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: Authentication & Device Management
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new student account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: Aakash Singh }
 *               email: { type: string, example: aakashsinghsisgain@gmail.com }
 *               phone: { type: string, example: "+966500000000" }
 *               password: { type: string, minLength: 6, example: Secret123 }
 *     responses:
 *       201:
 *         description: Registration successful, OTP sent to email
 *       400:
 *         description: Email already registered
 */
router.post('/register', register);

/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify email OTP after registration
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, otp]
 *             properties:
 *               userId: { type: string }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', verifyOTP);

/**
 * @openapi
 * /auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend email verification OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               userId: { type: string }
 *     responses:
 *       200:
 *         description: OTP resent with registeredAt and otpExpiresAt
 *       400:
 *         description: Already verified or registration expired
 */
router.post('/resend-otp', resendOTP);

/**
 * @openapi
 * /auth/registration-status:
 *   get:
 *     tags: [Auth]
 *     summary: Check registration / verification status by email
 *     security: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Registration status including registeredAt, otpExpiresAt, canResendOtp
 *   post:
 *     tags: [Auth]
 *     summary: Check registration / verification status by email (POST)
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Registration status
 */
router.get('/registration-status', getRegistrationStatus);
router.post('/registration-status', getRegistrationStatus);

/**
 * @openapi
 * /auth/login-otp/send:
 *   post:
 *     tags: [Auth]
 *     summary: Send login OTP to email (passwordless login step 1)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Login code sent
 */
router.post('/login-otp/send', sendLoginOTP);

/**
 * @openapi
 * /auth/login-otp/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify login OTP and get tokens (passwordless login step 2)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               userId: { type: string }
 *               email: { type: string }
 *               otp: { type: string }
 *               deviceId: { type: string }
 *               deviceName: { type: string }
 *     responses:
 *       200:
 *         description: Login successful with tokens
 */
router.post('/login-otp/verify', verifyLoginOTP);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email & password (device binding enforced)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               deviceId: { type: string, description: Unique device fingerprint }
 *               deviceName: { type: string, example: iPhone 15 }
 *     responses:
 *       200:
 *         description: Login successful with accessToken & refreshToken
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account bound to another device or suspended
 */
router.post('/login', login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Get new access token using refresh token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New access & refresh tokens
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', refreshToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke refresh token
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', protect, logout);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: OTP sent if email exists
 */
router.post('/forgot-password', forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using OTP
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, otp, newPassword]
 *             properties:
 *               userId: { type: string }
 *               otp: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post('/reset-password', resetPassword);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current logged-in user profile
 *     responses:
 *       200:
 *         description: User profile with subscription info
 */
router.get('/me', protect, getMe);

/**
 * @openapi
 * /auth/me:
 *   patch:
 *     tags: [Auth]
 *     summary: Update current user profile
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               currentPassword: { type: string, description: Required when changing password }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Current password incorrect
 */
router.patch('/me', protect, updateProfile);

/**
 * @openapi
 * /auth/deleteAccount:
 *   delete:
 *     tags: [Auth]
 *     summary: Delete your own account (self-service)
 *     description: |
 *       Permanently removes all personal information from the account (name, email, phone, password,
 *       device binding, watch history, bookmarks, sessions, and notifications).
 *       Security and activity logs are retained in the admin panel for audit purposes.
 *       The original email is freed so you can register a new account with the same email.
 *       Requires a valid access token only — no password needed.
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *       400:
 *         description: Account already deleted
 *       403:
 *         description: Admin accounts cannot be self-deleted
 */
router.delete('/deleteAccount', protect, deleteAccount);

/**
 * @openapi
 * /auth/reset-device/{userId}:
 *   post:
 *     tags: [Auth]
 *     summary: Admin - Reset user's device binding
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Device binding reset
 */
router.post('/reset-device/:userId', protect, adminOnly, resetDevice);

module.exports = router;