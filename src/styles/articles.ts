import { listPageBaseStyles } from "./base";

export const articlesPageStyles = `${listPageBaseStyles}
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
.tab {
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
.tab:hover {
	background-color: #f0f0f0;
}
.tab.active {
	background: #333;
	color: white;
	border-color: #333;
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
	align-items: center;
}
.source-badge {
	display: inline-block;
	padding: 0.15rem 0.5rem;
	border-radius: 4px;
	font-size: 0.7rem;
	font-weight: 600;
}
.source-badge.crawler {
	background: #e0f2fe;
	color: #0369a1;
}
.source-badge.slack {
	background: #fef3c7;
	color: #92400e;
}
.empty-state {
	text-align: center;
	color: #888;
	margin-top: 3rem;
	line-height: 1.6;
}
.loading {
	text-align: center;
	color: #888;
	margin-top: 3rem;
}
.load-more {
	display: block;
	width: 100%;
	padding: 0.75rem;
	border: 1.5px solid #e0e0e0;
	border-radius: 8px;
	background: white;
	cursor: pointer;
	font-size: 0.85rem;
	color: #666;
	font-family: inherit;
	margin-top: 0.5rem;
	transition: background 0.2s;
}
.load-more:hover {
	background: #f0f0f0;
}
.load-more:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}`;
