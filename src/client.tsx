/** @jsxImportSource react */
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { TopPage } from "./pages/top";
import { WorksPage } from "./pages/works";
import { TalksPage } from "./pages/talks";
import { ChatPage } from "./pages/chat";
import { TrendsPage } from "./pages/trends";

const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<TopPage />} />
				<Route path="/works" element={<WorksPage />} />
				<Route path="/talks" element={<TalksPage />} />
				<Route path="/chat" element={<ChatPage />} />
				<Route path="/trends" element={<TrendsPage />} />
			</Routes>
		</BrowserRouter>,
	);
}
