/** @jsxImportSource react */
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { type FormEvent, useRef } from "react";
import { Link } from "react-router";
import { BackIcon } from "./components/back-icon";
import { chatPageStyles } from "../styles/chat";

export function ChatPage() {
	const agent = useAgent({
		agent: "TrendCollector",
	});

	const { messages, sendMessage, clearHistory, status, error } = useAgentChat({
		agent,
	});

	const inputRef = useRef<HTMLInputElement>(null);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		const input = inputRef.current;
		if (!input || !input.value.trim()) return;
		sendMessage({ text: input.value });
		input.value = "";
	};

	return (
		<>
			<style>{chatPageStyles}</style>
			<div className="chat-container">
				<div className="header">
					<Link className="back-link" to="/" aria-label="Back">
						<BackIcon />
					</Link>
					<h1 className="page-title">Trend Collector</h1>
					<button type="button" onClick={clearHistory} className="clear-button">
						履歴クリア
					</button>
				</div>

				<div className="messages">
					{messages.length === 0 && (
						<div className="empty">
							<p>テックトレンドについて聞いてみましょう</p>
							<p className="hint">
								例: 「最近どんなトレンドがある？」「AIについて何が話題？」
							</p>
						</div>
					)}
					{messages.map((msg) => (
						<div
							key={msg.id}
							className={`message ${msg.role === "user" ? "message-user" : "message-ai"}`}
						>
							<div className="role">
								{msg.role === "user" ? "You" : "Agent"}
							</div>
							{msg.parts.map((part, partIndex) => {
								if (part.type === "text" || part.type === "reasoning") {
									return (
										<div key={`${msg.id}-text-${partIndex}`} className="text">
											{part.text}
										</div>
									);
								}
								if (part.type.startsWith("tool-")) {
									return (
										<div
											key={`${msg.id}-tool-${partIndex}`}
											className="tool-call"
										>
											{"toolName" in part
												? (part as { toolName: string }).toolName
												: "tool"}
										</div>
									);
								}
								return null;
							})}
						</div>
					))}
					{status === "streaming" && <div className="streaming">分析中...</div>}
					{error && <div className="error">エラー: {error.message}</div>}
				</div>

				<form onSubmit={handleSubmit} className="chat-form">
					<input
						ref={inputRef}
						type="text"
						placeholder="テックトレンドについて聞いてみよう..."
						className="chat-input"
						disabled={status === "streaming"}
					/>
					<button
						type="submit"
						disabled={status === "streaming"}
						className="send-button"
					>
						送信
					</button>
				</form>
			</div>
		</>
	);
}
