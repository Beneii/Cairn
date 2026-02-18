export const FailureCode = {
    CAPABILITY_MISSING: "CAPABILITY_MISSING",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED",
};
export function withFailureCode(code, message) {
    return `${code}: ${message}`;
}
export function parseFailureMessage(message) {
    const match = message.match(/^([A-Z_]+):\s*(.*)$/);
    if (!match)
        return { message };
    const code = match[1];
    if (!Object.values(FailureCode).includes(code))
        return { message };
    return { code, message: match[2] || "" };
}
//# sourceMappingURL=errors.js.map