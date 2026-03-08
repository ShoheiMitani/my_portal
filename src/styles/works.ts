import { cardStyles, listPageBaseStyles } from "./base";

export const worksPageStyles = `${listPageBaseStyles}
${cardStyles("entry", "80px")}
.entry-meta {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}
.entry-source {
	font-size: 0.7rem;
	font-weight: 600;
	padding: 0.15rem 0.4rem;
	border-radius: 4px;
	white-space: nowrap;
}
.source-blog {
	background-color: #e8f5e9;
	color: #2e7d32;
}
.source-slide {
	background-color: #e3f2fd;
	color: #1565c0;
}
.source-article {
	background-color: #fff3e0;
	color: #e65100;
}
.entry-date {
	white-space: nowrap;
}`;
