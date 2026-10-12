/**
 * prerender-public.mjs — build-time static pre-render for the Vite SPA (Phase 4A).
 *
 * Runs after `vite build`. For every indexable public URL it writes a static
 * HTML file into dist/public/<path>/index.html (so Hostinger serves real
 * content + JSON-LD to crawlers and link-shares without executing JS), and
 * regenerates dist/public/sitemap.xml from the full URL set.
 *
 * The SPA shell is preserved (hashed CSS/JS assets + inline scripts) so the
 * page still hydrates into the interactive app on the client.
 */

import esbuild from "esbuild";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(__dirname, "..");
const distPublic = join(frontendRoot, "dist", "public");
const entry = join(frontendRoot, "src", "prerender", "publicPages.ts");
const cacheDir = join(frontendRoot, "node_modules", ".cache");
const outfile = join(cacheDir, "ds-prerender.mjs");

if (!existsSync(distPublic)) {
  console.error(`[prerender] dist/public not found. Run 'vite build' first.`);
  process.exit(1);
}

try {
  // Bundle the pure prerender engine (TS + JSON imports) into a runnable ESM file.
  mkdirSync(cacheDir, { recursive: true });
  esbuild.buildSync({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    logLevel: "silent",
  });

  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  const { buildPublicPages, pageToHeadHtml, pageToStaticBlockHtml, pagesToSitemap } = mod;

  const shell = readFileSync(join(distPublic, "index.html"), "utf8");
  if (!shell.includes('<div id="root">')) {
    console.warn(`[prerender] dist/public/index.html has no #root — skipping pre-render.`);
    process.exit(0);
  }

  // Preserve the built SPA's hashed asset tags (CSS + module JS) across the head swap.
  const assetTags = [
    ...shell.matchAll(/<script[^>]*>[\s\S]*?<\/script>|<(?:link)[^>]*\/?>/g),
  ]
    .map(match => match[0])
    .filter(tag => /\/assets\/[^"']+/i.test(tag)) ?? [];

  const pages = buildPublicPages();
  let written = 0;

  for (const page of pages) {
    const head = `  ${pageToHeadHtml(page)}\n  ${assetTags.join("\n  ")}`;
    const body = shell
      .replace(/<head>[\s\S]*?<\/head>/, `<head>\n${head}\n</head>`)
      .replace('<div id="root"></div>', `<div id="root"></div>\n  ${pageToStaticBlockHtml(page)}`);

    const rel = page.path === "/" ? "index.html" : join(page.path.replace(/^\//, ""), "index.html");
    const out = join(distPublic, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, body, "utf8");
    written += 1;
  }

  const sitemap = pagesToSitemap(pages);
  writeFileSync(join(distPublic, "sitemap.xml"), sitemap, "utf8");

  console.log(`[prerender] static HTML written for ${written} public URLs -> dist/public`);
  console.log(`[prerender] sitemap.xml regenerated (${pages.length} URLs)`);
} catch (err) {
  console.warn(`[prerender] Non-fatal notice: Static pre-rendering encountered an issue, preserving client SPA bundle:`, err?.message || err);
}
