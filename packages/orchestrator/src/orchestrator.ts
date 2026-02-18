/**
 * Orchestrator V2 — Cairn V2
 * 
 * Deterministic core control plane.
 * Pipeline: Ingress → Pre-Router → Classifier → Contract Builder →
 *   Skill Dispatcher / Planner → Executor → Response Composer → Output
 * 
 * LLMs are advisory. Final authority is deterministic code.
 */

import { bus, newId, now, shortTime, redactError } from "@cairn/shared";
import type { Job, Artifact, CairnMessage, PipelineTrace, FailureStatus, ActionContract, ChatAttachment } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { hotSet, warmGet, warmSet, queueForPromotion } from "@cairn/memory";

// V2 Pipeline layers
import { preRoute } from "./pre-router.js";
import { extractSkillArgs } from "./pre-router.js";
import { classifyIntent } from "./classifier.js";
import { buildContract } from "./contract-builder.js";
import { ensureSkillRegistry } from "./skill-registry.js";
import { executeSingleSkill, executePlan } from "./nodes/executor-v2.js";
import { createPlan } from "./nodes/planner-v2.js";
import { evaluateExecutionOutcome } from "./evaluator.js";
import {
  composeDirectResponse,
  composeSkillResponse,
  composePlanResponse,
  composeClarification,
  composeErrorResponse,
} from "./response-composer.js";

// ---- Helpers ----

function captureRecentTask(messageId: string, input: string): void {
  try {
    const recent = warmGet("recent_tasks") || [];
    const tasks = Array.isArray(recent) ? recent : [];
    const updated = [
      { input, timestamp: now() },
      ...tasks.slice(0, 9),
    ];
    warmSet("recent_tasks", updated);
  } catch (err) {
    console.error("[orchestrator-v2] Failed to capture recent task:", err);
  }
}

function appendChatHistory(userInput: string, aiResponse: string): void {
  try {
    const history = warmGet<{ role: string; content: string }[]>("chat_history") || [];
    const updated = [
      ...history,
      { role: "user", content: userInput },
      { role: "assistant", content: aiResponse },
    ].slice(-20);
    warmSet("chat_history", updated);
  } catch (err) {
    console.error("[orchestrator-v2] Failed to append history:", err);
  }
}

function emitResponse(text: string, tools?: string[]): void {
  bus.emit("chat:message", {
    id: newId(),
    role: "cairn",
    text,
    timestamp: shortTime(),
    tools,
  });
}

// ---- V2 Pipeline ----

export async function processMessage(userInput: string, attachments?: ChatAttachment[]): Promise<void> {
  const startTime = Date.now();
  const messageId = newId();

  // Initialize pipeline trace
  const trace: Partial<PipelineTrace> = {
    messageId,
    totalCostUsd: 0,
  };

  try {
    // Ensure skills are registered
    await ensureSkillRegistry();

    bus.emit("nucleus:state", "thinking");

    // ====== STEP 1: Pre-Router (Deterministic) ======
    const preRouteDecision = preRoute(userInput);
    trace.preRouteDecision = preRouteDecision;

    await appendEntry("agent", "pre-router", messageId, `Route: ${preRouteDecision.route} | Reason: ${preRouteDecision.reason}`);

    // Handle DIRECT routes
    if (preRouteDecision.route === "DIRECT") {
      // Check if this is a direct skill invocation
      if (preRouteDecision.lockedIntent && preRouteDecision.lockedIntent.includes(".")) {
        const skillId = preRouteDecision.lockedIntent;
        const args = extractSkillArgs(userInput, skillId) || {};

        bus.emit("nucleus:state", "tooling");

        const stepResult = await executeSingleSkill(skillId, args, messageId);
        const evaluation = await evaluateExecutionOutcome({
          messageId,
          userInput,
          steps: [{ skillId, success: stepResult.success, output: stepResult.output }],
        });
        const responseTextBase = composeSkillResponse(skillId, {
          success: stepResult.success,
          output: stepResult.output,
        }, args);
        const responseText = evaluation.note ? `${responseTextBase}

${evaluation.note}` : responseTextBase;

        trace.executionTrace = [{ skillId, durationMs: stepResult.durationMs, success: stepResult.success, confidence: stepResult.confidence }];
        trace.finalStatus = stepResult.success ? "SUCCESS" : "INFRASTRUCTURE_FAIL";

        emitResponse(responseText, [skillId]);
        appendChatHistory(userInput, responseText);
        captureRecentTask(messageId, userInput);
      } else {
        // Pure direct response (greeting, emoji, etc.)
        const responseText = composeDirectResponse(preRouteDecision.directResponse, "SUCCESS");
        trace.finalStatus = "SUCCESS";

        emitResponse(responseText);
        appendChatHistory(userInput, responseText);
      }

      finishPipeline(trace, startTime);
      return;
    }

    // ====== STEP 2: LLM Intent Classifier (Advisory) ======
    bus.emit("nucleus:state", "thinking", [
      { id: newId(), name: "Classifier", action: "Classifying intent", model: "gpt-4o-mini" },
    ]);

    const classifierResult = await classifyIntent(userInput);
    trace.classifierOutput = classifierResult.classification || undefined;
    trace.totalCostUsd = (trace.totalCostUsd || 0) + classifierResult.cost_usd;

    await appendEntry("agent", "classifier", messageId,
      `Status: ${classifierResult.status} | Intent: ${classifierResult.classification?.intent || "unknown"} | Action: ${classifierResult.classification?.recommendedAction || "none"}`);

    // Handle classifier failures
    if (classifierResult.status !== "SUCCESS" || !classifierResult.classification) {
      const responseText = composeErrorResponse(classifierResult.status as FailureStatus);
      trace.finalStatus = classifierResult.status as FailureStatus;

      emitResponse(responseText);
      appendChatHistory(userInput, responseText);
      finishPipeline(trace, startTime);
      return;
    }

    // ====== STEP 3: Action Contract Builder (Deterministic Gate) ======
    const contractResult = buildContract(classifierResult.classification);
    trace.actionContract = contractResult.contract;

    await appendEntry("agent", "contract-builder", messageId,
      `Action: ${contractResult.contract.actionType} | Skill: ${contractResult.contract.skillId || "none"} | Status: ${contractResult.status}`);

    // Handle contract failures
    if (contractResult.status !== "SUCCESS") {
      let responseText = composeErrorResponse(contractResult.status);
      trace.finalStatus = contractResult.status;

      if (contractResult.status === "SKILL_NOT_FOUND") {
        const evaluation = await evaluateExecutionOutcome({
          messageId,
          userInput,
          steps: [{ skillId: contractResult.contract.skillId || "unknown", success: false, output: "Skill not found" }],
        });
        if (evaluation.note) {
          responseText = `${responseText}

${evaluation.note}`;
        }
      }

      emitResponse(responseText);
      appendChatHistory(userInput, responseText);
      finishPipeline(trace, startTime);
      return;
    }

    // Handle clarification needed
    if (contractResult.clarificationNeeded) {
      const responseText = composeClarification(contractResult.clarificationNeeded);
      trace.finalStatus = "SUCCESS";

      emitResponse(responseText);
      appendChatHistory(userInput, responseText);
      finishPipeline(trace, startTime);
      return;
    }

    // ====== STEP 4: Dispatch ======

    if (contractResult.contract.actionType === "none") {
      // No action — compose a conversational response via LLM
      const responseText = await composeConversationalResponse(userInput, classifierResult.classification.intent);
      trace.finalStatus = "SUCCESS";

      emitResponse(responseText);
      appendChatHistory(userInput, responseText);
      finishPipeline(trace, startTime);
      return;
    }

    if (contractResult.contract.actionType === "skill") {
      // ====== DIRECT SKILL EXECUTION ======
      const skillId = contractResult.contract.skillId!;
      const args = contractResult.contract.arguments || {};

      bus.emit("nucleus:state", "tooling", [
        { id: newId(), name: "Executor", action: `Running ${skillId}`, model: "deterministic" },
      ]);

      const stepResult = await executeSingleSkill(skillId, args, messageId);
      const evaluation = await evaluateExecutionOutcome({
        messageId,
        userInput,
        steps: [{ skillId, success: stepResult.success, output: stepResult.output }],
      });
      const responseTextBase = composeSkillResponse(skillId, {
        success: stepResult.success,
        output: stepResult.output,
      }, args);
      const responseText = evaluation.note ? `${responseTextBase}

${evaluation.note}` : responseTextBase;

      trace.executionTrace = [{ skillId, durationMs: stepResult.durationMs, success: stepResult.success, confidence: stepResult.confidence }];
      trace.finalStatus = stepResult.success ? "SUCCESS" : "INFRASTRUCTURE_FAIL";

      emitResponse(responseText, [skillId]);
      appendChatHistory(userInput, responseText);
      captureRecentTask(messageId, userInput);
      finishPipeline(trace, startTime);
      return;
    }

    if (contractResult.contract.actionType === "plan") {
      // ====== PLANNER + MULTI-STEP EXECUTION ======
      bus.emit("nucleus:state", "thinking", [
        { id: newId(), name: "Planner", action: "Creating execution plan", model: "gpt-4o-mini" },
      ]);

      const planResult = await createPlan(contractResult.contract, userInput);
      trace.totalCostUsd = (trace.totalCostUsd || 0) + planResult.cost_usd;

      if (!planResult.plan) {
        // Planner couldn't compose a solution — fall back to conversational response
        // but also create a skill request so Cairn can learn
        const evaluation = await evaluateExecutionOutcome({
          messageId,
          userInput,
          steps: [{ skillId: contractResult.contract.skillId || "plan", success: false, output: planResult.error || "No valid plan could be composed" }],
        });

        // Instead of just saying "I couldn't create a plan", try to help conversationally
        const fallbackResponse = await composeConversationalResponse(userInput, classifierResult.classification.intent);
        const responseText = evaluation.note
          ? `${fallbackResponse}\n\n_${evaluation.note}_`
          : fallbackResponse;
        trace.finalStatus = "SUCCESS"; // We still helped, just not via tools

        emitResponse(responseText);
        appendChatHistory(userInput, responseText);
        finishPipeline(trace, startTime);
        return;
      }

      trace.plannerOutput = planResult.plan;

      await appendEntry("agent", "planner-v2", messageId,
        `Plan: ${planResult.plan.steps.length} steps, max ${planResult.plan.maxToolCalls} calls, risk: ${planResult.plan.riskLevel}`);

      // Execute the plan
      bus.emit("nucleus:state", "tooling", [
        { id: newId(), name: "Executor", action: `Executing ${planResult.plan.steps.length}-step plan`, model: "deterministic" },
      ]);

      const execResult = await executePlan(planResult.plan, messageId);

      trace.executionTrace = execResult.steps.map((s) => ({
        skillId: s.skillId,
        durationMs: s.durationMs,
        success: s.success,
        confidence: s.confidence,
      }));

      const responseTextBase = await composePlanResponse(
        planResult.plan,
        execResult.steps.map((s) => ({
          skillId: s.skillId,
          result: { success: s.success, output: s.output },
        })),
      );

      const evaluation = await evaluateExecutionOutcome({
        messageId,
        userInput,
        steps: execResult.steps.map((s) => ({ skillId: s.skillId, success: s.success, output: s.output })),
      });
      const responseText = evaluation.note ? `${responseTextBase}

${evaluation.note}` : responseTextBase;

      trace.finalStatus = execResult.allSuccess ? "SUCCESS" : "INFRASTRUCTURE_FAIL";

      const tools = execResult.steps.map((s) => s.skillId);
      emitResponse(responseText, tools);
      appendChatHistory(userInput, responseText);
      captureRecentTask(messageId, userInput);
      finishPipeline(trace, startTime);
      return;
    }
  } catch (err) {
    const rawError = err instanceof Error ? err.message : String(err);
    const redacted = redactError(err);

    console.error("[orchestrator-v2] Pipeline error:", rawError);

    trace.finalStatus = "INFRASTRUCTURE_FAIL";

    bus.emit("nucleus:state", "error");
    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "error",
      content: `Pipeline error: ${redacted}`,
    });

    emitResponse(`I encountered an error: ${redacted}`);
    appendChatHistory(userInput, `Error: ${redacted}`);
    finishPipeline(trace, startTime);

    setTimeout(() => bus.emit("nucleus:state", "idle"), 3000);
  }
}

// ---- Pipeline Finish ----

function captureReflection(trace: Partial<PipelineTrace>): void {
  try {
    const reflection = {
      messageId: trace.messageId,
      timestamp: now(),
      status: trace.finalStatus,
      latencyMs: trace.totalLatencyMs || 0,
      costUsd: trace.totalCostUsd || 0,
      route: trace.preRouteDecision?.route || "unknown",
      intent: trace.classifierOutput?.intent || "unknown",
      skills: (trace.executionTrace || []).map((s) => ({
        skillId: s.skillId,
        success: s.success,
        durationMs: s.durationMs,
        confidence: s.confidence,
      })),
    };

    // HOT tier: latest working memory for live runtime awareness
    hotSet("working:last_reflection", reflection, 30 * 60 * 1000);

    // WARM tier: rolling episodic journal
    const journal = warmGet<any[]>("reflection_journal") || [];
    const nextJournal = [reflection, ...journal].slice(0, 200);
    warmSet("reflection_journal", nextJournal);

    // WARM tier: compact traces for supervisor/perf snapshots (includes skillId for per-skill reliability)
    const stepTraces = (trace.executionTrace || []).map((s) => ({
      skillId: s.skillId,
      success: s.success,
      durationMs: s.durationMs,
    }));
    if (stepTraces.length > 0) {
      const previous = warmGet<any[]>("orchestrator_recent_traces") || [];
      warmSet("orchestrator_recent_traces", [...stepTraces, ...previous].slice(0, 300));
    }

    // COLD tier hook: queue promotion for high-signal reflections
    const shouldPromote =
      trace.finalStatus !== "SUCCESS" ||
      (trace.totalLatencyMs || 0) > 10000 ||
      (trace.totalCostUsd || 0) > 0.05;

    if (shouldPromote && trace.messageId) {
      const summary = `Reflection ${trace.messageId}: status=${trace.finalStatus}; latency=${trace.totalLatencyMs}ms; cost=$${(trace.totalCostUsd || 0).toFixed(4)}; intent=${trace.classifierOutput?.intent || "unknown"}`;
      queueForPromotion({
        id: `reflection-${trace.messageId}`,
        source: "document",
        title: `Orchestrator reflection ${trace.messageId}`,
        content: summary,
        metadata: {
          messageId: trace.messageId,
          status: trace.finalStatus,
          latencyMs: trace.totalLatencyMs || 0,
          costUsd: trace.totalCostUsd || 0,
        },
      });
    }
  } catch (err) {
    console.error("[orchestrator-v2] Reflection capture failed:", err);
  }
}

function finishPipeline(trace: Partial<PipelineTrace>, startTime: number): void {
  trace.totalLatencyMs = Date.now() - startTime;
  captureReflection(trace);

  bus.emit("nucleus:state", "idle");

  // Log full trace
  bus.emit("log:entry", {
    id: newId(),
    timestamp: now(),
    type: "agent",
    content: `Pipeline complete: ${trace.finalStatus} in ${trace.totalLatencyMs}ms | Cost: $${(trace.totalCostUsd || 0).toFixed(4)}`,
  });

  appendEntry("agent", "orchestrator-v2", trace.messageId || "unknown",
    JSON.stringify({
      status: trace.finalStatus,
      latencyMs: trace.totalLatencyMs,
      costUsd: trace.totalCostUsd,
      route: trace.preRouteDecision?.route,
      intent: trace.classifierOutput?.intent,
      action: trace.actionContract?.actionType,
      skills: trace.executionTrace?.map((e: { skillId: string; durationMs: number; success: boolean }) => e.skillId),
    }),
  ).catch(() => { });
}

// ---- Conversational Response (for "none" action type) ----

async function composeConversationalResponse(userInput: string, intent: string): Promise<string> {
  try {
    const { callLLM } = await import("./llm.js");
    const { isLLMAvailable } = await import("./llm.js");

    if (!isLLMAvailable()) {
      return "I understand, but I'm not sure how to help with that right now. Try asking something more specific?";
    }

    // Get chat history for context
    const history = warmGet<{ role: string; content: string }[]>("chat_history") || [];
    const recentHistory = history.slice(-10);

    const response = await callLLM(
      {
        model: "gpt-4o-mini",
        systemPrompt: `You are Cairn, a personal AI assistant. Your name is Cairn — never refer to yourself by your model name or architecture (e.g. Phi, GPT, LLaMA). If asked what you are, say you are Cairn. Only discuss your model architecture if the user explicitly asks about it.

Be conversational, concise, and helpful. Keep responses under 200 words unless the user asks for detail.

CRITICAL RULES:
- NEVER tell the user to go do something themselves. You are their assistant — help them directly.
- NEVER say "I can't do that" or "I don't have the ability to" or "you'll need to". Instead, work with what you know.
- If the user asks you to do something, provide the CONTENT they need (draft the email, write the text, compose the message, create the plan, outline the steps, etc.) rather than telling them to do it.
- If asked to search/research something, provide your best knowledge and be transparent about your confidence level.
- You are a proactive, capable assistant. Think creatively about how to help with every request.
- If you truly cannot help, explain what you'd need to be able to help (e.g. "I'd need access to your email to send that — want me to draft it so you can copy-paste it?")`,
        userMessage: userInput,
        maxTokens: 500,
        temperature: 0.7,
        messages: [
          { role: "system", content: "You are Cairn, a personal AI assistant. Never identify yourself by your model name. Be conversational, concise, and helpful. Never tell the user to do things themselves — always help directly." },
          ...recentHistory.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
          { role: "user", content: userInput },
        ],
      },
      "responder",
      "converse-" + newId().slice(0, 8),
    );

    return response.content;
  } catch {
    return "I understand, but I'm not sure how to help with that right now.";
  }
}
