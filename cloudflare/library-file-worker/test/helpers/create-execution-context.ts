export interface TestExecutionContext {
  context: ExecutionContext;
  pendingPromises: Promise<unknown>[];
}

/**
 * Shared, strongly-typed ExecutionContext factory for worker tests.
 * Compatible with ExecutionContext definition in worker-configuration.d.ts.
 */
export function createExecutionContext(): TestExecutionContext {
  const pendingPromises: Promise<unknown>[] = [];
  const context: ExecutionContext = {
    waitUntil(promise: Promise<unknown>): void {
      pendingPromises.push(promise);
    },
  };
  return { context, pendingPromises };
}
