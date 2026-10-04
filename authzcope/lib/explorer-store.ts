import { createStore } from "zustand/vanilla";
import { applyNavigationBatch, initialExplorerNavigation } from "./explorer-navigation.ts";
import { validateExplorerChatReply } from "./explorer-chat-validation.ts";
import type { ExplorerNavigation, NavigationBatch, NavigationRegistry, NavigationResult } from "./explorer-navigation-types.ts";
import type { ExplorerChatInput, ExplorerChatReply, ExplorerChatResult, ExplorerChatTurn } from "./explorer-chat-types.ts";

export type ExplorerChatContext = Omit<ExplorerChatInput, "question" | "history" | "navigation">;
export type ExplorerState = {
  registry: NavigationRegistry;
  navigation: ExplorerNavigation;
  navigationVersion: number;
  pending: boolean;
  question: string | null;
  reply: ExplorerChatReply | null;
  replyNavigation: "applied" | "available" | null;
  error: string | null;
  history: ExplorerChatTurn[];
  replaceRegistry: (registry: NavigationRegistry) => void;
  navigate: (batch: NavigationBatch) => NavigationResult;
  ask: (question: string) => Promise<void>;
  applyReply: () => void;
  clearConversation: () => void;
};

/** Scoped to one provider/tab; no persistence or mutable module session. */
export function createExplorerStore(registry: NavigationRegistry,
  getContext: () => ExplorerChatContext | null,
  transport: (input: ExplorerChatInput) => Promise<ExplorerChatResult>,
) {
  let generation = 0;
  return createStore<ExplorerState>()((set, get) => ({
    registry, navigation: { ...initialExplorerNavigation }, navigationVersion: 0,
    pending: false, question: null, reply: null, replyNavigation: null, error: null, history: [],
    clearConversation() { generation++; set({ pending: false, question: null, reply: null, replyNavigation: null, error: null, history: [] }); },
    replaceRegistry(registry) {
      get().clearConversation();
      set((state) => ({ registry, navigation: { ...initialExplorerNavigation }, navigationVersion: state.navigationVersion + 1 }));
    },
    navigate(batch) {
      if (get().registry.mode === "empty") return { ok: false, message: "Analyze authorization before using the explorer." };
      const result = applyNavigationBatch(get().registry, get().navigation, batch);
      if (result.ok) set((state) => ({ navigation: result.navigation, navigationVersion: state.navigationVersion + 1, error: null }));
      return result;
    },
    applyReply() {
      const reply = get().reply;
      if (!reply) return;
      const result = get().navigate({ revision: reply.revision, commands: reply.commands });
      set(result.ok ? { replyNavigation: "applied" } : { error: result.message });
    },
    async ask(rawQuestion) {
      if (get().pending) return;
      const question = rawQuestion.trim();
      if (!question || question.length > 4_000) { set({ error: "Enter a question of up to 4,000 characters." }); return; }
      const request = ++generation;
      const { registry, navigation, navigationVersion, history } = get();
      const context = getContext();
      if (!context || registry.mode === "empty") { set({ error: "Analyze authorization before asking about access." }); return; }
      set({ pending: true, question, reply: null, replyNavigation: null, error: null });
      let result: ExplorerChatResult;
      try { result = await transport({ ...context, question, navigation, history }); }
      catch { result = { ok: false, code: "provider", message: "The access question failed. Please try again." }; }
      if (request !== generation || registry !== get().registry) return;
      if (!result.ok) { set({ pending: false, error: result.message }); return; }
      let reply: ExplorerChatReply;
      try { reply = validateExplorerChatReply(result.reply, registry, navigation, context.model.claims.map((claim) => claim.id)); }
      catch { set({ pending: false, error: "The response contains invalid navigation. Please ask again." }); return; }
      const moved = navigationVersion !== get().navigationVersion;
      set({ pending: false, reply, replyNavigation: reply.commands.length ? "available" : null,
        history: [...history, { question, answer: reply.answer }].slice(-6) });
      // A delayed answer remains useful, but never takes the camera away from a user who moved.
      if (!moved && reply.commands.length) get().applyReply();
    },
  }));
}
