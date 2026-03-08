import type { FC } from "hono/jsx";

const BackIcon: FC = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M15 18l-6-6 6-6" />
	</svg>
);

// biome-ignore lint/suspicious/noExplicitAny: Hono JSX children type is complex
export const PageLayout: FC<{ title: string; children: any }> = ({
	title,
	children,
}) => (
	<html lang="ja">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>{title}</title>
			<link
				rel="icon"
				href="https://unavatar.io/x/shohei1913"
				type="image/png"
			/>
		</head>
		<body>{children}</body>
	</html>
);

export const ListPageLayout: FC<{
	title: string;
	pageTitle: string;
	styles: string;
	// biome-ignore lint/suspicious/noExplicitAny: Hono JSX children type is complex
	children: any;
}> = ({ title, pageTitle, styles, children }) => (
	<PageLayout title={title}>
		<style>{styles}</style>
		<div class="container">
			<div class="header">
				<a class="back-link" href="/" aria-label="Back">
					<BackIcon />
				</a>
				<h1 class="page-title">{pageTitle}</h1>
			</div>
			{children}
		</div>
	</PageLayout>
);
