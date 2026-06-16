/**
 * Preflight check — run after filling `.env.local`, before seeding/processing.
 * Validates env vars + live connectivity to Supabase, Groq, and/or Anthropic,
 * and confirms the migrations are applied. Reports a checklist and exits 1 if
 * anything required is broken.
 *
 *   pnpm preflight
 */
import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";

import { createServiceClient } from "@/lib/supabase/service";

config({ path: ".env.local" });

type Check = { label: string; ok: boolean; detail?: string };
const checks: Check[] = [];
const add = (label: string, ok: boolean, detail?: string) =>
  checks.push({ label, ok, detail });

const llmProvider = process.env.LLM_PROVIDER === "groq" ? "groq" : "anthropic";
const sttProvider =
  process.env.TRANSCRIPTION_PROVIDER === "deepgram" ? "deepgram" : "groq";

function checkEnv() {
  const required: [string, boolean][] = [
    ["NEXT_PUBLIC_SUPABASE_URL", true],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", true],
    ["SUPABASE_SERVICE_ROLE_KEY", true],
    ["GROQ_API_KEY", llmProvider === "groq" || sttProvider === "groq"],
    ["ANTHROPIC_API_KEY", llmProvider === "anthropic"],
    ["DEEPGRAM_API_KEY", sttProvider === "deepgram"],
  ];
  for (const [name, needed] of required) {
    if (!needed) continue;
    add(`env ${name}`, Boolean(process.env[name]), needed ? "required" : "");
  }
}

async function checkSupabase() {
  try {
    const db = createServiceClient();
    const { error } = await db
      .from("shows")
      .select("id", { count: "exact", head: true });
    if (error) {
      const missingTable = /relation .* does not exist|schema cache/i.test(
        error.message,
      );
      add(
        "Supabase connection + schema",
        false,
        missingTable
          ? "connected, but tables missing — apply supabase/migrations/*"
          : error.message,
      );
    } else {
      add("Supabase connection + schema", true);
    }
  } catch (err) {
    add("Supabase connection + schema", false, (err as Error).message);
  }
}

async function checkGroq() {
  if (llmProvider !== "groq" && sttProvider !== "groq") return;
  try {
    const groq = new Groq();
    const list = await groq.models.list();
    const ids = new Set((list.data ?? []).map((m) => m.id));

    if (llmProvider === "groq") {
      const ex = process.env.GROQ_MODEL_EXTRACT ?? "llama-3.1-8b-instant";
      const ed =
        process.env.GROQ_MODEL_EDITORIAL ?? "llama-3.3-70b-versatile";
      add(`Groq LLM model ${ex}`, ids.has(ex), ids.has(ex) ? "" : "not available");
      add(`Groq LLM model ${ed}`, ids.has(ed), ids.has(ed) ? "" : "not available");
    }
    if (sttProvider === "groq") {
      const w = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3";
      add(`Groq Whisper model ${w}`, ids.has(w), ids.has(w) ? "" : "not available");
    }
  } catch (err) {
    add("Groq API key", false, (err as Error).message);
  }
}

async function checkAnthropic() {
  if (llmProvider !== "anthropic") return;
  try {
    const client = new Anthropic();
    const model =
      process.env.ANTHROPIC_MODEL_EDITORIAL ?? "claude-sonnet-4-6";
    await client.models.retrieve(model);
    add(`Anthropic model ${model}`, true);
  } catch (err) {
    add("Anthropic API key/model", false, (err as Error).message);
  }
}

async function main() {
  checkEnv();
  // Only attempt live calls if the corresponding key is present.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) await checkSupabase();
  if (process.env.GROQ_API_KEY) await checkGroq();
  if (process.env.ANTHROPIC_API_KEY) await checkAnthropic();

  console.log("\nPodBrief preflight\n" + "─".repeat(50));
  console.log(`LLM provider: ${llmProvider}   ·   STT provider: ${sttProvider}\n`);
  for (const c of checks) {
    console.log(
      `${c.ok ? "✓" : "✗"} ${c.label}${c.detail ? `  — ${c.detail}` : ""}`,
    );
  }

  const failed = checks.filter((c) => !c.ok);
  console.log("─".repeat(50));
  if (failed.length === 0) {
    console.log("All good. Next: pnpm db:seed, then pnpm process-episode <feed>.");
    process.exit(0);
  } else {
    console.log(`${failed.length} check(s) failed — fix the ✗ rows above.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
