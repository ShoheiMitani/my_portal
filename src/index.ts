import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
	return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ShoheiMitani</title>
	<link rel="icon" href="https://unavatar.io/x/shohei1913" type="image/png">
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			background-color: #f5f5f5;
			display: flex;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
		}
		.container {
			text-align: center;
			padding: 2rem;
		}
		.avatar {
			width: 160px;
			height: 160px;
			border-radius: 50%;
			object-fit: cover;
			margin-bottom: 1rem;
		}
		.name {
			font-size: 1.5rem;
			font-weight: bold;
			font-family: monospace;
			margin-bottom: 1.5rem;
			color: #333;
		}
		.card {
			background: white;
			border-radius: 16px;
			padding: 2rem;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
			max-width: 400px;
			margin: 0 auto;
		}
		.bio {
			font-size: 1.1rem;
			color: #333;
			margin-bottom: 1.5rem;
		}
		.links {
			display: flex;
			justify-content: center;
			gap: 1rem;
		}
		.links a {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 48px;
			height: 48px;
			border-radius: 12px;
			border: 1.5px solid #e0e0e0;
			text-decoration: none;
			color: #333;
			transition: background-color 0.2s, border-color 0.2s;
		}
		.links a:hover {
			background-color: #f0f0f0;
			border-color: #ccc;
		}
		.links a svg {
			width: 24px;
			height: 24px;
		}
	</style>
</head>
<body>
	<div class="container">
		<img
			class="avatar"
			src="https://unavatar.io/x/shohei1913"
			alt="ShoheiMitani"
		>
		<div class="name">ShoheiMitani</div>
		<div class="card">
			<div class="bio">Engineering Manager</div>
			<div class="links">
				<a href="https://x.com/shohei1913" target="_blank" rel="noopener noreferrer" aria-label="X">
					<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
				</a>
				<a href="https://shohei1913.hatenablog.com/" target="_blank" rel="noopener noreferrer" aria-label="Hatena Blog">
					<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.21 11.68c1.2-.52 2.04-1.76 2.04-3.2 0-2.4-1.68-4.08-4.56-4.08H6v15.2h6.12c2.88 0 4.68-1.76 4.68-4.32 0-1.68-1.04-3.08-2.59-3.6zM9.6 7.2h1.44c1.2 0 1.92.64 1.92 1.68s-.72 1.68-1.92 1.68H9.6V7.2zm1.68 9.6H9.6v-3.6h1.68c1.32 0 2.04.68 2.04 1.8s-.72 1.8-2.04 1.8z"/></svg>
				</a>
				<a href="https://speakerdeck.com/shoheimitani" target="_blank" rel="noopener noreferrer" aria-label="SpeakerDeck">
					<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm2 0v12h16V4H4zm-1 16h18a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2z"/></svg>
				</a>
				<a href="https://smartbank.co.jp/" target="_blank" rel="noopener noreferrer" aria-label="SmartBank">
					<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v2h18V7l-9-5zM5 10v8H3v2h18v-2h-2v-8h-2v8h-3v-8h-2v8H9v-8H7v8H5v-8z"/></svg>
				</a>
			</div>
		</div>
	</div>
</body>
</html>`);
});

export default app;
