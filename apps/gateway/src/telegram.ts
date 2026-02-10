import { Bot } from "grammy";
import { bus, newId, shortTime } from "@cairn/shared";
import type { ChatMessage } from "@cairn/shared";
import { isLLMAvailable, processMessage } from "@cairn/orchestrator";
import { recordMessageSource } from "./session-tracker.js";

let bot: Bot | null = null;
let activeChatIds = new Set<number>();

/**
 * Initialize Telegram bot if TELEGRAM_BOT_TOKEN is set.
 * The bot forwards messages to the orchestrator and sends responses back.
 */
export function initTelegram(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log("[telegram] No TELEGRAM_BOT_TOKEN set, skipping Telegram integration");
    return;
  }

  bot = new Bot(token);

  // Add admin chat ID if configured (no handshake needed)
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (adminChatId) {
    const chatId = Number(adminChatId);
    if (!isNaN(chatId)) {
      activeChatIds.add(chatId);
      console.log(`[telegram] Admin chat ID configured: ${chatId}`);
    }
  }

  // Handle /start command
  bot.command("start", async (ctx) => {
    activeChatIds.add(ctx.chat.id);
    await ctx.reply(
      "Hello! I'm Cairn, your AI assistant.\n\n" +
      "Send me any message and I'll help you out. " +
      "Use /status to check system status."
    );
  });

  // Handle /status command
  bot.command("status", async (ctx) => {
    const llmStatus = isLLMAvailable() ? "Online" : "Offline (no API key)";
    await ctx.reply(
      `Cairn Status:\n` +
      `• LLM: ${llmStatus}\n` +
      `• Telegram: Connected\n` +
      `• Active chats: ${activeChatIds.size}`
    );
  });

  // Handle regular messages
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;

    // Track active chats
    activeChatIds.add(chatId);

    // Record that user is messaging from Telegram
    recordMessageSource("telegram");

    // Check if LLM is available
    if (!isLLMAvailable()) {
      await ctx.reply(
        "LLM is not configured. Please set OPENAI_API_KEY in the system."
      );
      return;
    }

    // Show typing indicator
    await ctx.api.sendChatAction(chatId, "typing");

    // Broadcast user message to dashboard
    bus.emit("chat:message", {
      id: newId(),
      role: "user",
      text,
      timestamp: shortTime(),
      source: "telegram",
    } as ChatMessage);

    // Process through orchestrator
    try {
      await processMessage(text);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`Error: ${errorMsg}`);
    }
  });

  // Start the bot
  bot.start({
    onStart: (botInfo) => {
      console.log(`[telegram] Bot started: @${botInfo.username}`);
    },
  }).catch((err) => {
    console.error("[telegram] Failed to start bot:", err.message);
    // Continue running the gateway even if Telegram fails
    bot = null;
  });

  console.log("[telegram] Initializing bot...");
}

/**
 * Send a message to all active Telegram chats.
 * This is called by the broadcast system when routing logic determines
 * Telegram should receive the message.
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  if (!bot || activeChatIds.size === 0) return;

  for (const chatId of activeChatIds) {
    try {
      await bot.api.sendMessage(chatId, text);
    } catch (err) {
      console.error(`[telegram] Failed to send message to ${chatId}:`, err);
      // Remove chat if we can't send to it (e.g. blocked)
      activeChatIds.delete(chatId);
    }
  }
}

/**
 * Stop the Telegram bot gracefully.
 */
export function stopTelegram(): void {
  if (bot) {
    bot.stop();
    bot = null;
    console.log("[telegram] Bot stopped");
  }
}

/**
 * Check if Telegram is enabled.
 */
export function isTelegramEnabled(): boolean {
  return bot !== null;
}

/**
 * Get number of active Telegram chats.
 */
export function getActiveChatCount(): number {
  return activeChatIds.size;
}
