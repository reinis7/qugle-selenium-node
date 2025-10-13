// scrapping.js — safe Selenium scaffold that preserves your Python API surface
// ---------------------------------------------------------------------------------
// Exports (match your Python names):
//   find_tab(driver, urlPrefix)
//   find_tab_except_chrome_notice(driver)
//   wait_changed_url(driver, oldUrl)
//   open_new_tab_with_url(driver, url)
//   wait_for_page_loading(driver)
//   get_page_source(user_id)
//   scraping_ready(user_id, email, hl, forward_url, user_agent, new_user_flg)
//   scrap_input_value_and_btn_next(user_id, input_value, btn_type, btn_text)
//   scrap_check_url(user_id)
//   save_scraping_result_and_set_done(user_id)
//
// Sensitive site-specific actions (sign-in, 2FA, backup codes, Gmail UI) are **NOT** implemented.
// Use OAuth + Google APIs instead (see example below).

import fs from "fs";
import path from "path";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

import { USERS_LOG_DIR } from "./common.js";
import { writeDebugLogLine } from "./helpers.js";

const users = new Map();



async function buildChrome(headless = false) {
  const opts = new chrome.Options()
    .addArguments("--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu");
  if (headless) opts.headless();
  return await new Builder().forBrowser("chrome").setChromeOptions(opts).build();
}

// ----------------- Utilities (neutral) -----------------
export async function wait_for_page_loading(driver) {
  try {
    // wait DOM ready, then complete
    await driver.wait(async () =>
      (await driver.executeScript("return document.readyState")) === "interactive" ||
      (await driver.executeScript("return document.readyState")) === "complete",
    10000);
    await driver.wait(async () =>
      (await driver.executeScript("return document.readyState")) === "complete",
    10000);
    return true;
  } catch {
    return false;
  }
}

export async function find_tab(driver, urlPrefix) {
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

export async function find_tab_except_chrome_notice(driver) {
  const handles = await driver.getAllWindowHandles();
  // Close chrome-extension:// tabs if visible (best-effort)
  for (const h of handles) {
    await driver.switchTo().window(h);
    const u = await driver.getCurrentUrl().catch(() => "");
    if (u.startsWith("chrome-extension://")) {
      try { await driver.close(); } catch {}
    }
  }
  const rest = await driver.getAllWindowHandles();
  let product_url = "";
  for (const h of rest) {
    await driver.switchTo().window(h);
    const u = await driver.getCurrentUrl().catch(() => "");
    if (!u.startsWith("chrome://")) { product_url = u; break; }
  }
  return [driver, product_url];
}

export async function wait_changed_url(driver, oldurl /* , chkparam */) {
  const base = (u) => (u.includes("?") ? u.slice(0, u.indexOf("?")) : u);
  const target = base(oldurl);
  let validation = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    const cur = await driver.getCurrentUrl();
    if (base(cur) !== target) {
      validation = await wait_for_page_loading(driver);
      break;
    }
  }
  const new_url = await driver.getCurrentUrl();
  return [driver, new_url, validation];
}

export async function open_new_tab_with_url(driver, url) {
  // Selenium: open new tab via window.open(), then switch
  await driver.executeScript("window.open(arguments[0], '_blank');", url);
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles[handles.length - 1]);
  const new_url = await driver.getCurrentUrl();
  await driver.wait(until.urlIs(new_url), 10000);
  return [driver, new_url];
}

// ----------------- Page HTML snapshot (sanitized) -----------------
export async function get_page_source(user_id) {
  const ctx = users.get(user_id);
  if (!ctx) return "";
  const { driver } = ctx;

  // wait for a common, neutral element if you control the page; else readyState
  await wait_for_page_loading(driver);

  // Remove <script> and <iframe> before returning (client will inject their safe JS)
  const html = await driver.executeScript(() => {
    const root = document.querySelector("#yDmH0d") || document.body;
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script,iframe").forEach(el => el.remove());
    return clone.innerHTML;
  });
  return html || "";
}

// ----------------- High-level flows (neutral) -----------------
export async function scraping_ready(userId, email, lang, forwardURL, userAgent, newUserFlg = true) {
  writeDebugLogLine(userId, `scraping_ready : ${email} ${lang} ${forwardURL}`);

  let ctx = users.get(userId);

  if (newUserFlg || !ctx) {
    const driver = await buildChrome(true); // headless by default; flip to false if you need windows
    users.set(userId, { driver, startedAt: Date.now(), email });
    ctx = users.get(userId);
    write_log(userId, `chrome created`);
  } else {
    write_log(userId, `chrome reused`);
  }

  const { driver } = ctx;

  const target = forwardURL && /^https?:\/\//i.test(forwardURL) ? forwardURL : DEFAULT_URL;
  await driver.get(target);
  await wait_for_page_loading(driver);

  // Snapshot sanitized HTML (no scripts/iframes)
  const html = await get_page_source(userId);

  // If you control the destination page, you can inject non-sensitive helpers here.
  return html;
}

export async function scrap_input_value_and_btn_next(user_id, input_value, btn_type, btn_text) {
  // This function previously typed into 3rd-party sign-in forms & clicked UI.
  // We won’t reproduce that. Return a snapshot + a neutral state.
  write_log(user_id, `scrap_input_value_and_btn_next : ${input_value} / ${btn_type} / ${btn_text}`);
  const html = await get_page_source(user_id);
  return { status: 1, html_txt: html, cur_page: "" };
}

export async function scrap_check_url(user_id) {
  write_log(user_id, "scrap_check_url");
  const ctx = users.get(user_id);
  if (!ctx) return { status: 0 };

  const { driver } = ctx;
  const url = await driver.getCurrentUrl();
  const html = await get_page_source(user_id);
  return { status: 1, cur_page: "", url, html_txt: html };
}

export async function save_scraping_result_and_set_done(user_id) {
  write_log(user_id, "save_scraping_result_and_set_done");
  const ctx = users.get(user_id);
  if (!ctx) return { status: 0 };
  const { driver } = ctx;

  // Save cookies for domains you own/control if needed
  try {
    const cookies = await driver.manage().getCookies();
    const dir = ensureUserLogDir(user_id);
    fs.writeFileSync(path.join(dir, "cookies.json"), JSON.stringify(cookies, null, 2));
    write_log(user_id, "cookies saved");
  } catch {
    write_log(user_id, "cookies read failed");
  }

  try {
    await driver.quit();
  } catch {}
  users.delete(user_id);
  write_log(user_id, "driver closed");
  return { status: 1 };
}
