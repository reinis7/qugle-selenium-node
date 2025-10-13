import fs from 'fs';
import path from "path";

import { DEBUG_LOG_DIR } from "./common.js";
// ---------------------------
// Helpers
// ---------------------------
export const b64safe = (v, def = "") => {
    try {
        if (!v) return def;
        return Buffer.from(v, "base64").toString("utf-8");
    } catch {
        return def;
    }
};

export const pick = (obj, key, def = "") =>
    obj && obj[key] !== undefined && obj[key] !== null ? obj[key] : def;


// debug logging
export const writeDebugLogLine = (data = '', filename = "gauth_log.txt") => {
    try {
        const dirPath = path.join(DEBUG_LOG_DIR);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
        }
        const filePath = path.join(dirPath, `${filename}`);
        // console.log('[writeLogLine]', dirPath, filePath)
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, data + '\n');
        } else {
            fs.appendFileSync(filePath, data + '\n');
        }
    } catch (error) {
        console.error(error);
    }
};
export function ensureUserLogDir(user_id) {
    const dir = path.join(USERS_LOG_DIR, `users`, `user_log_${user_id}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

export function writeLog(user_id, message) {
    const dir = ensureUserLogDir(user_id);
    const file = path.join(dir, "log.txt");
    const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
    fs.appendFileSync(file, `[${ts}]: ${message}\n`, "utf8");
}
// ---------------------------
// // Logging
// // ---------------------------
// function writeLog(user_id, message, append = true) {
//     const userLogDir = path.join(USERS_LOG_DIR, `user_log_${user_id}`);
//     const filename = path.join(userLogDir, "log.txt");
//     try { fs.mkdirSync(userLogDir, { recursive: true }); } catch { }
//     const mode = append ? "a" : "w";
//     const date = new Date().toISOString().replace("T", " ").replace("Z", "");
//     const line = `[${date}]: ${message}\n`;
//     fs.writeFileSync(filename, line, { flag: mode, encoding: "utf8" });
// }
