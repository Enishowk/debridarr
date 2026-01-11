import express from "express";
import fs from "fs";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";
const port = process.env.PORT || 5173;
const base = process.env.BASE || "/";

// Cached production assets
const templateHtml = isProduction
  ? await fs.promises.readFile("./dist/client/index.html", "utf-8")
  : "";

// AbortControllers
const controllers = new Map();

// Create http server
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Add Vite or respective production middlewares
/** @type {import('vite').ViteDevServer | undefined} */
let vite;
if (!isProduction) {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    base,
  });
  app.use(vite.middlewares);
} else {
  const compression = (await import("compression")).default;
  const sirv = (await import("sirv")).default;
  app.use(compression());
  app.use(base, sirv("./dist/client", { extensions: [] }));
}

app.get("/config", (_req, res) => {
  res.json({
    moviesPath: process.env.MOVIES_PATH || "/",
    seriesPath: process.env.SERIES_PATH || "/",
  });
});

app.post("/unlock", async (req, res) => {
  const links = req.body.links;

  const results = [];
  for (const link of links) {
    const url = new URL(`https://api.alldebrid.com/v4/link/unlock`);
    url.searchParams.set("link", link);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.ALL_DEBRID_API_KEY}` },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
    } else {
      const data = await response.json();
      results.push(data);
    }
  }

  res.send({ results });
});

app.get("/download", async (req, res) => {
  // Headers SSE & CORS
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders && res.flushHeaders();

  const { url, dirPath, filename } = req.query;
  const filePath = `${process.env.ROOT_PATH}${dirPath}/${filename}`;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    res.write(
      `data: ${JSON.stringify({ error: `Path ${process.env.ROOT_PATH}${dirPath} doesn't exist` })}\n\n`,
    );
    return res.end();
  }
  if (fs.existsSync(filePath)) {
    res.write(`data: ${JSON.stringify({ error: "File already exist" })}\n\n`);
    return res.end();
  }

  const controller = new AbortController();
  const uuid = crypto.randomUUID();
  const fileStream = fs.createWriteStream(filePath);
  controllers.set(uuid, controller);
  const response = await fetch(url, {
    method: "GET",
    signal: controller.signal,
  });

  fileStream.on("error", (err) => {
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  });

  const total = response.headers.get("content-length")
    ? Number(response.headers.get("content-length"))
    : null;
  let downloaded = 0;
  let startTime = Date.now();
  let lastUpdate = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(Buffer.from(value));
      downloaded += value.length;

      const now = Date.now();
      if (now - lastUpdate >= 1000) {
        const elapsed = (now - startTime) / 1000; // in seconds
        const speedMbps = (downloaded / elapsed / 1_000_000).toFixed(2); // convert to MB/s
        const leftMb = Math.round((total - downloaded) / 1_000_000);
        const remainingTime = Math.round(leftMb / speedMbps);
        const progress = Math.round((downloaded / total) * 100);

        res.write(
          `data: ${JSON.stringify({ id: uuid, total, downloaded, progress, speedMbps, remainingTime })}\n\n`,
        );
        if (isProduction) {
          res.flush();
        }
        lastUpdate = now;
      }
    }

    fileStream.end();
    controllers.delete(uuid);
    res.write(
      `data: ${JSON.stringify({ done: true, id: uuid, total, downloaded, progress: 100 })}\n\n`,
    );
    res.end();
  } catch (error) {
    fileStream.destroy("stream destroyed");
    controllers.delete(uuid);
    res.end();
  }
});

app.delete("/cancel/:id", async (req, res) => {
  const id = req.params.id;
  const controller = controllers.get(id);
  if (controller) {
    controller.abort();
    return res.status(200).json({ status: "Canceled" });
  }

  return res.status(404).json({ error: "Download not found" });
});

// Serve HTML
app.use("*all", async (req, res) => {
  try {
    const url = req.originalUrl.replace(base, "");

    /** @type {string} */
    let template;
    /** @type {import('./src/entry-server.js').render} */
    let render;
    if (!isProduction) {
      // Always read fresh template in development
      template = await fs.promises.readFile("./index.html", "utf-8");
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule("/src/entry-server.jsx")).render;
    } else {
      template = templateHtml;
      render = (await import("./dist/server/entry-server.js")).render;
    }

    let rendered = await render(url);

    const html = template
      .replace(`<!--app-head-->`, rendered.head ?? "")
      .replace(`<!--app-html-->`, rendered.html ?? "");

    res.status(200).set({ "Content-Type": "text/html" }).send(html);
  } catch (e) {
    vite?.ssrFixStacktrace(e);
    res.status(500).end(e.stack);
  }
});

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
