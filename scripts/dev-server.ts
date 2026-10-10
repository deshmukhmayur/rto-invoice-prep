// Dev-only static server: serves dist/renderer with the preload-API mock
// injected, so the UI can be exercised in a plain browser without an X server.
// Never used by the Electron app. Run: bun run dev:browser
import { join, extname } from "path";
import { readFileSync } from "fs";

const ROOT = join(import.meta.dir, "..", "dist", "renderer");
const SAMPLES = join(import.meta.dir, "..", ".scratch", "samples");
const PORT = Number(process.env.PORT ?? 5173);

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
};

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(join(ROOT, path));

    if (path === "/index.html") {
      const html = readFileSync(join(ROOT, "index.html"), "utf8");
      const injected = html.replace(
        "<script src=\"renderer.js\"></script>",
        "<script src=\"browser-mock.js\"></script>\n  <script src=\"renderer.js\"></script>",
      );
      return new Response(injected, { headers: { "content-type": "text/html" } });
    }

    if (path.startsWith("/samples/")) {
      const name = path.slice("/samples/".length);
      if (!/^[\w.-]+\.pdf$/.test(name)) return new Response("not found", { status: 404 });
      return new Response(Bun.file(join(SAMPLES, name)));
    }

    if (!file.exists) return new Response("not found", { status: 404 });
    return new Response(file, {
      headers: { "content-type": MIME[extname(path)] ?? "application/octet-stream" },
    });
  },
});

console.log(`Browser dev harness: http://localhost:${server.port}`);
