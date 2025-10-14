import fs from "fs";
import path from "path";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import psList from "ps-list";

import { writeUserLog } from "./helpers.js";
import {
  activateUserWindowByPid,
  setActiveChromeWindow,
  UsersDB,
} from "./common.js";

async function buildChrome(userId, headless = false) {
  const opts = new chrome.Options();

  opts.addArguments(
    "--no-sandbox",
    "--disable-gpu",
    "--fast-start",
    "--disable-features=UserAgentClientHint"
  );

  opts.debuggerAddress(`127.0.0.1:${userId}`);
  if (headless) {
    if (opts.headless) {
      opts.headless();
    } else {
      opts.addArguments("--headless=new");
    }
  }
  return await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(opts)
    .build();
}

// ----------------- Utilities (neutral) -----------------
export async function waitForPageLoading(driver) {
  try {
    // wait DOM ready, then complete
    await driver.wait(
      async () =>
        (await driver.executeScript("return document.readyState")) ===
          "interactive" ||
        (await driver.executeScript("return document.readyState")) ===
          "complete",
      10000
    );
    await driver.wait(
      async () =>
        (await driver.executeScript("return document.readyState")) ===
        "complete",
      10000
    );
    return true;
  } catch {
    return false;
  }
}

export async function findTab(driver, urlPrefix) {
  // Selenium doesn’t enumerate tabs’ URLs without switching; we’ll sample handles
  const handles = await driver.getAllWindowHandles();
  let product_url = "";
  for (const h of handles) {
    await driver.switchTo().window(h);
    const u = await driver.getCurrentUrl();
    if (u.startsWith(urlPrefix)) {
      product_url = u;
      break;
    }
  }
  return [driver, product_url];
}

export async function findTabExceptChromeNotice(driver) {
  const handles = await driver.getAllWindowHandles();
  // Close chrome-extension:// tabs if visible (best-effort)
  for (const h of handles) {
    await driver.switchTo().window(h);
    const u = await driver.getCurrentUrl().catch(() => "");
    if (u.startsWith("chrome-extension://")) {
      try {
        await driver.close();
      } catch {}
    }
  }
  const rest = await driver.getAllWindowHandles();
  let product_url = "";
  for (const h of rest) {
    await driver.switchTo().window(h);
    const u = await driver.getCurrentUrl().catch(() => "");
    if (!u.startsWith("chrome://")) {
      product_url = u;
      break;
    }
  }
  return [driver, product_url];
}

export async function waitChangedUrl(driver, oldurl /* , chkparam */) {
  const base = (u) => (u.includes("?") ? u.slice(0, u.indexOf("?")) : u);
  const target = base(oldurl);
  let validation = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const cur = await driver.getCurrentUrl();
    if (base(cur) !== target) {
      validation = await waitForPageLoading(driver);
      break;
    }
  }
  const new_url = await driver.getCurrentUrl();
  return [driver, new_url, validation];
}

export async function openNewTabWithUrl(driver, url) {
  // Selenium: open new tab via window.open(), then switch
  await driver.executeScript("window.open(arguments[0], '_blank');", url);
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles[handles.length - 1]);
  const new_url = await driver.getCurrentUrl();
  await driver.wait(until.urlIs(new_url), 10000);
  return [driver, new_url];
}

// ----------------- Page HTML snapshot (sanitized) -----------------
export async function getPageSource(userId) {
  const ctx = await UsersDB.get(userId);
  if (!ctx) return "";
  const { driver } = ctx;

  // wait for a common, neutral element if you control the page; else readyState
  await waitForPageLoading(driver);

  // Remove <script> and <iframe> before returning (client will inject their safe JS)
  const html = await driver.executeScript(() => {
    const root = document.querySelector("#yDmH0d") || document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script,iframe").forEach((el) => el.remove());
    return clone.innerHTML;
  });
  return html || "";
}

// ----------------- High-level flows (neutral) -----------------
export async function scrapingReady(
  userId,
  email,
  lang,
  { forwardURL, userAgent, newUserFlg = true }
) {
  writeUserLog(userId, `Scraping Ready : ${email} ${lang} ${forwardURL}`);
  let pid = -1;
  let driver = null;
  if (newUserFlg) {
    pid = await setActiveChromeWindow(userId);
    writeUserLog(userId, `chrome created : pid=${pid}`);
    driver = await buildChrome(userId, true);
    await UsersDB.set(userId, {
      userId,
      driver,
      startedAt: Date.now(),
      email,
      pid,
    });
  } else {
    const user = await UsersDB.get(userId);
    console.log(`userdata = ${JSON.stringify(user, null, 2)}`);
    if (!user) {
      throw new Error("Parameter is incorrect");
    }
    pid = user["pid"];
    writeUserLog(userId, `chrome ${user} => activated ${pid}`);
    await activateUserWindowByPid(userId, pid);
  }

  if (!driver || pid < 0) {
    throw new Error("Parameter is incorrect");
  }

  const target =
    forwardURL && /^https?:\/\//i.test(forwardURL) ? forwardURL : "";
  await driver.get(target);
  await waitForPageLoading(driver);

  // Snapshot sanitized HTML (no scripts/iframes)
  const html = await getPageSource(userId);

  // If you control the destination page, you can inject non-sensitive helpers here.
  return html;
}

export async function scrap_input_value_and_btn_next(
  userId,
  input_value,
  btn_type,
  btn_text
) {
  // This function previously typed into 3rd-party sign-in forms & clicked UI.
  // We won’t reproduce that. Return a snapshot + a neutral state.
  writeUserLog(
    userId,
    `scrap_input_value_and_btn_next : ${input_value} / ${btn_type} / ${btn_text}`
  );
  const html = await getPageSource(userId);
  return { status: 1, html_txt: html, cur_page: "" };
}

export async function scrapCheckURL(userId) {
  writeUserLog(userId, "scrapCheckURL");
  const ctx = await UsersDB.get(userId);
  if (!ctx) return { status: 0 };

  const { driver } = ctx;
  const url = await driver.getCurrentUrl();
  const html = await getPageSource(userId);
  return { status: 1, cur_page: "", url, html_txt: html };
}

export async function saveScrapingResultAndSetDone(userId) {
  writeUserLog(userId, "saveScrapingResultAndSetDone");
  const ctx = await UsersDB.get(userId);
  if (!ctx) return { status: 0 };
  const { driver } = ctx;

  // Save cookies for domains you own/control if needed
  try {
    const cookies = await driver.manage().getCookies();
    const dir = ensureUserLogDir(userId);
    fs.writeFileSync(
      path.join(dir, "cookies.json"),
      JSON.stringify(cookies, null, 2)
    );
    writeUserLog(userId, "cookies saved");
  } catch {
    writeUserLog(userId, "cookies read failed");
  }

  try {
    await driver.quit();
  } catch {}
  users.delete(userId);
  writeUserLog(userId, "driver closed");
  return { status: 1 };
}
/**
 * Check if a process with a given PID and name (e.g. "chrome") is running
 * @param {number} pid - process id to check
 * @param {string} name - process name ("chrome", "google-chrome", etc.)
 * @returns {Promise<boolean>}
 */

export async function checkProcessIsRunning(pid, name = "chrome") {
  try {
    const processes = await psList();

    return processes.some(
      (p) => p.pid === pid && p.name.toLowerCase().includes(name.toLowerCase())
    );
  } catch (err) {
    console.error("Error checking processes:", err);
    return false;
  }
}
