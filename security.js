import { createHash, createHmac, timingSafeEqual } from "crypto";
import express from "express";

const SESSION_COOKIE = "debridarr_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Hash so both buffers have the same length for timingSafeEqual
const digest = (value) => createHash("sha256").update(value).digest();
const safeEqual = (a, b) => timingSafeEqual(digest(a), digest(b));

const getCookie = (req, name) =>
  req
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);

// Block cross-site requests (CSRF), browsers send Sec-Fetch-Site on every request
export const sameOrigin = (req, res, next) => {
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return res.status(403).json({ error: "Cross-site request blocked" });
  }
  next();
};

const loginPage = (styles, error = "") => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/debridarr.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Debridarr - Login</title>
    <style>${styles}</style>
  </head>
  <body class="flex min-h-screen items-center justify-center bg-base-300 p-5">
    <div class="card w-full max-w-md bg-base-200 p-10 shadow-2xl">
      <div class="mb-8 flex items-center justify-center gap-2">
        <img src="/debridarr.svg" width="36" alt="Debridarr Logo" />
        <h1 class="text-3xl font-bold">Debridarr</h1>
      </div>
      <form class="flex flex-col gap-4" method="post" action="/login">
        <input class="input w-full" type="text" name="username" placeholder="Username" autocomplete="username" required autofocus />
        <input class="input w-full" type="password" name="password" placeholder="Password" autocomplete="current-password" required />
        ${error ? `<div role="alert" class="alert alert-error alert-soft">${error}</div>` : ""}
        <button class="btn btn-primary" type="submit">Login</button>
      </form>
    </div>
  </body>
</html>`;

// Session stored in a signed cookie "<expiresAt>.<signature>", no server-side storage.
// The secret is derived from the credentials: changing the password logs everyone out.
export function createAuth({ username, password, getStyles }) {
  const secret = createHmac("sha256", password)
    .update(`debridarr-session:${username}`)
    .digest();
  const sign = (value) =>
    createHmac("sha256", secret).update(value).digest("base64url");

  const createSession = () => {
    const expiresAt = String(Date.now() + SESSION_DURATION_MS);
    return `${expiresAt}.${sign(expiresAt)}`;
  };
  const isValidSession = (session = "") => {
    const [expiresAt, signature = ""] = session.split(".");
    return safeEqual(signature, sign(expiresAt)) && Number(expiresAt) > Date.now();
  };

  // Failed login attempts by IP
  const loginAttempts = new Map();
  const isRateLimited = (ip) => {
    const now = Date.now();
    for (const [key, attempt] of loginAttempts) {
      if (attempt.resetAt <= now) loginAttempts.delete(key);
    }
    return (loginAttempts.get(ip)?.count ?? 0) >= MAX_LOGIN_ATTEMPTS;
  };
  const addFailedAttempt = (ip) => {
    const attempt = loginAttempts.get(ip) ?? {
      count: 0,
      resetAt: Date.now() + LOGIN_WINDOW_MS,
    };
    attempt.count++;
    loginAttempts.set(ip, attempt);
  };

  const sendLoginPage = async (res, status, error) =>
    res.status(status).type("html").send(loginPage(await getStyles(), error));

  const router = express.Router();

  router.get("/login", (req, res) => {
    if (isValidSession(getCookie(req, SESSION_COOKIE))) {
      return res.redirect("/");
    }
    return sendLoginPage(res, 200);
  });

  router.post("/login", sameOrigin, (req, res) => {
    if (isRateLimited(req.ip)) {
      return sendLoginPage(res, 429, "Too many attempts, try again later");
    }

    const validUsername = safeEqual(String(req.body?.username ?? ""), username);
    const validPassword = safeEqual(String(req.body?.password ?? ""), password);
    if (!validUsername || !validPassword) {
      addFailedAttempt(req.ip);
      return sendLoginPage(res, 401, "Invalid username or password");
    }

    loginAttempts.delete(req.ip);
    res.cookie(SESSION_COOKIE, createSession(), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      maxAge: SESSION_DURATION_MS,
      path: "/",
    });
    res.redirect(303, "/");
  });

  router.post("/logout", sameOrigin, (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.redirect(303, "/login");
  });

  // Logo is public, used by the login page
  router.get("/debridarr.svg", (_req, _res, next) => next("router"));

  router.use((req, res, next) => {
    if (isValidSession(getCookie(req, SESSION_COOKIE))) {
      return next();
    }
    // Page navigation → login page, API calls (fetch, EventSource) → 401
    if (req.method === "GET" && req.get("accept")?.includes("text/html")) {
      return res.redirect("/login");
    }
    res.status(401).json({ error: "Unauthorized" });
  });

  return router;
}
