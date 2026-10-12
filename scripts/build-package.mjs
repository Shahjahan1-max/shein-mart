import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "dist");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "server"), { recursive: true });

fs.cpSync(path.join(root, "server", "production-server.js"), path.join(outDir, "server", "production-server.js"), { force: true });
fs.cpSync(path.join(root, "db.js"), path.join(outDir, "db.js"), { force: true });
fs.cpSync(path.join(root, "app.js"), path.join(outDir, "app.js"), { force: true });

const packageJson = {
  name: "deal-stocks-api",
  version: "1.0.0",
  private: true,
  type: "module",
  scripts: {
    start: "node app.js",
  },
  dependencies: {
    cors: "^2.8.6",
    dotenv: "^16.4.7",
    "firebase-admin": "^13.10.0",
    ws: "^8.18.3",
  },
};

fs.writeFileSync(path.join(outDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
fs.writeFileSync(
  path.join(outDir, ".env.example"),
  `PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=https://dealxstocks.com,https://www.dealxstocks.com
ALLOW_DEMO_PASSWORD_RESET_LINKS=false

ADMIN_USERNAME=admin@dealxstocks.com
ADMIN_EMAIL=admin@dealxstocks.com
ADMIN_PASSWORD=change-this-password
ADMIN_FALLBACK_USERNAME=admin
ADMIN_FALLBACK_PASSWORD=change-this-password
ADMIN_SESSION_SECRET=generate-a-long-random-secret

FIREBASE_PROJECT_ID=dealxstocks
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@dealxstocks.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nREPLACE_WITH_NEW_ROTATED_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n"
FIREBASE_WEB_API_KEY=your-firebase-web-api-key
FIREBASE_STORAGE_BUCKET=dealxstocks.firebasestorage.app
`,
  "utf8",
);

console.log(`[backend] Wrote backend-only package to ${outDir}`);
