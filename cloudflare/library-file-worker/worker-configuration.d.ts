// Normally regenerated with `wrangler types` after configuring a real binding.
// Kept deliberately minimal so Phase 1 can be type-checked before deployment.
interface R2Bucket {
  list(options?: { limit?: number; prefix?: string }): Promise<{ objects: unknown[]; truncated: boolean }>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
}

interface R2ObjectBody {
  size: number;
  httpMetadata?: { contentType?: string };
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
