import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { initLLM } from "@cairn/orchestrator";
import { setHeartbeatInterval } from "@cairn/scheduler";
import { getProjectRoot } from "@cairn/shared";
import { isGoogleAuthenticated } from "@cairn/integrations";
import { getProactiveConfig, setProactiveConfig as setProactive, type ProactiveConfig } from "@cairn/goals";
import { getSecret, putSecret } from "@cairn/vault";

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
    putSecret("OPENAI_API_KEY", key, { description: "OpenAI API Key" });
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
    putSecret("TELEGRAM_BOT_TOKEN", token, { description: "Telegram Bot Token" });
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

export async function setProactiveConfig(config: Partial<ProactiveConfig>): Promise<void> {
    setProactive(config);
}

export async function setMobileConfig(enabled: boolean, defaultClient: "telegram" | "mobile"): Promise<void> {
    await updateEnvVar("MOBILE_APP_ENABLED", String(enabled));
    await updateEnvVar("DEFAULT_CLIENT", defaultClient);
}

export function migrateSecrets(): void {
    const keys = ["OPENAI_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID", "MOBILE_PAIRING_SECRET"];
    for (const key of keys) {
        if (!getSecret(key) && process.env[key]) {
            console.log(`[vault] Migrating ${key} to vault...`);
            putSecret(key, process.env[key] as string, { source: "env_migration" });
        }
    }
}

export function getSystemConfig() {
    // Auto-generate pairing secret if missing (in-memory only for now, or persist if needed)
    // For simplicity, we'll derive it or generate it once per process if not in env, 
    // but better to persist it. Let's persist it.
    if (!process.env.MOBILE_PAIRING_SECRET) {
        const secret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        updateEnvVar("MOBILE_PAIRING_SECRET", secret).catch(console.error);
    }

    const openaiKey = getSecret("OPENAI_API_KEY") || process.env.OPENAI_API_KEY;
    const telegramToken = getSecret("TELEGRAM_BOT_TOKEN") || process.env.TELEGRAM_BOT_TOKEN;

    return {
        heartbeat_interval_ms: Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60000),
        monthly_spend_limit_usd: Number(process.env.MONTHLY_SPEND_LIMIT_USD ?? 50),
        max_decisions_per_day: Number(process.env.MAX_DECISIONS_PER_DAY ?? 10),
        max_interactions_per_day: Number(process.env.MAX_INTERACTIONS_PER_DAY ?? 5),
        has_openai_key: !!openaiKey,
        has_telegram_token: !!telegramToken,
        telegram_admin_chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID || "",
        has_google_calendar: isGoogleAuthenticated(),
        mobile_app_enabled: process.env.MOBILE_APP_ENABLED === "true",
        default_client: (process.env.DEFAULT_CLIENT as "telegram" | "mobile") || "telegram",
        mobile_pairing_secret: process.env.MOBILE_PAIRING_SECRET,
        proactive: getProactiveConfig(),
    };
}
