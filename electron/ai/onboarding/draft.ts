/**
 * In-memory draft state for an onboarding session.
 *
 * One draft per active session. Atomic tools mutate the draft;
 * commit_model promotes draft to the real catalog.
 *
 * Lab mode: stays in memory, gets serialized into trace.json at end.
 * Phase B (user-facing): also written to disk under
 * `~/Library/Application Support/Nomi/onboarding-drafts/<sessionId>.json`
 * after each tool call, so half-finished sessions can resume.
 */
import type { OnboardingDraft, ModelKind, FieldDefinition, RequestProfileOperation } from "./types";

export class DraftStore {
  private drafts = new Map<string, OnboardingDraft>();

  create(sessionId: string, targetKind: ModelKind): OnboardingDraft {
    const draft: OnboardingDraft = {
      sessionId,
      startedAt: Date.now(),
      targetKind,
      modelFields: [],
      fetchedDocs: [],
      testAttempts: [],
    };
    this.drafts.set(sessionId, draft);
    return draft;
  }

  get(sessionId: string): OnboardingDraft {
    const draft = this.drafts.get(sessionId);
    if (!draft) throw new Error(`Draft not found for session ${sessionId}`);
    return draft;
  }

  has(sessionId: string): boolean {
    return this.drafts.has(sessionId);
  }

  patch(sessionId: string, patch: Partial<OnboardingDraft>): OnboardingDraft {
    const current = this.get(sessionId);
    Object.assign(current, patch);
    return current;
  }

  upsertField(sessionId: string, field: FieldDefinition): FieldDefinition {
    const draft = this.get(sessionId);
    const idx = draft.modelFields.findIndex((f) => f.key === field.key);
    if (idx >= 0) {
      draft.modelFields[idx] = field;
    } else {
      draft.modelFields.push(field);
    }
    return field;
  }

  setMapping(sessionId: string, stage: "create" | "query", op: RequestProfileOperation): void {
    const draft = this.get(sessionId);
    if (stage === "create") {
      draft.mappingCreate = op;
    } else {
      draft.mappingQuery = op;
    }
  }

  appendFetchedDoc(sessionId: string, doc: OnboardingDraft["fetchedDocs"][number]): void {
    this.get(sessionId).fetchedDocs.push(doc);
  }

  appendTestAttempt(sessionId: string, attempt: OnboardingDraft["testAttempts"][number]): void {
    this.get(sessionId).testAttempts.push(attempt);
  }

  /**
   * Check if draft is "complete enough to commit" — all required pieces present.
   * Returns null if OK, or a list of missing items.
   */
  validateForCommit(sessionId: string): string[] | null {
    const draft = this.get(sessionId);
    const missing: string[] = [];
    if (!draft.vendorKey) missing.push("vendor.key");
    if (!draft.vendorBaseUrl) missing.push("vendor.baseUrl");
    if (!draft.vendorAuth) missing.push("vendor.auth");
    if (!draft.modelKey) missing.push("model.key");
    if (draft.modelFields.length === 0) missing.push("model.fields (empty)");
    if (!draft.mappingCreate) missing.push("mapping.create");
    // Async (video) usually needs query stage too — but not required for sync image models
    if (draft.targetKind === "video" && !draft.mappingQuery) missing.push("mapping.query (recommended for async video)");

    const lastTest = draft.testAttempts[draft.testAttempts.length - 1];
    if (!lastTest) missing.push("no test attempts (must execute_test_curl at least once)");
    else if (!lastTest.ok) missing.push(`last test failed: ${lastTest.diagnostics.join("; ")}`);

    return missing.length > 0 ? missing : null;
  }

  delete(sessionId: string): void {
    this.drafts.delete(sessionId);
  }
}

// Singleton for the process. Lab CLI and IPC handler both import this.
export const draftStore = new DraftStore();
