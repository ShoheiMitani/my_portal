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
		{
			name: "mock-cloudflare-protocol",
			enforce: "pre",
			resolveId(id) {
				if (id.startsWith("cloudflare:")) {
					return `\0${id}`;
				}
			},
			load(id) {
				if (id.startsWith("\0cloudflare:")) {
					return "export class DurableObject {}; export class WorkerEntrypoint {}; export class RpcTarget {}; export class WorkflowEntrypoint {};";
				}
			},
		},
	],
	test: {
		server: {
			deps: {
				inline: [/.*/],
			},
		},
	},
});
