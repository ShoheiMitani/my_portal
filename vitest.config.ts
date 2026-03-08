import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
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
