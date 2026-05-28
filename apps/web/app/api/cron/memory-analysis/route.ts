import { classifyMessages, discoverPatterns } from "@repo/agent/memory";

export const maxDuration = 300;

export async function GET() {
	const results = {
		classified: 0,
		insights: 0,
		proposals: 0,
		batches: 0,
	};

	// Phase 2: Classify all pending messages (20 per batch)
	while (true) {
		const count = await classifyMessages();
		if (count === 0) break;
		results.classified += count;
		results.batches++;
	}

	// Phase 3: Discover patterns
	const discovered = await discoverPatterns();
	results.insights = discovered.insights;
	results.proposals = discovered.proposals;

	return Response.json(results);
}
