import { cardStyles, listPageBaseStyles } from "./base";

export const talksPageStyles = `${listPageBaseStyles}
${cardStyles("talk", "100px")}
.talk-event {
	font-size: 0.7rem;
	font-weight: 600;
	color: #6b21a8;
	background-color: #f3e8ff;
	padding: 0.15rem 0.4rem;
	border-radius: 4px;
	width: fit-content;
}`;
