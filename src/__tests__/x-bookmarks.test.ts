import { describe, expect, it, vi } from "vitest";
import { extractUrlsFromBookmarks, fetchBookmarks } from "../agent/x-bookmarks";

describe("extractUrlsFromBookmarks", () => {
	it("ツイートのentities.urlsからexpanded_urlとcreated_atを抽出する", () => {
		const bookmarks = {
			data: [
				{
					id: "1",
					text: "Check this out https://t.co/abc",
					created_at: "2026-03-22T10:00:00Z",
					entities: {
						urls: [
							{
								expanded_url: "https://example.com/article1",
								url: "https://t.co/abc",
							},
						],
					},
				},
				{
					id: "2",
					text: "Another link https://t.co/def",
					created_at: "2026-03-21T10:00:00Z",
					entities: {
						urls: [
							{
								expanded_url: "https://example.com/article2",
								url: "https://t.co/def",
							},
						],
					},
				},
			],
		};
		const result = extractUrlsFromBookmarks(bookmarks);
		expect(result).toEqual([
			{
				url: "https://example.com/article1",
				publishedAt: "2026-03-22T10:00:00Z",
			},
			{
				url: "https://example.com/article2",
				publishedAt: "2026-03-21T10:00:00Z",
			},
		]);
	});

	it("x.com, twitter.com のURLを除外する", () => {
		const bookmarks = {
			data: [
				{
					id: "1",
					text: "A tweet with links",
					created_at: "2026-03-22T10:00:00Z",
					entities: {
						urls: [
							{
								expanded_url: "https://example.com/article",
								url: "https://t.co/abc",
							},
							{
								expanded_url: "https://x.com/user/status/123",
								url: "https://t.co/def",
							},
							{
								expanded_url: "https://twitter.com/user/status/456",
								url: "https://t.co/ghi",
							},
						],
					},
				},
			],
		};
		const result = extractUrlsFromBookmarks(bookmarks);
		expect(result).toEqual([
			{
				url: "https://example.com/article",
				publishedAt: "2026-03-22T10:00:00Z",
			},
		]);
	});

	it("pic.twitter.com のURLを除外する", () => {
		const bookmarks = {
			data: [
				{
					id: "1",
					text: "A tweet with image",
					created_at: "2026-03-22T10:00:00Z",
					entities: {
						urls: [
							{
								expanded_url: "https://pic.twitter.com/abc123",
								url: "https://t.co/xyz",
							},
							{
								expanded_url: "https://example.com/real-article",
								url: "https://t.co/abc",
							},
						],
					},
				},
			],
		};
		const result = extractUrlsFromBookmarks(bookmarks);
		expect(result).toEqual([
			{
				url: "https://example.com/real-article",
				publishedAt: "2026-03-22T10:00:00Z",
			},
		]);
	});

	it("entitiesがないツイートをスキップする", () => {
		const bookmarks = {
			data: [
				{ id: "1", text: "No links here", created_at: "2026-03-22T10:00:00Z" },
				{
					id: "2",
					text: "Has link",
					created_at: "2026-03-21T10:00:00Z",
					entities: {
						urls: [
							{
								expanded_url: "https://example.com/article",
								url: "https://t.co/abc",
							},
						],
					},
				},
			],
		};
		const result = extractUrlsFromBookmarks(bookmarks);
		expect(result).toEqual([
			{
				url: "https://example.com/article",
				publishedAt: "2026-03-21T10:00:00Z",
			},
		]);
	});

	it("dataが空またはundefinedの場合は空配列を返す", () => {
		expect(extractUrlsFromBookmarks({ data: [] })).toEqual([]);
		expect(extractUrlsFromBookmarks({})).toEqual([]);
	});

	it("重複URLもそのまま返す（重複排除は呼び出し側で行う）", () => {
		const bookmarks = {
			data: [
				{
					id: "1",
					text: "Link 1",
					created_at: "2026-03-22T10:00:00Z",
					entities: {
						urls: [
							{
								expanded_url: "https://example.com/same",
								url: "https://t.co/abc",
							},
						],
					},
				},
				{
					id: "2",
					text: "Link 2",
					created_at: "2026-03-21T10:00:00Z",
					entities: {
						urls: [
							{
								expanded_url: "https://example.com/same",
								url: "https://t.co/def",
							},
						],
					},
				},
			],
		};
		const result = extractUrlsFromBookmarks(bookmarks);
		expect(result).toEqual([
			{ url: "https://example.com/same", publishedAt: "2026-03-22T10:00:00Z" },
			{ url: "https://example.com/same", publishedAt: "2026-03-21T10:00:00Z" },
		]);
	});
});

describe("fetchBookmarks", () => {
	it("ブックマーク一覧を取得する", async () => {
		const mockBookmarks = {
			data: [
				{
					id: "1",
					text: "Test tweet",
					entities: {
						urls: [
							{ expanded_url: "https://example.com", url: "https://t.co/abc" },
						],
					},
				},
			],
		};
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify(mockBookmarks), { status: 200 }),
			);

		const result = await fetchBookmarks("test-access-token", "test-user-id");

		expect(result).toEqual(mockBookmarks);
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"https://api.x.com/2/users/test-user-id/bookmarks",
			),
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-access-token",
				}),
			}),
		);
		fetchSpy.mockRestore();
	});

	it("APIエラー時にエラーをthrowする", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response("Rate limit exceeded", { status: 429 }),
			);

		await expect(
			fetchBookmarks("test-access-token", "test-user-id"),
		).rejects.toThrow("X Bookmarks API failed (HTTP 429)");
		fetchSpy.mockRestore();
	});

	it("pagination_tokenを渡せる", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

		await fetchBookmarks("token", "user-id", "next-page-token");

		const calledUrl = fetchSpy.mock.calls[0][0] as string;
		const url = new URL(calledUrl);
		expect(url.searchParams.get("pagination_token")).toBe("next-page-token");
		fetchSpy.mockRestore();
	});
});
