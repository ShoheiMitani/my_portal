import { describe, expect, it } from "vitest";
import app from "../index";

describe("GET /", () => {
	it("returns 200", async () => {
		const res = await app.request("/");
		expect(res.status).toBe(200);
	});

	it("returns HTML content type", async () => {
		const res = await app.request("/");
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("contains profile name", async () => {
		const res = await app.request("/");
		const body = await res.text();
		expect(body).toContain("ShoheiMitani");
	});

	it("contains bio", async () => {
		const res = await app.request("/");
		const body = await res.text();
		expect(body).toContain("Engineering Manager");
	});

	it("contains link to X", async () => {
		const res = await app.request("/");
		const body = await res.text();
		expect(body).toContain("https://x.com/shohei1913");
	});

	it("contains link to Hatena Blog", async () => {
		const res = await app.request("/");
		const body = await res.text();
		expect(body).toContain("https://shohei1913.hatenablog.com/");
	});

	it("contains link to SpeakerDeck", async () => {
		const res = await app.request("/");
		const body = await res.text();
		expect(body).toContain("https://speakerdeck.com/shoheimitani");
	});

	it("contains link to company", async () => {
		const res = await app.request("/");
		const body = await res.text();
		expect(body).toContain("https://smartbank.co.jp/");
	});

	it("contains avatar image", async () => {
		const res = await app.request("/");
		const body = await res.text();
		expect(body).toContain("<img");
		expect(body).toContain("shohei1913");
	});
});
