import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline as streamPipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";

import Groq from "groq-sdk";

import type { TranscriptSegment, TranscriptSource } from "@/lib/types/database";

import { assertPublicHttpUrl } from "./net";

const GROQ_MODEL = process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3";
// Bias Whisper toward correct spelling of common tech/finance proper nouns and
// tickers (council: garbage names/tickers → confident LLM nonsense). ≤224 tokens.
const VOCAB_PROMPT =
  "Tech and finance podcast. Likely terms: AI, LLM, GPU, Nvidia, OpenAI, " +
  "Anthropic, Chamath Palihapitiya, Jason Calacanis, Bill Gurley, capex, " +
  "valuation, ARR, IPO, SPAC, basis points, NASDAQ, S&P 500, Fed, tickers " +
  "like NVDA, MSFT, AAPL, GOOGL, TSLA.";
const GROQ_USD_PER_HOUR = 0.111; // whisper-large-v3 pricing
const MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024; // PRD cap
const GROQ_MAX_BYTES = 24 * 1024 * 1024; // single-request ceiling; chunk above this
const CHUNK_SECONDS = 20 * 60;
const OVERLAP_SECONDS = 5;

export type TranscriptResult = {
  source: TranscriptSource;
  segments: TranscriptSegment[];
  fullText: string;
  wordCount: number;
  costUsd: number;
};

function hasBinary(bin: string): boolean {
  const res = spawnSync(bin, ["-version"], { stdio: "ignore" });
  return res.status === 0;
}

async function downloadToTemp(url: string, dir: string): Promise<string> {
  assertPublicHttpUrl(url); // SSRF guard — url comes from third-party RSS
  const res = await fetch(url, {
    headers: { "User-Agent": "PodBrief/1.0" },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Audio download failed (${res.status}) for ${url}`);
  }
  const path = join(dir, "audio");
  await streamPipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(path),
  );
  const { size } = await stat(path);
  if (size > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Audio too large: ${(size / 1e6).toFixed(0)}MB`);
  }
  return path;
}

function ffprobeDuration(path: string): number | null {
  const res = spawnSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  if (res.status !== 0) return null;
  const secs = parseFloat(res.stdout.toString().trim());
  return Number.isFinite(secs) ? secs : null;
}

/** Split audio into ~CHUNK_SECONDS slices (with overlap) using ffmpeg. */
function chunkWithFfmpeg(
  path: string,
  dir: string,
  durationSec: number,
): { path: string; offsetSec: number }[] {
  const chunks: { path: string; offsetSec: number }[] = [];
  let start = 0;
  let i = 0;
  while (start < durationSec) {
    const out = join(dir, `chunk-${i}.mp3`);
    const res = spawnSync("ffmpeg", [
      "-y",
      "-ss",
      String(start),
      "-t",
      String(CHUNK_SECONDS + OVERLAP_SECONDS),
      "-i",
      path,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      out,
    ]);
    if (res.status !== 0) {
      throw new Error(`ffmpeg chunk failed: ${res.stderr?.toString().slice(0, 300)}`);
    }
    chunks.push({ path: out, offsetSec: start });
    start += CHUNK_SECONDS;
    i++;
  }
  return chunks;
}

type GroqSegment = { start: number; end: number; text: string };

async function transcribeFile(
  groq: Groq,
  path: string,
): Promise<{ segments: GroqSegment[]; text: string }> {
  const res = await groq.audio.transcriptions.create({
    file: createReadStream(path),
    model: GROQ_MODEL,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    prompt: VOCAB_PROMPT,
  });
  // verbose_json shape — validate, don't trust (Groq may omit/null segments).
  const data = res as unknown as { text?: unknown; segments?: unknown };
  const segments: GroqSegment[] = Array.isArray(data.segments)
    ? (data.segments as unknown[]).filter(
        (s): s is GroqSegment =>
          !!s &&
          typeof (s as GroqSegment).text === "string" &&
          typeof (s as GroqSegment).start === "number" &&
          typeof (s as GroqSegment).end === "number",
      )
    : [];
  return { segments, text: typeof data.text === "string" ? data.text : "" };
}

export async function transcribeWithGroq(
  audioUrl: string,
): Promise<TranscriptResult> {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
  const groq = new Groq();
  const dir = await mkdtemp(join(tmpdir(), "podbrief-"));

  try {
    const audioPath = await downloadToTemp(audioUrl, dir);
    const { size } = await stat(audioPath);

    let segments: TranscriptSegment[] = [];

    if (size <= GROQ_MAX_BYTES) {
      const { segments: segs } = await transcribeFile(groq, audioPath);
      segments = segs;
    } else {
      // Too big for one request — needs ffmpeg to chunk.
      if (!hasBinary("ffmpeg") || !hasBinary("ffprobe")) {
        throw new Error(
          `Audio is ${(size / 1e6).toFixed(0)}MB (> ${(GROQ_MAX_BYTES / 1e6).toFixed(0)}MB). Install ffmpeg/ffprobe to transcribe long episodes.`,
        );
      }
      const duration = ffprobeDuration(audioPath) ?? CHUNK_SECONDS;
      const chunks = chunkWithFfmpeg(audioPath, dir, duration);
      for (const chunk of chunks) {
        const { segments: segs } = await transcribeFile(groq, chunk.path);
        for (const s of segs) {
          const start = s.start + chunk.offsetSec;
          // Drop segments that fall inside the previous chunk's overlap window.
          if (chunk.offsetSec > 0 && start < chunk.offsetSec + OVERLAP_SECONDS) {
            continue;
          }
          segments.push({ start, end: s.end + chunk.offsetSec, text: s.text });
        }
      }
    }

    const fullText = segments.map((s) => s.text.trim()).join(" ").trim();
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const lastEnd = segments.at(-1)?.end ?? 0;
    const costUsd =
      Math.round((lastEnd / 3600) * GROQ_USD_PER_HOUR * 1e6) / 1e6;

    return { source: "groq", segments, fullText, wordCount, costUsd };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type DeepgramResponse = {
  metadata?: { duration?: number };
  results?: {
    utterances?: { start: number; end: number; transcript: string }[];
    channels?: { alternatives?: { transcript?: string }[] }[];
  };
};

const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL ?? "nova-2";
const DEEPGRAM_USD_PER_HOUR = 0.258; // nova-2 pre-recorded, approx

/**
 * Deepgram transcription via remote-URL ingestion — no download or ffmpeg
 * needed, and it returns speaker-friendly utterances with timestamps. Enable
 * with TRANSCRIPTION_PROVIDER=deepgram (PRD §5.2).
 */
export async function transcribeWithDeepgram(
  audioUrl: string,
): Promise<TranscriptResult> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set");
  assertPublicHttpUrl(audioUrl); // SSRF guard — Deepgram will fetch this URL

  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    smart_format: "true",
    punctuate: "true",
    utterances: "true",
  });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });
  if (!res.ok) {
    throw new Error(`Deepgram failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as DeepgramResponse;
  const utterances = data.results?.utterances ?? [];
  const segments: TranscriptSegment[] = utterances.map((u) => ({
    start: u.start,
    end: u.end,
    text: u.transcript,
  }));

  const fullText =
    segments.map((s) => s.text.trim()).join(" ").trim() ||
    (data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const duration = data.metadata?.duration ?? segments.at(-1)?.end ?? 0;
  const costUsd =
    Math.round((duration / 3600) * DEEPGRAM_USD_PER_HOUR * 1e6) / 1e6;

  return { source: "deepgram", segments, fullText, wordCount, costUsd };
}

/** Transcribe via the configured provider (PRD §5.2: Groq primary, Deepgram fallback). */
export async function transcribe(audioUrl: string): Promise<TranscriptResult> {
  const provider = process.env.TRANSCRIPTION_PROVIDER ?? "groq";
  return provider === "deepgram"
    ? transcribeWithDeepgram(audioUrl)
    : transcribeWithGroq(audioUrl);
}

/** Build a Taddy-sourced transcript from pre-supplied segments (free). */
export function transcriptFromSegments(
  segments: TranscriptSegment[],
  source: TranscriptSource = "taddy",
): TranscriptResult {
  const fullText = segments.map((s) => s.text.trim()).join(" ").trim();
  return {
    source,
    segments,
    fullText,
    wordCount: fullText.split(/\s+/).filter(Boolean).length,
    costUsd: 0,
  };
}

/** Render segments as `[seconds] text` lines for the extraction prompt. */
export function renderTranscriptForPrompt(
  segments: TranscriptSegment[],
  fullText: string,
): string {
  if (segments.length === 0) return fullText;
  return segments
    .map((s) => `[${Math.round(s.start)}] ${s.text.trim()}`)
    .join("\n");
}
