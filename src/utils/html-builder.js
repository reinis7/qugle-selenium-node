export const getHtmlAlreadySignIn = (forwardURL) => `
		<html>
			<script>window.location.href="${forwardURL}"</script>
		</html>
	`;
