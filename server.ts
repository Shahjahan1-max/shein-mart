// Minimal HTTP entrypoint for the sheinstore backend on Render.
// This starts the service and answers health checks. The store actions
// (src/actions.ts) still need a real database connection: they currently
// use the Muse hosted runtime's space-sdk, which does not exist on
// Render. Wiring a real database is the next step after the service
// starts; this file only fixes the missing start entrypoint.
const port = Number(process.env.PORT || 3000);

Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response("sheinstore backend is running", {
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Listening on port ${port}...`);
