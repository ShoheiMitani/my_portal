import { listPageBaseStyles } from "./base";

export const chatPageStyles = `${listPageBaseStyles}
body {
	padding: 0;
}
.chat-container {
	max-width: 640px;
	margin: 0 auto;
	height: 100vh;
	display: flex;
	flex-direction: column;
}
.header {
	margin-bottom: 0;
	padding: 1rem;
}
.back-link {
	flex-shrink: 0;
}
.page-title {
	flex: 1;
}
.clear-button {
	padding: 0.4rem 0.75rem;
	border: 1.5px solid #e0e0e0;
	border-radius: 8px;
	background: white;
	cursor: pointer;
	font-size: 0.85rem;
	color: #333;
	transition: background-color 0.2s;
	flex-shrink: 0;
}
.clear-button:hover {
	background-color: #f0f0f0;
}
.messages {
	flex: 1;
	overflow-y: auto;
	padding: 0 1rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
.empty {
	text-align: center;
	color: #888;
	margin-top: 30%;
}
.hint {
	font-size: 0.85rem;
	color: #aaa;
	margin-top: 0.5rem;
}
.message {
	padding: 0.75rem 1rem;
	border-radius: 12px;
	max-width: 85%;
	line-height: 1.6;
}
.message-user {
	align-self: flex-end;
	background: #333;
	color: white;
}
.message-ai {
	align-self: flex-start;
	background: white;
	color: #333;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.role {
	font-size: 0.75rem;
	font-weight: 600;
	margin-bottom: 0.25rem;
	opacity: 0.6;
}
.text {
	white-space: pre-wrap;
}
.tool-call {
	font-size: 0.8rem;
	color: #999;
	font-style: italic;
	padding: 0.25rem 0;
}
.streaming {
	color: #888;
	font-style: italic;
	padding: 0.5rem 1rem;
}
.chat-form {
	display: flex;
	gap: 0.5rem;
	padding: 1rem;
}
.chat-input {
	flex: 1;
	padding: 0.65rem 0.85rem;
	border: 1.5px solid #e0e0e0;
	border-radius: 10px;
	font-size: 1rem;
	outline: none;
	font-family: inherit;
	transition: border-color 0.2s;
}
.chat-input:focus {
	border-color: #999;
}
.send-button {
	padding: 0.65rem 1.25rem;
	background: #333;
	color: white;
	border: none;
	border-radius: 10px;
	cursor: pointer;
	font-size: 1rem;
	font-family: inherit;
	transition: background-color 0.2s;
}
.send-button:hover {
	background: #555;
}
.send-button:disabled {
	background: #ccc;
	cursor: not-allowed;
}`;
