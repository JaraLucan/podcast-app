/**
 * Minimal error reporting (PRD §8). Always logs to the console; if SENTRY_DSN is
 * set and `@sentry/node` is installed, forwards there too. Dependency-free —
 * the SDK is imported lazily via a variable specifier so the build doesn't
 * require it. Install `@sentry/node` and set SENTRY_DSN to enable.
 */
let sentry: { captureException: (e: unknown) => void } | null = null;
let initialized = false;

async function ensureSentry() {
  if (initialized) return sentry;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const pkg = "@sentry/node";
    const mod = await import(pkg);
    mod.init({ dsn, tracesSampleRate: 0 });
    sentry = mod;
  } catch {
    sentry = null;
  }
  return sentry;
}

export async function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("[error]", message, context ?? "");
  const s = await ensureSentry();
  s?.captureException(error);
}
