import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "hono/jsx",
		target: "es2022",
	},
	plugins: [
		react({
			include: ["src/pages/**/*.tsx"],
		}),
		cloudflare(),
		{
			name: "yml-raw",
			transform(_code, id) {
				if (id.endsWith(".yml") || id.endsWith(".yaml")) {
					const content = readFileSync(id, "utf-8");
					return `export default ${JSON.stringify(content)};`;
				}
			},
		},
	],
});
