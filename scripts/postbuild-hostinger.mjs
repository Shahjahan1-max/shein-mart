import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const publicBuildDir = path.join(distDir, "public");

if (!fs.existsSync(path.join(publicBuildDir, "index.html"))) {
  console.warn(`[postbuild] Missing ${path.join(publicBuildDir, "index.html")}; skipping Hostinger static fallback copy.`);
  process.exit(0);
}

for (const entry of fs.readdirSync(publicBuildDir)) {
  const src = path.join(publicBuildDir, entry);
  const dest = path.join(distDir, entry);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

console.log("[postbuild] Copied dist/public to dist for Hostinger output-directory compatibility.");

for (const serverOnlyEntry of ["app.js", "server.js", "index.js", "db.js", "package.json", "server"]) {
  fs.rmSync(path.join(distDir, serverOnlyEntry), { recursive: true, force: true });
}
console.log("[postbuild] Removed stale backend files from frontend dist.");

// Hostinger deployments are often pointed at either dist or dist/public.
// Keep both roots ready for SPA fallback while letting /api/* reach the Node app.
const htaccessContent = `# SPA (React) routing
# Rewrites all non-file, non-directory requests to index.html so React Router
# (Wouter) can handle them client-side. Required on every Hostinger Apache host.
# /api/* routes are excluded so Node.js server handles them directly.
Options -MultiViews
RewriteEngine On
RewriteBase /

# Do NOT rewrite /api/* - let Node.js handle these.
RewriteRule ^api/ - [L]

# Never serve local secrets or server-only files from static hosting.
<FilesMatch "^(\\.env|.*\\.pem|.*\\.key|.*serviceAccount.*\\.json)$">
  Require all denied
</FilesMatch>

# ── High-Performance Caching & HTTP Headers ──
<IfModule mod_headers.c>
  # 1 Year Immutable Cache for Vite fingerprinted assets (JS, CSS, fonts, images)
  <FilesMatch "\\.(js|css|woff2|woff|ttf|eot|png|jpg|jpeg|webp|svg|gif|ico)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>

  # HTML documents: must revalidate to load updated bundles immediately
  <FilesMatch "\\.(html|htm)$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>

  # Security headers
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>

# Browser caching fallback with mod_expires
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresDefault "access plus 1 month"
  ExpiresByType text/html                 "access plus 0 seconds"
  ExpiresByType image/jpeg                "access plus 1 year"
  ExpiresByType image/png                 "access plus 1 year"
  ExpiresByType image/webp                "access plus 1 year"
  ExpiresByType image/svg+xml             "access plus 1 year"
  ExpiresByType image/gif                 "access plus 1 year"
  ExpiresByType image/x-icon              "access plus 1 year"
  ExpiresByType text/css                  "access plus 1 year"
  ExpiresByType application/javascript    "access plus 1 year"
  ExpiresByType font/woff2                "access plus 1 year"
  ExpiresByType font/woff                 "access plus 1 year"
  ExpiresByType application/json          "access plus 0 seconds"
</IfModule>

# Gzip and Brotli compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
  AddOutputFilterByType DEFLATE application/javascript application/x-javascript application/json
  AddOutputFilterByType DEFLATE image/svg+xml font/woff font/woff2 application/vnd.ms-fontobject
</IfModule>

# Fallback to index.html for SPA client-side routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [QSA,L]
`;

fs.writeFileSync(path.join(distDir, ".htaccess"), htaccessContent, "utf8");
fs.writeFileSync(path.join(publicBuildDir, ".htaccess"), htaccessContent, "utf8");
console.log("[postbuild] Wrote high-performance .htaccess with immutable caching and /api/ exclusion.");
