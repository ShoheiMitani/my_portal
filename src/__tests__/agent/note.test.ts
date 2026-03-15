import { describe, expect, it, vi } from "vitest";
import {
	type NoteApiResponse,
	fetchNoteArticles,
	isGameRelated,
	parseNoteApiResponse,
} from "../../agent/note";
import type { FeedArticle } from "../../agent/types";

const NOW = new Date("2026-03-15T12:00:00Z");

function makeNote(
	overrides: Partial<NoteApiResponse["data"]["notes"][0]> = {},
) {
	return {
		id: 1,
		name: "テスト記事",
		body: "テスト本文",
		note_url: "https://note.com/user/n/n1234",
		publish_at: "2026-03-15T10:00:00.000+09:00",
		like_count: 10,
		user: { urlname: "testuser", nickname: "テストユーザー" },
		...overrides,
	};
}

function makeResponse(
	notes: NoteApiResponse["data"]["notes"],
	nextPage: number | null = null,
): NoteApiResponse {
	return {
		data: {
			category_id: 8,
			first_page: nextPage === null || nextPage === 2,
			next_page: nextPage,
			last_page: nextPage === null,
			notes,
		},
	};
}

describe("isGameRelated", () => {
	it("ゲーム攻略系の記事を検出する", () => {
		expect(isGameRelated("【Apex】AMMO BOT【公式note】")).toBe(true);
		expect(isGameRelated("フォートナイトの攻略法")).toBe(true);
		expect(isGameRelated("スプラトゥーン3最強武器ランキング")).toBe(true);
		expect(isGameRelated("原神のガチャ確率を検証")).toBe(true);
		expect(isGameRelated("Reasnow S1 マクロ設定")).toBe(true);
		expect(isGameRelated("PS5で遊ぶべきゲーム10選")).toBe(true);
		expect(isGameRelated("eスポーツ大会結果まとめ")).toBe(true);
	});

	it("テクノロジー記事は除外しない", () => {
		expect(
			isGameRelated("Claude Code エージェンティックエンジニアリング完全ガイド"),
		).toBe(false);
		expect(isGameRelated("MacBookはAIエージェント運用に向くのか？")).toBe(
			false,
		);
		expect(isGameRelated("Rails 8の新機能まとめ")).toBe(false);
		expect(isGameRelated("週刊ビッグテック公式発表ニュース")).toBe(false);
		expect(isGameRelated("iPhone日本語入力を最速化する設定術")).toBe(false);
	});
});

describe("parseNoteApiResponse", () => {
	it("APIレスポンスをFeedArticle配列に変換する", () => {
		const response = makeResponse([
			makeNote({
				name: "AI記事",
				note_url: "https://note.com/user/n/n1",
				body: "AI本文",
				publish_at: "2026-03-15T10:00:00.000+09:00",
				like_count: 50,
				user: { urlname: "aiuser", nickname: "AIユーザー" },
			}),
		]);

		const articles = parseNoteApiResponse(response);
		expect(articles).toHaveLength(1);
		expect(articles[0]).toEqual({
			url: "https://note.com/user/n/n1",
			title: "AI記事",
			description: "AI本文",
			publishedAt: "2026-03-15T10:00:00.000+09:00",
			metadata: { like_count: 50, author: "AIユーザー" },
		});
	});

	it("ゲーム系記事をフィルタリングする", () => {
		const response = makeResponse([
			makeNote({ name: "AI最新動向", note_url: "https://note.com/u/n/n1" }),
			makeNote({
				name: "【Apex】攻略ガイド",
				note_url: "https://note.com/u/n/n2",
			}),
			makeNote({ name: "Rails入門", note_url: "https://note.com/u/n/n3" }),
		]);

		const articles = parseNoteApiResponse(response);
		expect(articles).toHaveLength(2);
		expect(articles.map((a) => a.title)).toEqual(["AI最新動向", "Rails入門"]);
	});

	it("空のnotes配列では空配列を返す", () => {
		const response = makeResponse([]);
		expect(parseNoteApiResponse(response)).toEqual([]);
	});
});

describe("fetchNoteArticles", () => {
	it("24時間以内の記事のみ取得し、古い記事が出たらページネーション終了", async () => {
		const recentNote = makeNote({
			name: "新しい記事",
			note_url: "https://note.com/u/n/n1",
			publish_at: "2026-03-15T08:00:00.000+09:00",
		});
		const oldNote = makeNote({
			name: "古い記事",
			note_url: "https://note.com/u/n/n2",
			publish_at: "2026-03-13T00:00:00.000+09:00",
		});

		const mockFetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(makeResponse([recentNote, oldNote], null)),
		});

		const articles = await fetchNoteArticles(
			"https://note.com/api/v1/categories/tech?note_intro_only=true",
			{ maxAgeDays: 1, fetchFn: mockFetch, now: NOW },
		);

		expect(articles).toHaveLength(1);
		expect(articles[0].title).toBe("新しい記事");
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("複数ページをフェッチする", async () => {
		const note1 = makeNote({
			name: "記事1",
			note_url: "https://note.com/u/n/n1",
			publish_at: "2026-03-15T10:00:00.000+09:00",
		});
		const note2 = makeNote({
			name: "記事2",
			note_url: "https://note.com/u/n/n2",
			publish_at: "2026-03-15T08:00:00.000+09:00",
		});

		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(makeResponse([note1], 2)),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(makeResponse([note2], null)),
			});

		const articles = await fetchNoteArticles(
			"https://note.com/api/v1/categories/tech?note_intro_only=true",
			{ maxAgeDays: 1, fetchFn: mockFetch, now: NOW },
		);

		expect(articles).toHaveLength(2);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it("fetchが失敗した場合は空配列を返す", async () => {
		const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });

		const articles = await fetchNoteArticles(
			"https://note.com/api/v1/categories/tech?note_intro_only=true",
			{ maxAgeDays: 1, fetchFn: mockFetch, now: NOW },
		);

		expect(articles).toEqual([]);
	});

	it("最大ページ数に達したら停止する", async () => {
		const makeRecentNote = (i: number) =>
			makeNote({
				name: `記事${i}`,
				note_url: `https://note.com/u/n/n${i}`,
				publish_at: "2026-03-15T10:00:00.000+09:00",
			});

		const mockFetch = vi.fn();
		for (let i = 1; i <= 20; i++) {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(makeResponse([makeRecentNote(i)], i + 1)),
			});
		}

		const articles = await fetchNoteArticles(
			"https://note.com/api/v1/categories/tech?note_intro_only=true",
			{ maxAgeDays: 1, fetchFn: mockFetch, now: NOW, maxPages: 5 },
		);

		expect(mockFetch).toHaveBeenCalledTimes(5);
		expect(articles).toHaveLength(5);
	});
});
