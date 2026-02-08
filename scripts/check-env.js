#!/usr/bin/env node

/**
 * Cairn Environment Checker
 *
 * Validates that the environment is configured correctly
 * before starting Cairn services.
 *
 * Usage: node scripts/check-env.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REQUIRED_KEYS = [];
const OPTIONAL_KEYS = [
  { key: "OPENAI_API_KEY", desc: "OpenAI API key (required for AI features)" },
  { key: "TELEGRAM_BOT_TOKEN", desc: "Telegram bot token" },
  { key: "TELEGRAM_ADMIN_CHAT_ID", desc: "Telegram admin chat ID" },
];

let warnings = 0;
let errors = 0;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg) {
  warnings++;
  console.log(`  ⚠ ${msg}`);
}
function fail(msg) {
  errors++;
  console.log(`  ✗ ${msg}`);
}

console.log("\n  Cairn Environment Check\n");

// 1. Check .env file
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  ok(`.env file found`);

  // Parse .env manually (no dependency needed)
  const envContent = fs.readFileSync(envPath, "utf-8");
  const envVars = {};
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      envVars[key] = value;
    }
  }

  // Check required keys
  for (const key of REQUIRED_KEYS) {
    if (envVars[key]) {
      ok(`${key} is set`);
    } else {
      fail(`${key} is missing (required)`);
    }
  }

  // Check optional keys
  for (const { key, desc } of OPTIONAL_KEYS) {
    if (envVars[key]) {
      ok(`${key} is set`);
    } else {
      warn(`${key} not set — ${desc}`);
    }
  }
} else {
  warn(`.env file not found at ${envPath}`);
  warn(`Copy .env.example to .env and fill in values`);
}

// 2. Check builds exist
console.log("");
const gatewayDist = path.join(ROOT, "apps/gateway/dist/index.js");
const dashboardDist = path.join(ROOT, "apps/dashboard/dist/index.html");

if (fs.existsSync(gatewayDist)) {
  ok("Gateway build found (apps/gateway/dist/)");
} else {
  warn("Gateway not built — run: pnpm build");
}

if (fs.existsSync(dashboardDist)) {
  ok("Dashboard build found (apps/dashboard/dist/)");
} else {
  warn("Dashboard not built — run: pnpm build");
}

// 3. Check truth.md (project root sanity)
const truthPath = path.join(ROOT, "truth.md");
if (fs.existsSync(truthPath)) {
  ok("truth.md found (project root valid)");
} else {
  fail("truth.md not found — are you in the Cairn project root?");
}

// 4. Print resolved URLs
console.log("");
const port = process.env.PORT || 3100;
const host = process.env.HOST || "0.0.0.0";
console.log(`  Resolved endpoints:`);
console.log(`    Gateway   → http://${host}:${port}`);
console.log(`    Health    → http://${host}:${port}/health`);
console.log(`    WebSocket → ws://${host}:${port}/ws`);
console.log(`    Dashboard → http://${host}:5173 (dev) or serve dist`);

// 5. Summary
console.log("");
if (errors > 0) {
  console.log(`  ${errors} error(s), ${warnings} warning(s). Fix errors before starting.\n`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`  ${warnings} warning(s). Cairn can start but some features may be disabled.\n`);
} else {
  console.log(`  All checks passed. Ready to start.\n`);
}
