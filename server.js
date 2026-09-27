import express from "express";
import fs from "fs";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { createAuth, sameOrigin } from "./security.js";

const isProduction = process.env.NODE_ENV === "production";
const port = process.env.PORT || 5173;
const base = process.env.BASE || "/";

if (!process.env.ROOT_PATH) {
  throw new Error("ROOT_PATH environment variable is required");
}
const rootPath = path.resolve(process.env.ROOT_PATH);

// Cached production assets
const templateHtml = isProduction
  ? await fs.promises.readFile("./dist/client/index.html", "utf-8")
  : "";

// AbortControllers
const controllers = new Map();

// Links returned by AllDebrid, the only ones allowed to be downloaded (prevents SSRF)
const unlockedLinks = new Set();

// Resolve the target file and make sure it stays inside rootPath
const resolveFilePath = (dirPath = "", filename = "") => {
  const name = path.basename(filename);
  if (!name || name === "." || name === "..") {
    throw new Error("Invalid filename");
  }
  const dir = path.resolve(rootPath, `.${path.sep}${dirPath}`);
  if (dir !== rootPath && !dir.startsWith(rootPath + path.sep)) {
    throw new Error("Invalid path");
  }
  return path.join(dir, name);
};

// Create http server
const app = express();

// Behind a reverse proxy, trust X-Forwarded-* headers for client IP (login rate limit)
// and HTTPS detection (Secure cookie). Values: "true", number of hops, IPs or subnets
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === "true") {
  app.set("trust proxy", true);
} else if (/^\d+$/.test(trustProxy ?? "")) {
  app.set("trust proxy", Number(trustProxy));
} else if (trustProxy && trustProxy !== "false") {
  app.set("trust proxy", trustProxy);
}
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Authentication, before assets and routes so everything is protected
const authEnabled = Boolean(
  process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD,
);
if (authEnabled) {
  app.use(
    createAuth({
      username: process.env.AUTH_USERNAME,
      password: process.env.AUTH_PASSWORD,
    }),
  );
} else {
  console.warn(
    "⚠️  AUTH_USERNAME and AUTH_PASSWORD are not set, the app is open to anyone who can reach it",
  );
}

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

// Call the AllDebrid API, throws with the AllDebrid error message on failure
const allDebridFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.ALL_DEBRID_API_KEY}` },
    signal: AbortSignal.timeout(30000),
  });
  const json = await response.json().catch(() => null);
  if (json?.status === "error") {
    const error = new Error(json.error?.message || "AllDebrid error");
    error.code = json.error?.code;
    throw error;
  }
  if (!response.ok || json?.status !== "success") {
    throw new Error(`AllDebrid HTTP error ${response.status}`);
  }
  return json.data;
};

// AllDebrid user, cached to avoid an API call on every page load
const USER_CACHE_MS = 5 * 60 * 1000; // 5 minutes
let userCache = { user: null, expiresAt: 0 };
const getUser = async () => {
  if (userCache.user && userCache.expiresAt > Date.now()) {
    return userCache.user;
  }
  const { user } = await allDebridFetch("https://api.alldebrid.com/v4/user");
  const diffMs = new Date(user.premiumUntil * 1000) - new Date();
  userCache = {
    user: {
      username: user.username,
      isPremium: user.isPremium,
      daysLeft: Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
      fidelityPoints: user.fidelityPoints,
    },
    expiresAt: Date.now() + USER_CACHE_MS,
  };
  return userCache.user;
};

app.get("/config", async (_req, res) => {
  const config = {
    moviesPath: process.env.MOVIES_PATH || "/",
    seriesPath: process.env.SERIES_PATH || "/",
    authEnabled,
    user: null,
  };

  // Paths are still usable when AllDebrid is unreachable
  try {
    config.user = await getUser();
  } catch (error) {
    console.error("AllDebrid user error:", error.message);
    config.error = `AllDebrid: ${error.message}`;
  }

  res.json(config);
});

const MAX_UNLOCK_LINKS = 50;
const UNLOCK_CONCURRENCY = 5;

// Unlock a single link, errors are returned per link in the AllDebrid format
const unlockLink = async (link) => {
  try {
    const url = new URL("https://api.alldebrid.com/v4/link/unlock");
    url.searchParams.set("link", link);
    const data = await allDebridFetch(url, { method: "POST" });
    if (data?.link) {
      unlockedLinks.add(data.link);
    }
    return { status: "success", link, data };
  } catch (error) {
    return {
      status: "error",
      link,
      error: {
        // AllDebrid code, else error name (e.g. TimeoutError)
        code:
          typeof error.code === "string"
            ? error.code
            : error.name === "Error"
              ? "UNLOCK_FAILED"
              : error.name,
        message: error.message,
      },
    };
  }
};

app.post("/unlock", sameOrigin, async (req, res) => {
  const links = req.body.links;
  if (!Array.isArray(links) || !links.every((l) => typeof l === "string")) {
    return res.status(400).json({ error: "links must be an array of strings" });
  }
  if (links.length > MAX_UNLOCK_LINKS) {
    return res
      .status(400)
      .json({ error: `Too many links, maximum is ${MAX_UNLOCK_LINKS}` });
  }

  // Unlock in parallel with a concurrency limit, results keep the links order
  const results = new Array(links.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < links.length) {
      const index = nextIndex++;
      results[index] = await unlockLink(links[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(UNLOCK_CONCURRENCY, links.length) }, worker),
  );

  res.json({ results });
});

app.get("/download", sameOrigin, async (req, res) => {
  // Headers SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (isProduction) {
      res.flush();
    }
  };

  const { url, dirPath, filename } = req.query;
  if (!unlockedLinks.has(url)) {
    send({ error: "Unknown link, unlock it first" });
    return res.end();
  }

  let filePath;
  try {
    filePath = resolveFilePath(dirPath, filename);
  } catch (error) {
    send({ error: error.message });
    return res.end();
  }
  if (!fs.existsSync(path.dirname(filePath))) {
    send({ error: `Path ${path.dirname(filePath)} doesn't exist` });
    return res.end();
  }

  // "wx" fails atomically if the file already exists
  let fileHandle;
  try {
    fileHandle = await fs.promises.open(filePath, "wx");
  } catch (error) {
    send({
      error: error.code === "EEXIST" ? "File already exist" : error.message,
    });
    return res.end();
  }

  const controller = new AbortController();
  const uuid = crypto.randomUUID();
  controllers.set(uuid, controller);
  // Send the id right away so the download can be canceled
  send({ id: uuid, progress: 0 });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const total = Number(response.headers.get("content-length")) || null;
    let downloaded = 0;
    const startTime = Date.now();
    // First update after 1s, the speed is meaningless before
    let lastUpdate = startTime;
    const progressStream = new Transform({
      transform(chunk, _encoding, callback) {
        downloaded += chunk.length;

        const now = Date.now();
        if (now - lastUpdate >= 1000) {
          const elapsed = (now - startTime) / 1000; // in seconds
          const speed = downloaded / elapsed; // in bytes/s
          send({
            id: uuid,
            total,
            downloaded,
            progress: total ? Math.round((downloaded / total) * 100) : null,
            speed: Math.round(speed),
            remainingTime: total ? Math.round((total - downloaded) / speed) : null,
          });
          lastUpdate = now;
        }
        callback(null, chunk);
      },
    });

    // pipeline handles backpressure, errors and closes the file
    await pipeline(
      Readable.fromWeb(response.body),
      progressStream,
      fileHandle.createWriteStream(),
    );

    unlockedLinks.delete(url);
    send({
      done: true,
      id: uuid,
      total: total ?? downloaded,
      downloaded,
      progress: 100,
    });
  } catch (error) {
    await fileHandle.close().catch(() => {});
    await fs.promises.rm(filePath, { force: true });
    if (controller.signal.aborted) {
      send({ canceled: true, id: uuid });
    } else {
      send({ error: error.message });
    }
  } finally {
    controllers.delete(uuid);
    res.end();
  }
});

app.delete("/cancel/:id", sameOrigin, async (req, res) => {
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
    console.error(e);
    res.status(500).end(isProduction ? "Internal Server Error" : e.stack);
  }
});

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
