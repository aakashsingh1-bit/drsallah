const express = require('express');
const router = express.Router();
const {
  register, verifyOTP, login, refreshToken, logout,
  forgotPassword, resetPassword, getMe, resetDevice,
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