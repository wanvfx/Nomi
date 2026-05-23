import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1 } from "ai";

export type AiSdkProviderKind = "openai-compatible" | "anthropic";

export interface BuildAiSdkModelInput {
  kind: AiSdkProviderKind;
  baseURL: string;
  apiKey: string;
  modelId: string;
}

/**
 * Factory that returns a Vercel AI SDK `LanguageModelV1` for either an
 * OpenAI-compatible endpoint (e.g. ChatFire) or the Anthropic Messages API.
 *
 * Keeping the construction in one place lets the rest of the runtime stay
 * agnostic to which provider is in use; all branching happens here.
 */
export function buildAiSdkModel(input: BuildAiSdkModelInput): LanguageModelV1 {
  const apiKey = (input.apiKey || "").trim();
  if (!apiKey) {
    throw new Error("buildAiSdkModel: apiKey is required");
  }
  const modelId = (input.modelId || "").trim();
  if (!modelId) {
    throw new Error("buildAiSdkModel: modelId is required");
  }
  const baseURL = (input.baseURL || "").trim().replace(/\/+$/, "");

  if (input.kind === "anthropic") {
    const provider = createAnthropic({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
    return provider.languageModel(modelId);
  }

  if (!baseURL) {
    throw new Error("buildAiSdkModel: baseURL is required for openai-compatible providers");
  }
  const provider = createOpenAICompatible({
    name: "nomi",
    baseURL,
    apiKey,
  });
  return provider.chatModel(modelId);
}
