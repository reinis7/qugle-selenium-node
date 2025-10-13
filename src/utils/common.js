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
import { spawn } from "child_process";

import { ensureUserLogDir, writeDebugLogLine, writeUserLog } from "./helpers.js";

// ---------------------------
// Config (tweak as needed)
// ---------------------------
export const USERS_LOG_DIR = process.env.LOG_DIR || path.resolve("./logs");
export const DEBUG_LOG_DIR = process.env.DEBUG_LOG_DIR || path.resolve("./debug/logs");
export const CHROME_TEMP_DIR = process.env.CHROME_TEMP_DIR || "/chromeTEMP";
export const CHROME_EXE_PATH =
    process.env.CHROME_EXE_PATH ||
    "/usr/bin/google-chrome-stable";
export const GOOGLE_CHROME_START_URL =
    process.env.GOOGLE_CHROME_START_URL || "https://accounts.google.com";

// Start user IDs at (>=) this number
let lastUserId = Number(process.env.USER_ID_START || 9200);

// In-memory registries
const emailToUserId = new Map();   // email -> userId
const userIdToPid = new Map();   // userId -> pid

export function initRendering() {
    // Ensure folders exist
    for (const dir of [USERS_LOG_DIR, CHROME_TEMP_DIR]) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch { }
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
    } catch { /* ignore */ }

}


// ---------------------------
// Chrome process helpers
// ---------------------------
function openChrome(user_id) {
    const temp_dir = path.join(CHROME_TEMP_DIR, String(user_id));
    try { fs.mkdirSync(temp_dir, { recursive: true }); } catch { }

    const args = [
        GOOGLE_CHROME_START_URL,
        `--remote-debugging-port=${user_id}`,
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
    try { child.unref(); } catch { }

    // Save PID if available
    if (child && child.pid) {
        userIdToPid.set(user_id, child.pid);
    }

    return child;
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
    // TODO: implement your real logic (e.g., check a cache/db/session files)
    // Example behavior: if no email, not signed in
    if (!email) return [false, ""];
    // Placeholder: always "not already signed in"
    return [false, ""];
}

/**
 * If an automation for this email is already running, return its user_id; else return -1.
 * You can extend this to check OS processes or a DB if needed.
 */
export async function checkEmailAlreayRunning(email) {
    if (!email) return -1;
    const uid = emailToUserId.get(email);
    return uid ?? -1;
}

/**
 * Allocate a new user_id, launch Chrome with a unique profile + remote debugging port,
 * create a per-user log folder, and record basic info.
 * Returns the new user_id (number).
 */
export async function getUserId({ user_ip = "", user_agent = "" } = {}) {
    // choose next free id (based on existing logs)
    while (true) {
        const user_log_dir = path.join(USERS_LOG_DIR, `users`, `user_log_${lastUserId}`);
        if (fs.existsSync(user_log_dir)) {
            lastUserId += 1;
            continue;
        }
        break;
    }

    const userId = lastUserId;
    lastUserId += 1;

    ensureUserLogDir(userId)
    // launch Chrome
    openChrome(userId);
    // log folder + first logs
    writeUserLog(userId, `=== ${userId} user has been created. ===`);
    writeUserLog(userId, `[user ip]: ${user_ip}, [user agent]: ${user_agent}`);

    return userId;
}

/**
 * (Optional helper) link an email to a user_id so check_email_alreay_running works.
 * Call this from your route after you create/choose the user id.
 */
export function bindEmailToUser(email, userId) {
    if (!email) return;
    emailToUserId.set(email, userId);
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

