import type { ToolSet } from "@repo/ai";
import type { ToolContext } from "./types";

export class ToolRegistry {
	private builtinTools: Map<string, ToolSet[string]> = new Map();

	registerBuiltin(tools: ToolSet): void {
		for (const [name, t] of Object.entries(tools)) {
			this.builtinTools.set(name, t);
		}
	}

	getTools(_context: ToolContext): ToolSet {
		const result: ToolSet = {};
		for (const [name, t] of this.builtinTools) {
			result[name] = t;
		}
		return result;
	}

	getToolNames(): string[] {
		return [...this.builtinTools.keys()];
	}
}
