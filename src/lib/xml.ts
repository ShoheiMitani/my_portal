function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractTag(block: string, tag: string): string {
	const t = escapeRegExp(tag);
	const match = new RegExp(`<${t}[^>]*>([^<]*)</${t}>`).exec(block);
	return match ? match[1] : "";
}

export function extractAttr(block: string, tag: string, attr: string): string {
	const t = escapeRegExp(tag);
	const a = escapeRegExp(attr);
	const match = new RegExp(`<${t}[^>]*${a}="([^"]*)"`, "i").exec(block);
	return match ? match[1] : "";
}
