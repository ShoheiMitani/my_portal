import type { FC } from "hono/jsx";

export const Thumbnail: FC<{
	src: string;
	classPrefix: string;
}> = ({ src, classPrefix }) =>
	src ? (
		<img class={`${classPrefix}-thumbnail`} src={src} alt="" loading="lazy" />
	) : (
		<div class={`${classPrefix}-thumbnail-placeholder`} />
	);
