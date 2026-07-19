/** @jsxImportSource react */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { BackIcon } from "./back-icon";

export function ListPageLayout({
	title,
	styles,
	onBack,
	children,
}: {
	title: string;
	styles: string;
	onBack?: () => void;
	children: ReactNode;
}) {
	return (
		<>
			<style>{styles}</style>
			<div className="container">
				<div className="header">
					{onBack ? (
						<button
							type="button"
							className="back-link"
							onClick={onBack}
							aria-label="Back"
						>
							<BackIcon />
						</button>
					) : (
						<Link className="back-link" to="/" aria-label="Back">
							<BackIcon />
						</Link>
					)}
					<h1 className="page-title">{title}</h1>
				</div>
				{children}
			</div>
		</>
	);
}
