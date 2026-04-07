# 🎓 Dr. Sallah Education Platform — Backend API

A production-ready Node.js + Express + MongoDB backend for the Dr. Sallah Education Platform featuring JWT authentication, device binding, DRM video streaming, AI-based anti-piracy, subscriptions, and full admin dashboard APIs.

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Edit `.env` with your settings:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/drsallah
JWT_SECRET=your_super_secret_jwt_key
JWT_REFRESH_SECRET=your_refresh_secret
SIGNED_URL_SECRET=your_signed_url_secret
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
```

### 3. Seed database (creates admin + default plans)
```bash
npm run seed
```
> Admin credentials: `admin@drsallah.com` / `Admin@12345`

### 4. Run the server
```bash
npm run dev        # Development (with nodemon)
npm start          # Production
```

### 5. Open API Docs (Scalar)
```
http://localhost:5000/api-docs
```

---

## 🐳 Docker (Recommended)

```bash
# Start everything (API + MongoDB + Mongo Express UI)
docker-compose up -d

# Seed the DB
docker exec drsallah-api node seed.js

# Mongo Express UI
http://localhost:8081  (admin / admin123)
```

---

## 📁 Project Structure

```
dr-sallah-backend/
├── server.js                    # Entry point
├── seed.js                      # DB seeder (admin + plans)
├── .env                         # Environment variables
├── Dockerfile
├── docker-compose.yml
└── src/
    ├── app.js                   # Express app + middleware + routes
    ├── config/
    │   ├── db.js                # MongoDB connection
    │   └── swagger.js           # OpenAPI / Scalar config
    ├── models/
    │   ├── User.js              # User + device binding + risk scoring
    │   ├── Content.js           # Course → Module → Lesson
    │   ├── Subscription.js      # Plans + User subscriptions
    │   ├── SecurityLog.js       # All security/activity events
    │   └── Notification.js      # Push notifications
    ├── controllers/
    │   ├── authController.js    # Register/Login/OTP/Refresh/Logout/Device reset
    │   ├── contentController.js # Courses/Modules/Lessons/Stream/Piracy events
    │   ├── subscriptionController.js
    │   ├── adminController.js   # Full admin panel APIs
    │   └── notificationController.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── contentRoutes.js
    │   ├── subscriptionRoutes.js
    │   ├── adminRoutes.js
    │   └── notificationRoutes.js
    ├── middleware/
    │   ├── auth.js              # JWT protect + adminOnly + requireSubscription
    │   └── errorHandler.js      # Global error handler
    └── services/
        ├── tokenService.js      # JWT generate/verify
        ├── otpService.js        # OTP generate/expiry
        ├── emailService.js      # Nodemailer (OTP + security alerts)
        ├── signedUrlService.js  # HMAC signed video URLs
        ├── antiPiracyService.js # AI risk scoring + behavior analysis
        └── scheduledJobs.js     # Cron: subscription expiry checks
```

---

## 🔐 Authentication Flow

```
Register → OTP Email → Verify OTP → Login (with deviceId) → Access Token (15m) + Refresh Token (7d)
                                         ↓
                               Device Binding (1 account = 1 device)
                                         ↓
                               Token Refresh (rotation) → New Access + Refresh Token
```

**Headers required:**
```
Authorization: Bearer <accessToken>
x-device-id:   <unique_device_fingerprint>
```

---

## 📡 API Endpoints

### Auth (`/api/v1/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register new student |
| POST | `/verify-otp` | ❌ | Verify email OTP |
| POST | `/login` | ❌ | Login + device binding |
| POST | `/refresh` | ❌ | Refresh access token |
| POST | `/logout` | ✅ | Logout + revoke token |
| POST | `/forgot-password` | ❌ | Send reset OTP |
| POST | `/reset-password` | ❌ | Reset with OTP |
| GET | `/me` | ✅ | Get own profile |
| POST | `/reset-device/:userId` | ✅ Admin | Reset device binding |

### Content (`/api/v1`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/courses` | ✅ | List all courses |
| POST | `/courses` | ✅ Admin | Create course |
| GET | `/courses/:id` | ✅ | Course + modules |
| PUT | `/courses/:id` | ✅ Admin | Update course |
| DELETE | `/courses/:id` | ✅ Admin | Delete course |
| GET | `/courses/:id/modules` | ✅ | List modules |
| POST | `/courses/:id/modules` | ✅ Admin | Create module |
| PUT | `/modules/:id` | ✅ Admin | Update module |
| DELETE | `/modules/:id` | ✅ Admin | Delete module |
| GET | `/modules/:id/lessons` | ✅ | List lessons |
| POST | `/modules/:id/lessons` | ✅ Admin | Create lesson |
| PUT | `/lessons/:id` | ✅ Admin | Update lesson |
| DELETE | `/lessons/:id` | ✅ Admin | Delete lesson |
| GET | `/lessons/:id/stream` | ✅ + Sub | Get signed stream URL |
| POST | `/security/event` | ✅ | Report screen record / screenshot |
| GET | `/watch-history` | ✅ | Get watch history |
| POST | `/watch-history` | ✅ | Update watch progress |
| POST | `/bookmarks/:lessonId` | ✅ | Toggle bookmark |

### Subscriptions (`/api/v1`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/plans` | ❌ | List active plans |
| POST | `/plans` | ✅ Admin | Create plan |
| PUT | `/plans/:id` | ✅ Admin | Update plan |
| DELETE | `/plans/:id` | ✅ Admin | Deactivate plan |
| POST | `/subscriptions` | ✅ | Subscribe to plan |
| GET | `/subscriptions/my` | ✅ | My active subscription |
| POST | `/subscriptions/cancel` | ✅ | Cancel subscription |
| GET | `/admin/subscriptions` | ✅ Admin | All subscriptions |
| GET | `/admin/revenue` | ✅ Admin | Revenue analytics |

### Admin (`/api/v1/admin`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Overview stats |
| GET | `/analytics/users` | User growth by month |
| GET | `/analytics/videos` | Playback analytics |
| GET | `/users` | All users (search/filter) |
| GET | `/users/:id` | User + security logs |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
| POST | `/users/:id/suspend` | Suspend user |
| POST | `/users/:id/unsuspend` | Unsuspend + reset risk |
| POST | `/users/:id/force-logout` | Revoke all sessions |
| GET | `/security/logs` | Security event logs |
| POST | `/security/logs/:id/resolve` | Resolve a log |
| GET | `/security/flagged-users` | Flagged users by risk score |
| POST | `/notifications/broadcast` | Send bulk notification |

### Notifications (`/api/v1/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | My notifications |
| POST | `/read-all` | Mark all read |
| POST | `/:id/read` | Mark one read |

---

## 🛡️ Security Features

- **JWT Access Token** (15 min) + **Refresh Token** (7 days, rotated)
- **Device Binding** — 1 account locked to 1 device fingerprint
- **OTP Email Verification** — 6-digit, 5-minute expiry
- **Rate Limiting** — 200 req/15min global, 20 req/15min auth
- **Anti-Piracy AI** — Risk scoring (0–100), auto-flag at 60, auto-suspend at 85
- **Signed Video URLs** — HMAC-SHA256, time-limited, user-bound
- **Security Logs** — Every event tracked (login, playback, piracy, device, etc.)
- **Automated Suspension** — Session terminated on suspicious behavior
- **Subscription Guard** — Video access only with active subscription

---

## 🔧 Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Access token secret |
| `JWT_EXPIRES_IN` | Access token expiry (default: 15m) |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry (default: 7d) |
| `SIGNED_URL_SECRET` | HMAC secret for video signed URLs |
| `SIGNED_URL_EXPIRY` | Signed URL TTL in seconds (default: 3600) |
| `EMAIL_HOST` | SMTP host |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `EMAIL_FROM` | Sender display name + email |
| `CLIENT_URL` | Frontend URL for CORS |

---

## 🚀 Production Deployment (AWS)

1. Set `NODE_ENV=production` in environment
2. Use strong secrets for all `*_SECRET` variables
3. Use MongoDB Atlas for managed DB
4. Put behind Nginx reverse proxy with SSL
5. Use PM2 for process management: `pm2 start server.js --name drsallah-api`

---

Built with ❤️ for Dr. Sallah Education Platform By Aakash singh