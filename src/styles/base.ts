export const resetStyles = `
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}
body {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
	background-color: #f5f5f5;
}`;

export const listPageBaseStyles = `${resetStyles}
body {
	min-height: 100vh;
	padding: 2rem 1rem 4rem;
}
.container {
	max-width: 640px;
	margin: 0 auto;
}
.header {
	display: flex;
	align-items: center;
	gap: 1rem;
	margin-bottom: 1.5rem;
}
.back-link {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 10px;
	border: 1.5px solid #e0e0e0;
	background: none;
	cursor: pointer;
	text-decoration: none;
	color: #333;
	transition: background-color 0.2s;
}
.back-link:hover {
	background-color: #e8e8e8;
}
.page-title {
	font-size: 1.5rem;
	font-weight: bold;
	color: #333;
}
.year-separator {
	font-size: 0.85rem;
	font-weight: 600;
	color: #999;
	padding: 0.75rem 0 0.25rem;
}
.year-separator:first-child {
	padding-top: 0;
}`;

export function cardStyles(prefix: string, thumbnailWidth: string): string {
	return `
.${prefix} {
	display: flex;
	gap: 0.75rem;
	background: white;
	border-radius: 12px;
	padding: 0.75rem;
	margin-bottom: 0.5rem;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	text-decoration: none;
	color: #333;
	transition: box-shadow 0.2s, transform 0.2s;
}
.${prefix}:hover {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	transform: translateY(-1px);
}
.${prefix}-thumbnail {
	width: ${thumbnailWidth};
	height: 56px;
	object-fit: cover;
	border-radius: 8px;
	flex-shrink: 0;
}
.${prefix}-thumbnail-placeholder {
	width: ${thumbnailWidth};
	height: 56px;
	border-radius: 8px;
	background: #f0f0f0;
	flex-shrink: 0;
}
.${prefix}-body {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 0.25rem;
	min-width: 0;
}
.${prefix}-title {
	font-size: 0.9rem;
	line-height: 1.4;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.${prefix}-date {
	font-size: 0.75rem;
	color: #999;
}`;
}
