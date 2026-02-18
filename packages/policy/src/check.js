import { NODES, GRAPH_EDGES } from "./nodes.js";
export class PolicyViolation extends Error {
    violation;
    caller;
    target;
    detail;
    constructor(violation, caller, target, detail) {
        super(`Policy violation: ${violation} (caller=${caller}, target=${target})`);
        this.violation = violation;
        this.caller = caller;
        this.target = target;
        this.detail = detail;
        this.name = "PolicyViolation";
    }
}
export function getNodeConfig(nodeName) {
    const config = NODES[nodeName];
    if (!config)
        throw new PolicyViolation("unknown_node", "system", nodeName);
    return config;
}
export function checkCaller(caller, targetNode) {
    const config = NODES[targetNode];
    if (!config)
        throw new PolicyViolation("unknown_node", caller, targetNode);
    if (config.allowed_callers.includes("all"))
        return;
    if (!config.allowed_callers.includes(caller)) {
        throw new PolicyViolation("unauthorized_caller", caller, targetNode);
    }
}
export function checkTransition(from, to) {
    const edges = GRAPH_EDGES[from];
    if (!edges || !edges.includes(to)) {
        throw new PolicyViolation("forbidden_transition", from, to);
    }
}
export function checkTool(nodeName, tool, toolTier) {
    const config = NODES[nodeName];
    if (!config)
        throw new PolicyViolation("unknown_node", "system", nodeName);
    if (!config.allowed_tools.includes(tool)) {
        throw new PolicyViolation("forbidden_tool", nodeName, tool);
    }
    // Tier 3 always requires explicit approval unless in a pre-approved context
    if (toolTier === 3) {
        throw new PolicyViolation("tier_3_approval_required", nodeName, tool, "Tier 3 actions require explicit human-in-the-loop approval.");
    }
}
export function checkAllowlist(domain, allowlist) {
    if (allowlist.includes("*"))
        return;
    if (!allowlist.includes(domain)) {
        throw new PolicyViolation("domain_not_allowed", "policy", domain, `Domain ${domain} is not in the allowlist.`);
    }
}
export function checkMemoryAccess(nodeName, tier, operation) {
    const config = NODES[nodeName];
    if (!config)
        throw new PolicyViolation("unknown_node", "system", nodeName);
    if (operation === "read") {
        if (!config.memory_access.includes(tier)) {
            throw new PolicyViolation("memory_read_denied", nodeName, tier);
        }
    }
    else {
        if (!config.memory_write.includes(tier)) {
            throw new PolicyViolation("memory_write_denied", nodeName, tier);
        }
    }
}
//# sourceMappingURL=check.js.map