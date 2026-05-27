#!/usr/bin/env tsx
/**
 * Lab CLI: run a single onboarding trial against a real model docs URL.
 *
 * Usage:
 *   pnpm run lab:onboard -- \
 *     --docs https://piapi.ai/docs/kling \
 *     --key xxx \
 *     --kind video \
 *     --agent-provider openai-compatible \
 *     --agent-base https://api.openai.com \
 *     --agent-model gpt-5 \
 *     --agent-key sk-...
 *
 * Or set env vars:
 *   AGENT_BASE_URL, AGENT_API_KEY, AGENT_MODEL_ID, AGENT_PROVIDER_KIND
 *
 * Output goes to docs/onboarding-trials/<timestamp>-<slug>/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runOnboardingTrial } from "../electron/ai/onboarding/agent";
import { createReporter } from "../electron/ai/onboarding/reporter";
import type { ModelKind, ProviderKind } from "../electron/ai/onboarding/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

type Args = {
  docs?: string;
  key?: string;
  kind?: ModelKind;
  agentProvider?: ProviderKind;
  agentBase?: string;
  agentModel?: string;
  agentKey?: string;
  maxSteps?: number;
  trialId?: string;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--docs": out.docs = next; i++; break;
      case "--key": out.key = next; i++; break;
      case "--kind": out.kind = next as ModelKind; i++; break;
      case "--agent-provider": out.agentProvider = next as ProviderKind; i++; break;
      case "--agent-base": out.agentBase = next; i++; break;
      case "--agent-model": out.agentModel = next; i++; break;
      case "--agent-key": out.agentKey = next; i++; break;
      case "--max-steps": out.maxSteps = Number(next); i++; break;
      case "--trial-id": out.trialId = next; i++; break;
    }
  }
  return out;
}

function readSecretArg(arg: string | undefined, envName: string): string {
  if (arg) {
    // support --key @path/to/file
    if (arg.startsWith("@")) return fs.readFileSync(arg.slice(1), "utf8").trim();
    return arg;
  }
  return process.env[envName] || "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.docs) {
    console.error("Missing --docs <url>");
    process.exit(1);
  }
  if (!args.kind) {
    console.error("Missing --kind <text|image|video|audio>");
    process.exit(1);
  }

  const userApiKey = readSecretArg(args.key, "TARGET_API_KEY");
  if (!userApiKey) {
    console.error("Missing target API key. Pass --key xxx or set TARGET_API_KEY env.");
    process.exit(1);
  }

  const agentApiKey = readSecretArg(args.agentKey, "AGENT_API_KEY");
  if (!agentApiKey) {
    console.error("Missing agent API key. Pass --agent-key xxx or set AGENT_API_KEY env.");
    process.exit(1);
  }

  const agentBaseUrl = args.agentBase || process.env.AGENT_BASE_URL || "https://api.openai.com";
  const agentModel = args.agentModel || process.env.AGENT_MODEL_ID || "gpt-4o";
  const agentProvider = (args.agentProvider || process.env.AGENT_PROVIDER_KIND || "openai-compatible") as ProviderKind;

  const trialId = args.trialId || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const trialsRoot = path.join(repoRoot, "docs", "onboarding-trials");

  const reporter = createReporter({
    trialsRoot,
    trialId,
    docsUrl: args.docs,
    targetKind: args.kind,
  });

  console.log("");
  console.log(`▶  Trial: ${trialId}`);
  console.log(`   Docs:  ${args.docs}`);
  console.log(`   Kind:  ${args.kind}`);
  console.log(`   Agent: ${agentModel} via ${agentBaseUrl}`);
  console.log(`   Out:   ${reporter.trialDir}`);
  console.log("");

  // simple live progress
  let lastTool = "";
  const wrappedOnEvent = (event: any) => {
    if (event.type === "tool-call") {
      lastTool = event.toolName;
      process.stdout.write(`   ◐ ${event.toolName} ... `);
    } else if (event.type === "tool-result") {
      const success = (event.result as any)?.ok !== false;
      process.stdout.write(`${success ? "✓" : "✗"}\n`);
    } else if (event.type === "llm-step") {
      // dim
    }
    reporter.onEvent(event);
  };

  try {
    const outcome = await runOnboardingTrial({
      trialId,
      docsUrl: args.docs,
      targetKind: args.kind,
      userApiKey,
      agent: {
        providerKind: agentProvider,
        baseUrl: agentBaseUrl,
        modelId: agentModel,
        apiKey: agentApiKey,
      },
      maxSteps: args.maxSteps ?? 10,
      onEvent: wrappedOnEvent,
    });
    reporter.finalize(outcome);

    console.log("");
    console.log(`▶  Status: ${outcome.status.toUpperCase()}`);
    if (outcome.failureReason) console.log(`   Reason: ${outcome.failureReason}`);
    console.log(`   Time: ${(outcome.durationMs / 1000).toFixed(1)}s`);
    console.log(`   Tokens: ${outcome.tokenUsage.totalTokens.toLocaleString()}`);
    console.log(`   Fields extracted: ${outcome.draft.modelFields.length}`);
    console.log(`   Trace: ${reporter.trialDir}/trace.json`);
    console.log(`   Summary: ${reporter.trialDir}/summary.md`);
    console.log("");

    process.exit(outcome.status === "success" ? 0 : 1);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("");
    console.error(`✗  Trial crashed: ${msg}`);
    console.error("");
    process.exit(2);
  }
}

void main();
