import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import type { TalkEntry } from "../types";
import talksYml from "../talks.yml";

describe("talks data", () => {
	const talks: TalkEntry[] = parseYaml(talksYml);

	it("parses talks YAML correctly", () => {
		expect(talks.length).toBeGreaterThan(0);
	});

	it("each talk has required fields", () => {
		for (const talk of talks) {
			expect(talk.title).toBeTruthy();
			expect(talk.event).toBeTruthy();
			expect(talk.date).toBeTruthy();
			expect(talk.link).toBeTruthy();
		}
	});

	it("contains known talk entries", () => {
		const titles = talks.map((t) => t.title);
		expect(titles).toContain("2重リクエスト完全攻略HANDBOOK");
		expect(titles).toContain("競馬で学ぶ機械学習の基本と実践");
	});

	it("contains known events", () => {
		const events = talks.map((t) => t.event);
		expect(events).toContain("Kaigi on Rails 2025");
		expect(events).toContain("YAPC::Fukuoka 2025");
	});
});
