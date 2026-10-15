export async function runWebMCPTool<T>(_toolName: string, operation: () => T | Promise<T>): Promise<T> {
  return operation();
}
