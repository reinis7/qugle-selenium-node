import fs from "fs";
import path from "path";

import { DEBUG_LOG_DIR, USERS_LOG_DIR } from "./utils.js";
import psList from "ps-list";
// ---------------------------
// Helpers
// ---------------------------
export const decodeB64 = (buf, defaultVal = "") => {
  try {
    if (!buf) return defaultVal;
    return atob(buf);
  } catch {
    return defaultVal;
  }
};

// debug logging
export const writeDebugLogLine = (data = "", filename = "gauth_log.txt") => {
  try {
    const dirPath = path.join(DEBUG_LOG_DIR);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    const filePath = path.join(dirPath, `${filename}`);
    // console.log('[writeLogLine]', dirPath, filePath)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, data + "\n");
    } else {
      fs.appendFileSync(filePath, data + "\n");
    }
  } catch (error) {
    console.error(error);
  }
};
export function ensureUserLogDir(userId) {
  const dir = path.join(USERS_LOG_DIR, `users`, `user_log_${userId}`);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    return null;
  }
  return dir;
}

export function writeUserLog(userId, message) {
  const dir = ensureUserLogDir(userId);
  const file = path.join(dir, "log.txt");
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  fs.appendFileSync(file, `[${ts}]: ${message}\n`, "utf8");
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Check if a process with a given PID and name (e.g. "chrome") is running
 * @param {number} pid - process id to check
 * @param {string} name - process name ("chrome", "google-chrome", etc.)
 * @returns {Promise<boolean>}
 */

export async function checkProcessIsRunning(pid, name = "chrome") {
  try {
    const processes = await psList();
    console.log(`processes : ${JSON.stringify(processes, null, 2)}`)

    return processes.some(
      (p) => p.pid === pid && p.name.toLowerCase().includes(name.toLowerCase())
    );
  } catch (err) {
    console.error("Error checking processes:", err);
    return false;
  }
}

//======================================
//
//
//
//
//
//======================================
