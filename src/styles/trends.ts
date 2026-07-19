import { listPageBaseStyles } from "./base";

export const trendsPageStyles = `${listPageBaseStyles}
.toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 1rem;
}
.tabs {
	display: flex;
	gap: 0.5rem;
}
.tab,
.regenerate-button,
.detail-pref-button {
	padding: 0.4rem 1rem;
	border: 1.5px solid #e0e0e0;
	border-radius: 8px;
	background: white;
	cursor: pointer;
	font-size: 0.85rem;
	color: #666;
	font-family: inherit;
	transition: all 0.2s;
}
.tab:hover,
.regenerate-button:hover:not(:disabled),
.detail-pref-button:hover:not(:disabled):not(.active) {
	background-color: #f0f0f0;
}
.regenerate-button:disabled,
.detail-pref-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
.tab.active,
.detail-pref-button.active {
	background: #333;
	color: white;
	border-color: #333;
}
.topic-card {
	background: white;
	border-radius: 12px;
	padding: 1rem;
	margin-bottom: 0.5rem;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	transition: box-shadow 0.2s, transform 0.2s, opacity 0.2s;
	text-decoration: none;
	color: #333;
	display: block;
}
.topic-card:hover {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	transform: translateY(-1px);
}
.topic-card.disliked {
	opacity: 0.55;
}
.topic-card-body {
	display: block;
	width: 100%;
	border: none;
	background: none;
	padding: 0;
	margin: 0;
	text-align: left;
	cursor: pointer;
	font-family: inherit;
	font-size: inherit;
	color: inherit;
}
.pref-buttons {
	margin-left: auto;
	display: flex;
	gap: 0.25rem;
}
.pref-button {
	border: 1px solid transparent;
	background: none;
	border-radius: 6px;
	padding: 0.15rem 0.4rem;
	cursor: pointer;
	font-size: 0.85rem;
	line-height: 1;
	filter: grayscale(1);
	opacity: 0.6;
	transition: all 0.15s;
}
.pref-button:hover:not(:disabled) {
	background: #f0f0f0;
	opacity: 1;
}
.pref-button:disabled {
	opacity: 0.3;
	cursor: default;
}
.pref-button.active {
	filter: none;
	opacity: 1;
	border-color: #e0e0e0;
	background: #f7f7f7;
}
.topic-title {
	font-size: 1rem;
	font-weight: 700;
	line-height: 1.4;
	margin-bottom: 0.35rem;
}
.topic-summary {
	font-size: 0.85rem;
	color: #666;
	line-height: 1.5;
	margin-bottom: 0.5rem;
}
.topic-meta {
	font-size: 0.75rem;
	color: #999;
	display: flex;
	align-items: center;
	gap: 0.75rem;
}
.empty-state {
	text-align: center;
	color: #888;
	margin-top: 3rem;
	line-height: 1.6;
}
.empty-state p {
	margin-bottom: 0.5rem;
}
.error-message {
	background: #fef2f2;
	color: #b91c1c;
	border: 1px solid #fecaca;
	border-radius: 8px;
	padding: 0.75rem 1rem;
	font-size: 0.85rem;
	margin-bottom: 1rem;
}
.loading {
	text-align: center;
	color: #888;
	margin-top: 3rem;
}
.detail-title {
	font-size: 1.25rem;
	font-weight: 700;
	margin-bottom: 0.5rem;
}
.detail-summary {
	font-size: 0.9rem;
	color: #666;
	line-height: 1.6;
	margin-bottom: 1rem;
}
.detail-pref {
	display: flex;
	gap: 0.5rem;
	margin-bottom: 1.5rem;
}
.article-card {
	display: block;
	background: white;
	border-radius: 12px;
	padding: 0.75rem 1rem;
	margin-bottom: 0.5rem;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	text-decoration: none;
	color: #333;
	transition: box-shadow 0.2s, transform 0.2s;
}
.article-card:hover {
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	transform: translateY(-1px);
}
.article-title {
	font-size: 0.9rem;
	line-height: 1.4;
	font-weight: 600;
	margin-bottom: 0.25rem;
}
.article-meta {
	font-size: 0.75rem;
	color: #999;
	display: flex;
	gap: 0.75rem;
}`;
