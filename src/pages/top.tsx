/** @jsxImportSource react */
import { useState } from "react";
import { Link } from "react-router";
import { topPageStyles } from "../styles/top";

export function TopPage() {
	const [menuOpen, setMenuOpen] = useState(false);

	return (
		<>
			<style>{topPageStyles}</style>
			<button
				type="button"
				className="menu-toggle"
				aria-label="Menu"
				onClick={() => setMenuOpen(!menuOpen)}
			>
				<span />
			</button>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: overlay with role="presentation" is intentional */}
			<div
				className={`menu-overlay ${menuOpen ? "open" : ""}`}
				onClick={() => setMenuOpen(false)}
				role="presentation"
			/>
			<nav className={`menu-drawer ${menuOpen ? "open" : ""}`}>
				<Link to="/works" onClick={() => setMenuOpen(false)}>
					Works
				</Link>
				<Link to="/talks" onClick={() => setMenuOpen(false)}>
					Talks
				</Link>
				<Link to="/chat" onClick={() => setMenuOpen(false)}>
					Chat
				</Link>
			</nav>
			<div className="container">
				<img
					className="avatar"
					src="https://unavatar.io/x/shohei1913"
					alt="ShoheiMitani"
				/>
				<div className="name">ShoheiMitani</div>
				<div className="card">
					<div className="bio">Engineering Manager</div>
					<div className="links">
						{/* biome-ignore lint/a11y/useAnchorContent: has aria-label */}
						<a
							href="https://x.com/shohei1913"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="X"
						>
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
							</svg>
						</a>
						{/* biome-ignore lint/a11y/useAnchorContent: has aria-label */}
						<a
							href="https://shohei1913.hatenablog.com/"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Hatena Blog"
						>
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M14.21 11.68c1.2-.52 2.04-1.76 2.04-3.2 0-2.4-1.68-4.08-4.56-4.08H6v15.2h6.12c2.88 0 4.68-1.76 4.68-4.32 0-1.68-1.04-3.08-2.59-3.6zM9.6 7.2h1.44c1.2 0 1.92.64 1.92 1.68s-.72 1.68-1.92 1.68H9.6V7.2zm1.68 9.6H9.6v-3.6h1.68c1.32 0 2.04.68 2.04 1.8s-.72 1.8-2.04 1.8z" />
							</svg>
						</a>
						{/* biome-ignore lint/a11y/useAnchorContent: has aria-label */}
						<a
							href="https://speakerdeck.com/shoheimitani"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="SpeakerDeck"
						>
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M2 4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm2 0v12h16V4H4zm-1 16h18a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2z" />
							</svg>
						</a>
						{/* biome-ignore lint/a11y/useAnchorContent: has aria-label */}
						<a
							href="https://smartbank.co.jp/"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="SmartBank"
						>
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M12 2L3 7v2h18V7l-9-5zM5 10v8H3v2h18v-2h-2v-8h-2v8h-3v-8h-2v8H9v-8H7v8H5v-8z" />
							</svg>
						</a>
					</div>
				</div>
			</div>
		</>
	);
}
