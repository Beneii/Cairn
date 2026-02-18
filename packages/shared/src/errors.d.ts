export declare const FailureCode: {
    readonly CAPABILITY_MISSING: "CAPABILITY_MISSING";
    readonly PERMISSION_DENIED: "PERMISSION_DENIED";
    readonly TOOL_EXECUTION_FAILED: "TOOL_EXECUTION_FAILED";
};
export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode];
export declare function withFailureCode(code: FailureCode, message: string): string;
export declare function parseFailureMessage(message: string): {
    code?: FailureCode;
    message: string;
};
//# sourceMappingURL=errors.d.ts.map