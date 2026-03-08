import { describe, expect, it } from "vitest";
import app from "../index";

describe("GET /talks", () => {
	it("returns 200", async () => {
		const res = await app.request("/talks");
		expect(res.status).toBe(200);
	});

	it("returns HTML content type", async () => {
		const res = await app.request("/talks");
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("contains page title", async () => {
		const res = await app.request("/talks");
		const body = await res.text();
		expect(body).toContain("Talks");
	});

	it("contains all talk titles", async () => {
		const res = await app.request("/talks");
		const body = await res.text();
		expect(body).toContain("2重リクエスト完全攻略HANDBOOK");
		expect(body).toContain("競馬で学ぶ機械学習の基本と実践");
		expect(body).toContain(
			"32個のPRでリリースした依存度の高いコアなモデルの安全な弄り方",
		);
		expect(body).toContain(
			"7つの入金外部サービスと連携して分かった実践的な&quot;状態管理&quot;設計パターン3選",
		);
		expect(body).toContain(
			"監視を通じたサービスの逐次的進化 ~B/43の決済サービスでの取り組み~",
		);
	});

	it("contains event names", async () => {
		const res = await app.request("/talks");
		const body = await res.text();
		expect(body).toContain("Kaigi on Rails 2025");
		expect(body).toContain("YAPC::Fukuoka 2025");
		expect(body).toContain("Kaigi on Rails 2023");
		expect(body).toContain("Kaigi on Rails 2022");
		expect(body).toContain("Kaigi on Rails 2021");
	});

	it("contains links to talk pages", async () => {
		const res = await app.request("/talks");
		const body = await res.text();
		expect(body).toContain("kaigionrails.org/2025/talks/ShoheiMitani");
		expect(body).toContain("fortee.jp/yapc-fukuoka-2025");
	});

	it("displays entries sorted by date (newest first)", async () => {
		const res = await app.request("/talks");
		const body = await res.text();
		const pos1 = body.indexOf("YAPC::Fukuoka 2025"); // 2025-11-15
		const pos2 = body.indexOf("Kaigi on Rails 2025"); // 2025-09-27
		const pos3 = body.indexOf("Kaigi on Rails 2023"); // 2023-10-27
		const pos4 = body.indexOf("Kaigi on Rails 2022"); // 2022-10-21
		const pos5 = body.indexOf("Kaigi on Rails 2021"); // 2021-10-22
		expect(pos1).toBeLessThan(pos2);
		expect(pos2).toBeLessThan(pos3);
		expect(pos3).toBeLessThan(pos4);
		expect(pos4).toBeLessThan(pos5);
	});

	it("contains thumbnails", async () => {
		const res = await app.request("/talks");
		const body = await res.text();
		expect(body).toContain("talk-thumbnail");
	});

	it("contains link back to top page", async () => {
		const res = await app.request("/talks");
		const body = await res.text();
		expect(body).toContain('href="/"');
	});
});
