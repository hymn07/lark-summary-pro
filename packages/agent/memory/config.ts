export const MEMORY_CONFIG = {
	collection: {
		inactivityTimeoutMinutes: 30,
	},
	classification: {
		model: "claude-haiku-4-5-20251001",
		maxRetries: 2,
		batchSize: 20,
	},
	discovery: {
		minEvidenceForInsight: 5,
		minUsersForProposal: 2,
		minConfidenceForProposal: 0.6,
		analysisTime: "0 0 * * *", // daily at midnight
	},
} as const;
