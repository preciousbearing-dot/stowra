/** Placeholder replaced by the real connection engine in the AI stage. */
export function createAi() { return { ready: () => false, summarise: async () => { throw new Error('AI not connected'); } }; }
