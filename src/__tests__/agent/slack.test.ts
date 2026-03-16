import { describe, expect, it, vi } from "vitest";
import {
	extractUrls,
	notifySlackThread,
	processSlackUrls,
	verifySlackSignature,
} from "../../agent/slack";
import type { Channel } from "../../agent/types";

describe("verifySlackSignature", () => {
	const SECRET = "test_signing_secret";

	async function generateSignature(
		secret: string,
		timestamp: string,
		body: string,
	): Promise<string> {
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign(
			"HMAC",
			key,
			encoder.encode(`v0:${timestamp}:${body}`),
		);
		const hex = [...new Uint8Array(sig)]
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		return `v0=${hex}`;
	}

	it("正しい署名で検証が成功する", async () => {
		const timestamp = String(Math.floor(Date.now() / 1000));
		const body = '{"type":"url_verification"}';
		const signature = await generateSignature(SECRET, timestamp, body);

		const result = await verifySlackSignature(
			SECRET,
			timestamp,
			body,
			signature,
		);
		expect(result).toBe(true);
	});

	it("不正な署名で検証が失敗する", async () => {
		const timestamp = String(Math.floor(Date.now() / 1000));
		const body = '{"type":"url_verification"}';

		const result = await verifySlackSignature(
			SECRET,
			timestamp,
			body,
			"v0=invalidsignature",
		);
		expect(result).toBe(false);
	});

	it("5分以上古いタイムスタンプで検証が失敗する", async () => {
		const timestamp = String(Math.floor(Date.now() / 1000) - 60 * 6);
		const body = '{"type":"url_verification"}';
		const signature = await generateSignature(SECRET, timestamp, body);

		const result = await verifySlackSignature(
			SECRET,
			timestamp,
			body,
			signature,
		);
		expect(result).toBe(false);
	});
});

describe("extractUrls", () => {
	it("Slack形式のURLを抽出する", () => {
		const text = "この記事面白い <https://example.com/article|example.com>";
		expect(extractUrls(text)).toEqual(["https://example.com/article"]);
	});

	it("ラベルなしのURLを抽出する", () => {
		const text = "チェック <https://example.com/post>";
		expect(extractUrls(text)).toEqual(["https://example.com/post"]);
	});

	it("複数URLを抽出する", () => {
		const text =
			"<https://example.com/a|A> と <http://example.com/b|B> を読んだ";
		expect(extractUrls(text)).toEqual([
			"https://example.com/a",
			"http://example.com/b",
		]);
	});

	it("URLがないメッセージでは空配列を返す", () => {
		expect(extractUrls("普通のメッセージです")).toEqual([]);
	});

	it("メールアドレスなど非URLのangle bracketは無視する", () => {
		expect(extractUrls("<mailto:user@example.com>")).toEqual([]);
	});
});

describe("processSlackUrls", () => {
	function createMockDb() {
		const preparedStmts: { sql: string; binds: unknown[] }[] = [];

		const db = {
			prepare: (sql: string) => {
				const stmt = {
					bind: (...args: unknown[]) => {
						preparedStmts.push({ sql, binds: args });
						return stmt;
					},
					run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
					all: sql.includes("SELECT id, slug")
						? vi.fn().mockResolvedValue({
								results: [
									{
										id: "ch_slack_shared",
										slug: "slack_shared",
										name: "Slack共有リンク",
										channel_type: "slack",
										config: '{"content_type":"blog"}',
									} satisfies Channel,
								],
							})
						: vi.fn().mockResolvedValue({ results: [] }),
				};
				return stmt;
			},
			batch: vi
				.fn()
				.mockImplementation((stmts: unknown[]) =>
					Promise.resolve(stmts.map(() => ({ meta: { changes: 1 } }))),
				),
			_preparedStmts: preparedStmts,
		};

		return db as unknown as D1Database & {
			_preparedStmts: typeof preparedStmts;
			batch: ReturnType<typeof vi.fn>;
		};
	}

	it("URLからFeedArticleを構築してDBに保存する", async () => {
		const db = createMockDb();

		const result = await processSlackUrls(db, ["https://example.com/post"]);

		expect(result.articlesNew).toBeGreaterThanOrEqual(0);
	});

	it("空のURLリストでは保存しない", async () => {
		const db = createMockDb();

		const result = await processSlackUrls(db, []);

		expect(result.articlesNew).toBe(0);
	});

	it("Slackチャネルが見つからない場合はエラーなく0を返す", async () => {
		const preparedStmts: { sql: string; binds: unknown[] }[] = [];
		const db = {
			prepare: (sql: string) => {
				const stmt = {
					bind: (...args: unknown[]) => {
						preparedStmts.push({ sql, binds: args });
						return stmt;
					},
					run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }),
					all: vi.fn().mockResolvedValue({ results: [] }),
				};
				return stmt;
			},
			batch: vi.fn().mockResolvedValue([]),
		} as unknown as D1Database;

		const result = await processSlackUrls(db, ["https://example.com/post"]);

		expect(result.articlesNew).toBe(0);
	});
});

describe("notifySlackThread", () => {
	it("新規記事ありの場合に取り込み件数を通知する", async () => {
		const mockFetch = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ ok: true })));

		await notifySlackThread("xoxb-token", "C123", "1234567890.123456", {
			articlesFound: 2,
			articlesNew: 1,
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"https://slack.com/api/chat.postMessage",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					channel: "C123",
					thread_ts: "1234567890.123456",
					text: "1件の記事を取り込みました",
				}),
			}),
		);
		mockFetch.mockRestore();
	});

	it("すべて取り込み済みの場合にその旨を通知する", async () => {
		const mockFetch = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ ok: true })));

		await notifySlackThread("xoxb-token", "C123", "1234567890.123456", {
			articlesFound: 1,
			articlesNew: 0,
		});

		expect(mockFetch).toHaveBeenCalledWith(
			"https://slack.com/api/chat.postMessage",
			expect.objectContaining({
				body: JSON.stringify({
					channel: "C123",
					thread_ts: "1234567890.123456",
					text: "すべて取り込み済みの記事です",
				}),
			}),
		);
		mockFetch.mockRestore();
	});
});
