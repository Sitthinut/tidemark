import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDemoProvider, resolveOwnerProvider } from "./provider";

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "DEMO_OPENROUTER_API_KEY",
  "AI_MODELS",
  "DEMO_AI_MODELS",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe("resolveOwnerProvider", () => {
  it("returns not-ready when key is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    const p = resolveOwnerProvider();
    expect(p.ready).toBe(false);
    expect(p.model).toBeNull();
  });

  it("defaults to free → auto fallback chain", () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    delete process.env.AI_MODELS;
    const p = resolveOwnerProvider();
    expect(p.ready).toBe(true);
    expect(p.label).toBe("OpenRouter · openrouter/free → openrouter/auto");
  });

  it("honors AI_MODELS as comma-separated chain", () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.AI_MODELS = "openrouter/auto,anthropic/claude-sonnet-4.5";
    const p = resolveOwnerProvider();
    expect(p.label).toBe("OpenRouter · openrouter/auto → anthropic/claude-sonnet-4.5");
  });

  it("accepts a single-model AI_MODELS value (no fallback)", () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.AI_MODELS = "openrouter/auto";
    const p = resolveOwnerProvider();
    expect(p.label).toBe("OpenRouter · openrouter/auto");
  });
});

describe("resolveDemoProvider", () => {
  it("defaults to openrouter/free with no fallback", () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    delete process.env.DEMO_AI_MODELS;
    const p = resolveDemoProvider();
    expect(p.label).toBe("Demo · openrouter/free");
  });

  it("falls back to owner key when DEMO_OPENROUTER_API_KEY unset", () => {
    process.env.OPENROUTER_API_KEY = "sk-owner";
    delete process.env.DEMO_OPENROUTER_API_KEY;
    const p = resolveDemoProvider();
    expect(p.ready).toBe(true);
  });
});

describe("openrouter fetch wrapper", () => {
  it("does not inject `models` field for single-model chain", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.AI_MODELS = "openrouter/auto";

    let capturedBody: string | undefined;
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const p = resolveOwnerProvider();
    if (!p.model || typeof p.model === "string") throw new Error("expected model object");
    try {
      await p.model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      });
    } catch {
      // ai-sdk may post-validate the stub response; we only care about the body
    }

    expect(capturedBody).toBeDefined();
    const body = JSON.parse(capturedBody as string);
    expect(body.model).toBe("openrouter/auto");
    expect(body.models).toBeUndefined();
  });

  it("injects `models` array when chain has fallbacks", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.AI_MODELS = "openrouter/free,openrouter/auto";

    let capturedBody: string | undefined;
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const p = resolveOwnerProvider();
    if (!p.model || typeof p.model === "string") throw new Error("expected model object");
    try {
      await p.model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      });
    } catch {
      // forward
    }

    expect(capturedBody).toBeDefined();
    const body = JSON.parse(capturedBody as string);
    expect(body.model).toBe("openrouter/free");
    expect(body.models).toEqual(["openrouter/free", "openrouter/auto"]);
  });
});
