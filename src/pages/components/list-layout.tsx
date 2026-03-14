/** @jsxImportSource react */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { BackIcon } from "./back-icon";

export function ListPageLayout({
	title,
	styles,
	children,
}: {
	title: string;
	styles: string;
	children: ReactNode;
}) {
	return (
		<>
			<style>{styles}</style>
			<div className="container">
				<div className="header">
					<Link className="back-link" to="/" aria-label="Back">
						<BackIcon />
					</Link>
					<h1 className="page-title">{title}</h1>
				</div>
				{children}
			</div>
		</>
	);
}
