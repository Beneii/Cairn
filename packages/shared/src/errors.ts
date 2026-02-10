export const FailureCode = {
  CAPABILITY_MISSING: "CAPABILITY_MISSING",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
} as const;

export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode];

export function withFailureCode(code: FailureCode, message: string): string {
  return `${code}: ${message}`;
}

export function parseFailureMessage(message: string): { code?: FailureCode; message: string } {
  const match = message.match(/^([A-Z_]+):\s*(.*)$/);
  if (!match) return { message };
  const code = match[1] as FailureCode;
  if (!Object.values(FailureCode).includes(code)) return { message };
  return { code, message: match[2] || "" };
}
