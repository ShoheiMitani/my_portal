export function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const hours = Math.floor(diff / (1000 * 60 * 60));
	if (hours < 1) return "1時間以内";
	if (hours < 24) return `${hours}時間前`;
	const days = Math.floor(hours / 24);
	return `${days}日前`;
}
