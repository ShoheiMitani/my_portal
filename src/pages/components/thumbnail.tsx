/** @jsxImportSource react */

export function Thumbnail({
	src,
	classPrefix,
}: {
	src: string;
	classPrefix: string;
}) {
	if (src) {
		return (
			<img
				className={`${classPrefix}-thumbnail`}
				src={src}
				alt=""
				loading="lazy"
			/>
		);
	}
	return <div className={`${classPrefix}-thumbnail-placeholder`} />;
}
