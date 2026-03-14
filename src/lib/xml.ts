function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, dec) =>
			String.fromCodePoint(Number.parseInt(dec, 10)),
		)
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

export function extractTag(block: string, tag: string): string {
	const t = escapeRegExp(tag);
	const match = new RegExp(
		`<${t}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${t}>`,
	).exec(block);
	if (!match) return "";
	return match[1] ?? match[2] ?? "";
}

export function extractAttr(block: string, tag: string, attr: string): string {
	const t = escapeRegExp(tag);
	const a = escapeRegExp(attr);
	const match = new RegExp(`<${t}[^>]*${a}="([^"]*)"`, "i").exec(block);
	return match ? match[1] : "";
}
