# 🛡️ DealXStocks Backend — Node.js & Firebase API Engine

Enterprise Node.js server powered by **Firebase Admin SDK**, supporting REST endpoints, WebSockets, and Vercel serverless deployment.

---

## 🏗️ Backend Architecture

```
backend/
├── app.js                          # ESM App Entry Point
├── server.js                       # Server entry alias
├── db.js                           # Firebase Admin SDK & Firestore database connector
├── vercel.json                     # Serverless configuration for Vercel
├── firestore.rules                 # Firestore Security Rules
├── firestore.indexes.json          # Firestore Database Index definitions
│
├── api/                            # API Endpoint Routes
│   └── index.js                    # Core REST router (Auth, Users, Services, Quotes)
│
├── server/                         # Compiled Production Output
│   └── production-server.js        # Self-contained production bundle
│
└── scripts/                        # Database & Administrative Scripts
    ├── seed-admin-account.mjs      # Admin user initialization
    ├── seed-firebase.mjs           # Demo data seeder
    ├── import-adgroups.js          # Marketplace ad data importer
    └── build-package.mjs           # Production builder script
```

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Run development server
npm run dev

# Seed initial admin account
npm run seed:admin
```

---

## 🔐 Firebase Security & Credentials

Required Environment Variables (`.env`):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `ADMIN_SESSION_SECRET`
- `CORS_ORIGIN`

---

## 📦 Deployment (Vercel Serverless)

Deploy to Vercel via CLI:
```bash
vercel deploy --prod
```
