import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = process.env.NODE_ENV !== "production";
const isReplit = typeof process.env.REPL_ID === "string" && process.env.REPL_ID.length > 0;

// PORT is only required when running the dev / preview server.
// `vite build` (static build for Hostinger) does not need PORT.
const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;
if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// BASE_PATH defaults to "/" which is correct for a Hostinger root deployment.
const basePath = process.env.BASE_PATH ?? "/";
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ||
  process.env.API_PROXY_TARGET ||
  `http://localhost:${process.env.API_PORT || 3000}`;

// Replit-specific plugins — only loaded when running inside Replit.
// On Windows local dev these imports are skipped entirely to avoid
// platform-specific resolution errors.
async function getReplitPlugins() {
  if (!isDev || !isReplit) return [];
  try {
    const [cartographerMod, devBannerMod, runtimeErrorMod] = await Promise.all([
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
      import("@replit/vite-plugin-runtime-error-modal"),
    ]);
    return [
      runtimeErrorMod.default(),
      cartographerMod.cartographer({
        root: path.resolve(__dirname, ".."),
      }),
      devBannerMod.devBanner(),
    ];
  } catch {
    return [];
  }
}

function caseInsensitiveUiPlugin() {
  const lowercaseUi = new Set([
    "button", "card", "badge", "tabs", "toast", "input", "skeleton", "tooltip", "avatar", "dialog", "sheet"
  ]);

  return {
    name: "case-insensitive-ui-resolver",
    resolveId(source: string) {
      const match = source.match(/(?:^|[/\\])(?:components[/\\]ui|ui)[/\\]([A-Za-z0-9_-]+)$/);
      if (match) {
        const componentName = match[1];
        const lower = componentName.toLowerCase();
        if (lowercaseUi.has(lower) && componentName !== lower) {
          return path.resolve(__dirname, `src/components/ui/${lower}.tsx`);
        }
      }
      return null;
    },
  };
}

export default defineConfig(async () => {
  const replitPlugins = await getReplitPlugins();

  return {
    base: basePath,
    plugins: [
      caseInsensitiveUiPlugin(),
      react(),
      tailwindcss(),
      ...replitPlugins,
    ],
    resolve: {
      alias: [
        { find: "@/components/ui/Button", replacement: path.resolve(__dirname, "src/components/ui/button.tsx") },
        { find: "@/components/ui/Card", replacement: path.resolve(__dirname, "src/components/ui/card.tsx") },
        { find: "@/components/ui/Badge", replacement: path.resolve(__dirname, "src/components/ui/badge.tsx") },
        { find: "@/components/ui/Tabs", replacement: path.resolve(__dirname, "src/components/ui/tabs.tsx") },
        { find: "@/components/ui/Toast", replacement: path.resolve(__dirname, "src/components/ui/toast.tsx") },
        { find: "@/components/ui/Input", replacement: path.resolve(__dirname, "src/components/ui/input.tsx") },
        { find: "@/components/ui/Skeleton", replacement: path.resolve(__dirname, "src/components/ui/skeleton.tsx") },
        { find: "@/components/ui/Tooltip", replacement: path.resolve(__dirname, "src/components/ui/tooltip.tsx") },
        { find: "@/components/ui/Avatar", replacement: path.resolve(__dirname, "src/components/ui/avatar.tsx") },
        { find: "@", replacement: path.resolve(__dirname, "src") },
        { find: "@assets", replacement: path.resolve(__dirname, "attached_assets") },
      ],
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(__dirname),
    build: {
      target: "es2022",
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Core React — always needed, smallest possible initial bundle
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
              return "vendor-react";
            }
            // Router — tiny, keep with react
            if (id.includes("node_modules/wouter")) {
              return "vendor-router";
            }
            // Firebase — large SDK, lazy-loaded only by authenticated features
            // Split into separate chunks so public landing page doesn't pay the cost
            if (id.includes("node_modules/firebase/firestore") || id.includes("node_modules/@firebase/firestore")) {
              return "vendor-firebase-firestore";
            }
            if (id.includes("node_modules/firebase/database") || id.includes("node_modules/@firebase/database")) {
              return "vendor-firebase-rtdb";
            }
            if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
              return "vendor-firebase-core";
            }
            // Icons — used throughout, but large enough to split
            if (id.includes("node_modules/lucide-react")) {
              return "vendor-icons";
            }
            // Charts — only analytics pages use recharts, defer it
            if (id.includes("node_modules/recharts")) {
              return "vendor-charts";
            }
            // Radix UI — large component library, separate chunk
            if (id.includes("node_modules/@radix-ui")) {
              return "vendor-radix";
            }
            // Heavy data files — isolate so landing page doesn't pay for package catalogs
            if (id.includes("src/data/packagesData") || id.includes("src\\data\\packagesData")) {
              return "data-packages";
            }
            if (id.includes("src/data/adsData") || id.includes("src\\data\\adsData")) {
              return "data-ads";
            }
            if (id.includes("src/data/superAdminData") || id.includes("src\\data\\superAdminData")) {
              return "data-superadmin";
            }
          },
        },
      },
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
