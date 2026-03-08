import { resetStyles } from "./base";

export const topPageStyles = `${resetStyles}
body {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 100vh;
}
.container {
	text-align: center;
	padding: 2rem;
}
.avatar {
	width: 160px;
	height: 160px;
	border-radius: 50%;
	object-fit: cover;
	margin-bottom: 1rem;
}
.name {
	font-size: 1.5rem;
	font-weight: bold;
	font-family: monospace;
	margin-bottom: 1.5rem;
	color: #333;
}
.card {
	background: white;
	border-radius: 16px;
	padding: 2rem;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	max-width: 400px;
	margin: 0 auto;
}
.bio {
	font-size: 1.1rem;
	color: #333;
	margin-bottom: 1.5rem;
}
.links {
	display: flex;
	justify-content: center;
	gap: 1rem;
}
.links a {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 48px;
	height: 48px;
	border-radius: 12px;
	border: 1.5px solid #e0e0e0;
	text-decoration: none;
	color: #333;
	transition: background-color 0.2s, border-color 0.2s;
}
.links a:hover {
	background-color: #f0f0f0;
	border-color: #ccc;
}
.links a svg {
	width: 24px;
	height: 24px;
}
.menu-toggle {
	position: fixed;
	top: 1rem;
	right: 1rem;
	width: 40px;
	height: 40px;
	border: 1.5px solid #e0e0e0;
	border-radius: 10px;
	background: white;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 100;
	transition: background-color 0.2s;
}
.menu-toggle:hover {
	background-color: #f0f0f0;
}
.menu-toggle span {
	display: block;
	width: 18px;
	height: 2px;
	background: #333;
	position: relative;
}
.menu-toggle span::before,
.menu-toggle span::after {
	content: "";
	display: block;
	width: 18px;
	height: 2px;
	background: #333;
	position: absolute;
}
.menu-toggle span::before { top: -6px; }
.menu-toggle span::after { top: 6px; }
.menu-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.3);
	z-index: 90;
	opacity: 0;
	visibility: hidden;
	transition: opacity 0.2s, visibility 0.2s;
}
.menu-overlay.open { opacity: 1; visibility: visible; }
.menu-drawer {
	position: fixed;
	top: 0;
	right: -260px;
	width: 260px;
	height: 100%;
	background: white;
	z-index: 95;
	padding: 4rem 1.5rem 2rem;
	box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
	transition: right 0.25s ease;
}
.menu-drawer.open { right: 0; }
.menu-drawer a {
	display: block;
	padding: 0.75rem 0;
	text-decoration: none;
	color: #333;
	font-size: 1rem;
	border-bottom: 1px solid #f0f0f0;
	transition: color 0.2s;
}
.menu-drawer a:hover { color: #666; }`;
