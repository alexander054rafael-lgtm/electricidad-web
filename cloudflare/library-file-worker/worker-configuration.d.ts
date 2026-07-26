// Normally regenerated with `wrangler types` after configuring a real binding.
// Kept deliberately minimal so Phase 1 can be type-checked before deployment.
interface R2Bucket {
  list(options?: { limit?: number; prefix?: string }): Promise<{ objects: unknown[]; truncated: boolean }>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
