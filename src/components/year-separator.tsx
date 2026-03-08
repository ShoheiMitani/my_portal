import type { FC } from "hono/jsx";

export const YearSeparator: FC<{ year: number }> = ({ year }) => (
	<div class="year-separator">{year}</div>
);
