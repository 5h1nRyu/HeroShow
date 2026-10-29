import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export function createServer() {
  return http.createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const file = pathname === "/" ? "index.html" : pathname.slice(1);
      const absolute = path.resolve(root, file);
      const relative = path.relative(root, absolute);
      if (
        relative.startsWith("..") ||
        path.isAbsolute(relative) ||
        !/^(index\.html|(?:assets|css|js|config)[\\/][^]*\.(?:png|webp|jpe?g|avif|gif|svg|ico|ttf|otf|woff2?|css|js))$/i.test(
          relative,
        )
      ) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(absolute);
      response.writeHead(200, {
        "Content-Type":
          types[path.extname(absolute).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Length": body.length,
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(404).end();
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const port = Number(process.env.PORT || 8033);
  const server = createServer();
  server.listen(port, "127.0.0.1", () =>
    console.log(`HeroShow: http://127.0.0.1:${port}`),
  );
}
