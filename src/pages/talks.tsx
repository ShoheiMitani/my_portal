/** @jsxImportSource react */
import { parse as parseYaml } from "yaml";
import { ListPageLayout } from "./components/list-layout";
import { Thumbnail } from "./components/thumbnail";
import { talksPageStyles } from "../styles/talks";
import type { TalkEntry } from "../types";
import talksYml from "../talks.yml";

const talks: TalkEntry[] = [...(parseYaml(talksYml) as TalkEntry[])].sort(
	(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
);

function TalkItem({ talk: t }: { talk: TalkEntry }) {
	return (
		<a className="talk" href={t.link} target="_blank" rel="noopener noreferrer">
			<Thumbnail src={t.thumbnail} classPrefix="talk" />
			<div className="talk-body">
				<span className="talk-event">{t.event}</span>
				<span className="talk-title">{t.title}</span>
				<span className="talk-date">{t.date}</span>
			</div>
		</a>
	);
}

export function TalksPage() {
	return (
		<ListPageLayout title="Talks" styles={talksPageStyles}>
			{talks.map((t, i) => {
				const year = new Date(t.date).getFullYear();
				const prevYear =
					i > 0 ? new Date(talks[i - 1].date).getFullYear() : null;
				return (
					<div key={t.link}>
						{year !== prevYear && <div className="year-separator">{year}</div>}
						<TalkItem talk={t} />
					</div>
				);
			})}
		</ListPageLayout>
	);
}
