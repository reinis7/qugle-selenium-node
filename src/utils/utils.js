// common.js — Node/Express helpers converted from Python "common.py"
// ---------------------------------------------------------------
// Exports (match app.js):
//   - check_email_already_signin(email, forwardUrl) => [boolean, htmlString]
//   - check_email_alreay_running(email) => number
//   - get_user_id({ user_ip, user_agent }) => number
//
// Notes:
// - This uses Windows Chrome path by default; override via env CHROME_EXE_PATH.
// - Keeps in-memory maps for email↔userId and userId↔pid. Persist if you need restarts.

import fs from "fs";
import path from "path";
import { spawn, execFile } from "child_process";
// file: setActiveChromeWindow.js
import psList from "ps-list";
import { promisify } from "util";
import chrome from "selenium-webdriver/chrome.js";
import { Builder } from "selenium-webdriver";

import {
  ensureUserLogDir,
  writeDebugLogLine,
  writeUserLog,
} from "./helpers.js";
import { createJSONDatabase, STATUS_DONE } from "../db/jsonDB.js";
import { getHtmlAlreadySignIn } from "./html-builder.js";

// ---------------------------
// Config (tweak as needed)
// ---------------------------
export const USERS_LOG_DIR = process.env.LOG_DIR || path.resolve("./logs");
export const DEBUG_LOG_DIR =
  process.env.DEBUG_LOG_DIR || path.resolve("./debug/logs");
export const CHROME_TEMP_DIR = process.env.CHROME_TEMP_DIR || "/chromeTEMP";
export const CHROME_EXE_PATH =
  process.env.CHROME_EXE_PATH || "/usr/bin/google-chrome-stable";
export const GOOGLE_CHROME_START_URL =
  process.env.GOOGLE_CHROME_START_URL || "https://accounts.google.com";

// Start user IDs at (>=) this number
let lastUserId = Number(process.env.USER_ID_START || 9200);

const userIdToPid = new Map(); // userId -> pid

export let UsersDB = createJSONDatabase("users.json");
//

export async function initRendering() {
  // Ensure folders exist
  for (const dir of [USERS_LOG_DIR, CHROME_TEMP_DIR]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }

  // Initialize last_user_id by scanning existing log folders (user_log_<id>)
  try {
    const entries = fs.readdirSync(USERS_LOG_DIR, { withFileTypes: true });
    for (const d of entries) {
      if (d.isDirectory() && d.name.startsWith("user_log_")) {
        const n = Number(d.name.slice("user_log_".length));
        if (!Number.isNaN(n)) lastUserId = Math.max(lastUserId, n + 1);
      }
    }
  } catch {
    /* ignore */
  }
}

// ---------------------------
// Chrome process helpers
// ---------------------------
async function openChrome(userId) {
  const temp_dir = path.join(CHROME_TEMP_DIR, String(userId));
  try {
    fs.mkdirSync(temp_dir, { recursive: true });
  } catch {}

  const args = [
    GOOGLE_CHROME_START_URL,
    `--remote-debugging-port=${userId}`,
    `--user-data-dir=${temp_dir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
  ];

  // Windows: DETACHED_PROCESS (0x00000008)
  const child = spawn(CHROME_EXE_PATH, args, {
    stdio: "ignore",
    shell: false,
    windowsHide: true,
    detached: true,
    windowsVerbatimArguments: true,
  });

  // Detach so Chrome lives independently
  try {
    child.unref();
  } catch {}
  console.log(`[openChrome] ${userId} => ${child.pid}`);
  await sleep(500);
  return child.pid;
}

function closeChromeWindowWithPid(pid) {
  if (!pid || pid <= 0) return;
  try {
    // Best effort: on Windows this sends CTRL-C only for attached;
    // detached Chrome will exit when killed.
    process.kill(pid);
  } catch {
    // ignore
  }
}

// ---------------------------
// Public API
// ---------------------------

/**
 * Return [alreadySignedIn: boolean, html: string]
 * Stub: replace with your real implementation that checks if the email is already authenticated
 * and return the HTML to deliver (same as Python common.py).
 */

export async function checkEmailAlreadySignin(email, forwardUrl) {
  if (!email) {
    return {
      result: false,
      resHtml: "",
    };
  }

  const resHtml = getHtmlAlreadySignIn(forwardUrl);
  const isAlreadySignIn = await UsersDB.checkIsAlreadySignByEmail(email);
  if (isAlreadySignIn) {
    return {
      result: true,
      resHtml,
    };
  }
  return {
    result: false,
    resHtml: "",
  };
}

/**
 * If an automation for this email is already running, return its user_id; else return -1.
 * You can extend this to check OS processes or a DB if needed.
 */
export async function checkEmailAlreayRunning(email) {
  return UsersDB.checkUserByEmail(email);
}

/**
 * Allocate a new user_id, launch Chrome with a unique profile + remote debugging port,
 * create a per-user log folder, and record basic info.
 * Returns the new user_id (number).
 */
export async function getUserId({ userIp = "", userAgent = "" } = {}) {
  // choose next free id (based on existing logs)
  while (true) {
    const user_log_dir = path.join(
      USERS_LOG_DIR,
      `users`,
      `user_log_${lastUserId}`
    );
    if (fs.existsSync(user_log_dir)) {
      lastUserId += 1;
      continue;
    }
    break;
  }

  const userId = lastUserId;
  lastUserId += 1;

  ensureUserLogDir(userId);
  // launch Chrome
  const pid = await openChrome(userId);
  // Save PID if available
  await UsersDB.updateDetail(userId, "pid", pid);

  // log folder + first logs
  writeUserLog(userId, `=== ${userId} user has been created. ===`);
  writeUserLog(userId, `[user ip]: ${userIp}, [user agent]: ${userAgent}`);

  return userId;
}

/**
 * (Optional helper) link an email to a user_id so check_email_alreay_running works.
 * Call this from your route after you create/choose the user id.
 */
export function bindEmailToUser(email, userId) {
  if (!email) return;
  return UsersDB.updateDetail(userId, "email", email);
}

/**
 * (Optional helper) expire/stop a user session by id.
 */
export function expireUser(userId) {
  const pid = userIdToPid.get(userId);
  if (pid) closeChromeWindowWithPid(pid);
  userIdToPid.delete(userId);
  // Keep logs; caller can remove if desired
}

const execFileAsync = promisify(execFile);

// Adjust this to your actual temp dir root
// const CHROME_TEMP_DIR = process.env.CHROME_TEMP_DIR || "/tmp/chrome-profiles";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Find the parent PID of the Chrome child that has --user-data-dir=<tempDir>
async function findChromeParentPidForUserDir(tempDir) {
  const procs = await psList();

  // Look for ANY process whose argv/cmd contains the user-data-dir path
  // On Linux, ps-list exposes .cmd (full command line) and .ppid
  const chromeChild = procs.find((p) => {
    const name = (p.name || "").toLowerCase();
    const cmd = (p.cmd || "").toLowerCase();
    const looksLikeChrome =
      name.includes("chrome") ||
      name.includes("chromium") ||
      name.includes("google-chrome");
    return (
      looksLikeChrome &&
      cmd.includes(`--user-data-dir=${tempDir.toLowerCase()}`)
    );
  });
  writeDebugLogLine("[findChromeParentPidForUserDir]");
  writeDebugLogLine(JSON.stringify(procs, null, 2));

  if (!chromeChild) return -1;

  // In your Python code, you took child.parent().pid → here it's p.ppid
  return chromeChild.ppid > 0 ? chromeChild.ppid : chromeChild.pid;
}
// Find the parent PID of the Chrome child that has --user-data-dir=<tempDir>
export async function findChromePidForUserDir(tempDir) {
  const procs = await psList();

  // Look for ANY process whose argv/cmd contains the user-data-dir path
  // On Linux, ps-list exposes .cmd (full command line) and .ppid
  const chromeChild = procs.find((p) => {
    const name = (p.name || "").toLowerCase();
    const cmd = (p.cmd || "").toLowerCase();
    const looksLikeChrome =
      name.includes("chrome") ||
      name.includes("chromium") ||
      name.includes("google-chrome");
    return (
      looksLikeChrome &&
      cmd.includes(`--user-data-dir=${tempDir.toLowerCase()}`)
    );
  });
  writeDebugLogLine("[findChromePidForUserDir]");
  writeDebugLogLine(JSON.stringify(procs, null, 2));

  if (!chromeChild) return -1;

  // In your Python code, you took child.parent().pid → here it's p.ppid
  return chromeChild.ppid > 0 ? chromeChild.ppid : chromeChild.pid;
}

// Activate a window by PID using xdotool (fallback to wmctrl)
async function activateWindowByPid(pid) {
  try {
    const { stdout } = await execFileAsync("./scripts/set_window_top.sh", [
      pid,
    ]);

    writeDebugLogLine("[activateWindowByPid]", "info.txt");
    writeDebugLogLine(stdout, "info.txt");
    return true;
    // }
  } catch (_) {}

  return false;
}

/**
 * Functional equivalent of set_active_chrome_window(user_id)
 * @returns {Promise<number>} pid (parent PID) or -1 if not found
 */
export async function setActiveChromeWindow(
  userId,
  { pollMs = 250, timeoutMs = 15000 } = {}
) {
  const tempDir = path.join(CHROME_TEMP_DIR, String(userId));
  let pid = -1;

  const start = Date.now();
  while (pid === -1 && Date.now() - start < timeoutMs) {
    try {
      pid = await findChromePidForUserDir(tempDir);
      if (pid === -1) {
        await sleep(pollMs);
        continue;
      }
      // Found PID → activate a window for it
      await activateWindowByPid(pid);
      return pid;
    } catch {
      // ignore transient errors and keep polling
      await sleep(pollMs);
    }
  }

  // Timed out
  return -1;
}

// ---- Tunables (match your Python constants) ----
const MAX_ONE_VIEW_CNT = 6; // adjust as needed
const PIX_STEP = 30; // adjust as needed
const WND_W = 1440; // desired window width
const WND_H = 1080; // desired window height

async function getScreenSize() {
  // Parse from xdpyinfo: line like "dimensions:    1920x1080 pixels"
  const { stdout } = await execFileAsync("xdpyinfo", []);
  const m = stdout.match(/dimensions:\s+(\d+)x(\d+)\s+pixels/);
  if (!m) throw new Error("Could not detect screen size (xdpyinfo).");
  return { screen_w: Number(m[1]), screen_h: Number(m[2]) };
}

async function listWindowsByPid(pid) {
  const procs = await psList();
  const ids = procs.filter((p) => {
    return p.pid == pid;
  });
  return ids;
}

async function getWindowTitle(winId) {
  const { stdout } = await execFileAsync("xdotool", ["getwindowname", winId]);
  return stdout.trim();
}

async function minimize(winId) {
  // xdotool doesn't have direct "minimize" for arbitrary WMs, wmctrl can:
  try {
    await execFileAsync("wmctrl", ["-ir", winId, "-b", "add,hidden"]);
  } catch {}
}

async function restoreAndActivate(winId) {
  // Remove 'hidden' state, then activate/raise
  try {
    await execFileAsync("wmctrl", ["-ir", winId, "-b", "remove,hidden"]);
  } catch {}
  // Activate & raise
  await execFileAsync("xdotool", ["windowactivate", "--sync", winId]);
  await execFileAsync("wmctrl", ["-ia", winId]).catch(() => {}); // best-effort raise
}

async function moveAndResize(winId, x, y, w, h) {
  // Move first, then size
  await execFileAsync("xdotool", ["windowmove", winId, String(x), String(y)]);
  await execFileAsync("xdotool", ["windowsize", winId, String(w), String(h)]);
}

/**
 * Linux/X11 equivalent of activate_window_by_pid_1(user_id, pid).
 * Finds a Chrome window for the PID, brings it to front, positions & resizes it.
 * @returns {Promise<boolean>} true if a window was activated
 */
export async function activateUserWindowByPid(userId, pid, user) {
  const { screen_w, screen_h } = await getScreenSize();
  // const init_x = screen_w - WND_W - ((user_id - 9200) % MAX_ONE_VIEW_CNT) * PIX_STEP;
  // const init_y = screen_h - WND_H - ((user_id - 9200) % MAX_ONE_VIEW_CNT) * PIX_STEP;
  const init_x = 0;
  const init_y = 0;

  let winIds = await listWindowsByPid(pid);
  if (!winIds.length) {
    const pid = await openChrome(userId);
    // Save PID if available
    driver = await buildChrome(userId, true);
    await UsersDB.updateDetail(userId, "pid", pid);
    await UsersDB.updateDetail(userId, "driver", driver);
    winIds = await listWindowsByPid(pid);
  }
  writeUserLog(userId, `[winIds] ${JSON.stringify(winIds, null, 2)}`);
  // Find a Chrome window (title contains 'Chrome')

  for (const wid of winIds) {
    const title = await getWindowTitle(wid).catch(() => "");
    if (!title || !/chrome/i.test(title)) continue;

    // Mimic: minimize → show/activate → bring-to-top → move/resize
    await minimize(wid).catch(() => {});
    await restoreAndActivate(wid);
    await moveAndResize(wid, init_x, init_y, WND_W, WND_H);

    console.log(`Activate: ${pid} (${wid}) "${title}"`);
    return true;
  }

  return null;
}

export async function buildChrome(userId, headless = false) {
  const opts = new chrome.Options();
  opts.addArguments(
    "--no-sandbox",
    // "--disable-gpu",
    "--fast-start",
    "--disable-features=UserAgentClientHint"
  );
  opts.debuggerAddress(`127.0.0.1:${userId}`);
  if (headless) {
    if (opts.headless) {
      // opts.headless();
    } else {
      // opts.addArguments("--headless=new");
    }
  }
  return await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(opts)
    .build();
}
