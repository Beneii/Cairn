import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { initLLM } from "@cairn/orchestrator";
import { setHeartbeatInterval } from "@cairn/scheduler";
import { getProjectRoot } from "@cairn/shared";
import { isGoogleAuthenticated } from "@cairn/integrations";

const ENV_PATH = join(getProjectRoot(), ".env");

async function updateEnvVar(key: string, value: string): Promise<void> {
    let content = "";
    try {
        content = await readFile(ENV_PATH, "utf-8");
    } catch (err) {
        // Start fresh
    }

    let lines = content.split("\n").filter(l => l.trim() !== "");
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));

    if (index !== -1) {
        lines[index] = `${key}=${value}`;
    } else {
        lines.push(`${key}=${value}`);
    }

    await writeFile(ENV_PATH, lines.join("\n"), "utf-8");
    process.env[key] = value;
}

export async function setOpenAIKey(key: string): Promise<void> {
    await updateEnvVar("OPENAI_API_KEY", key);
    initLLM(true);
}

export async function setHeartbeat(intervalMs: number): Promise<void> {
    await updateEnvVar("HEARTBEAT_INTERVAL_MS", String(intervalMs));
    setHeartbeatInterval(intervalMs);
}

export async function setSpendLimit(limitUsd: number): Promise<void> {
    await updateEnvVar("MONTHLY_SPEND_LIMIT_USD", String(limitUsd));
}

export async function setTelegramToken(token: string): Promise<void> {
    await updateEnvVar("TELEGRAM_BOT_TOKEN", token);
    // Note: Telegram bot requires restart to pick up new token
}

export async function setTelegramAdminChatId(chatId: string): Promise<void> {
    await updateEnvVar("TELEGRAM_ADMIN_CHAT_ID", chatId);
}

export async function setDecisionLimit(limit: number): Promise<void> {
    await updateEnvVar("MAX_DECISIONS_PER_DAY", String(limit));
}

export async function setInteractionLimit(limit: number): Promise<void> {
    await updateEnvVar("MAX_INTERACTIONS_PER_DAY", String(limit));
}

export function getSystemConfig() {
    return {
        heartbeat_interval_ms: Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60000),
        monthly_spend_limit_usd: Number(process.env.MONTHLY_SPEND_LIMIT_USD ?? 50),
        max_decisions_per_day: Number(process.env.MAX_DECISIONS_PER_DAY ?? 10),
        max_interactions_per_day: Number(process.env.MAX_INTERACTIONS_PER_DAY ?? 5),
        has_openai_key: !!process.env.OPENAI_API_KEY,
        has_telegram_token: !!process.env.TELEGRAM_BOT_TOKEN,
        telegram_admin_chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID || "",
        has_google_calendar: isGoogleAuthenticated(),
    };
}
