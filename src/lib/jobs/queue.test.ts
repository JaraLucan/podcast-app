import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { Database, Job } from "@/lib/types/database";

import { completeJob, enqueue, failJob } from "./queue";

type Call = {
  op: "insert" | "update" | "delete";
  table: string;
  payload?: Record<string, unknown>;
  filters: [string, unknown][];
};

/** Minimal chainable fake recording the terminal write on each query. */
function makeFakeDb() {
  const calls: Call[] = [];
  function builder(table: string) {
    const rec: Call = { op: "insert", table, filters: [] };
    const chain = {
      insert(payload: Record<string, unknown>) {
        rec.op = "insert";
        rec.payload = payload;
        calls.push(rec);
        return Promise.resolve({ error: null });
      },
      update(payload: Record<string, unknown>) {
        rec.op = "update";
        rec.payload = payload;
        return chain;
      },
      delete() {
        rec.op = "delete";
        return chain;
      },
      eq(col: string, val: unknown) {
        rec.filters.push([col, val]);
        calls.push(rec);
        return Promise.resolve({ error: null });
      },
    };
    return chain;
  }
  const db = { from: (t: string) => builder(t) };
  return { db: db as unknown as SupabaseClient<Database>, calls };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 1,
    type: "process_episode",
    payload: { episode_id: "e1" },
    status: "running",
    attempts: 0,
    run_after: new Date().toISOString(),
    locked_at: new Date().toISOString(),
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("enqueue", () => {
  it("inserts a job with type, payload, and a run_after timestamp", async () => {
    const { db, calls } = makeFakeDb();
    await enqueue(db, "process_episode", { episode_id: "abc" });
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("insert");
    expect(calls[0].table).toBe("jobs");
    expect(calls[0].payload?.type).toBe("process_episode");
    expect(calls[0].payload?.run_after).toEqual(expect.any(String));
  });
});

describe("failJob", () => {
  it("reschedules with backoff while attempts remain", async () => {
    const { db, calls } = makeFakeDb();
    await failJob(db, makeJob({ attempts: 1 }), "boom");
    const update = calls.at(-1)!;
    expect(update.op).toBe("update");
    expect(update.payload?.status).toBe("pending");
    expect(update.payload?.locked_at).toBeNull();
    // attempts=1 → 2 min backoff in the future
    const runAfter = new Date(update.payload?.run_after as string).getTime();
    expect(runAfter).toBeGreaterThan(Date.now() + 60_000);
  });

  it("marks failed once attempts are exhausted", async () => {
    const { db, calls } = makeFakeDb();
    await failJob(db, makeJob({ attempts: 3 }), "boom");
    const update = calls.at(-1)!;
    expect(update.payload?.status).toBe("failed");
    expect(update.payload?.error).toBe("boom");
  });
});

describe("completeJob", () => {
  it("marks the job done and clears the lock", async () => {
    const { db, calls } = makeFakeDb();
    await completeJob(db, 7);
    const update = calls.at(-1)!;
    expect(update.op).toBe("update");
    expect(update.payload?.status).toBe("done");
    expect(update.filters).toContainEqual(["id", 7]);
  });
});
