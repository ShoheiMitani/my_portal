import { Hono } from "hono";
import type { FC } from "hono/jsx";
import { parse as parseYaml } from "yaml";
import { ListPageLayout } from "../components/layout";
import { Thumbnail } from "../components/thumbnail";
import { YearSeparator } from "../components/year-separator";
import { talksPageStyles } from "../styles/talks";
import type { TalkEntry } from "../types";
import talksYml from "../talks.yml";

const talksRoute = new Hono();

const talks: TalkEntry[] = parseYaml(talksYml);
talks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

const TalkItem: FC<{ talk: TalkEntry }> = ({ talk: t }) => (
	<a class="talk" href={t.link} target="_blank" rel="noopener noreferrer">
		<Thumbnail src={t.thumbnail} classPrefix="talk" />
		<div class="talk-body">
			<span class="talk-event">{t.event}</span>
			<span class="talk-title">{t.title}</span>
			<span class="talk-date">{t.date}</span>
		</div>
	</a>
);

talksRoute.get("/", (c) => {
	return c.html(
		<ListPageLayout
			title="Talks - ShoheiMitani"
			pageTitle="Talks"
			styles={talksPageStyles}
		>
			{talks.map((t, i) => {
				const year = new Date(t.date).getFullYear();
				const prevYear =
					i > 0 ? new Date(talks[i - 1].date).getFullYear() : null;
				return (
					<>
						{year !== prevYear && <YearSeparator year={year} />}
						<TalkItem talk={t} />
					</>
				);
			})}
		</ListPageLayout>,
	);
});

export default talksRoute;
