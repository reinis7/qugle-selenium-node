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