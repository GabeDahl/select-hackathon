"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpIcon, SparklesIcon } from "lucide-react";
import { useExplorerStore } from "@/components/explorer-navigation-provider";
import { useAnalysisStore } from "@/components/analysis-provider";
import { useAiStore } from "@/components/ai-connection-provider";
import { useWorkspaceStore } from "@/components/database-connection-provider";
import { ConnectionsTrigger } from "@/components/connections-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

export function ExplorerQuestionInput() {
  const [question, setQuestion] = useState("");
  const pending = useExplorerStore((state) => state.pending);
  const ask = useExplorerStore((state) => state.ask);
  const hasModel = useAnalysisStore((state) => state.model !== null);
  const configured = useAiStore((state) => !!state.input.aiApiKey?.trim() || state.configuration.apiKeyConfigured[state.input.aiProvider]);
  return (
    <form onSubmit={(event) => { event.preventDefault(); if (hasModel && configured && !pending && question.trim()) { void ask(question); setQuestion(""); } }}>
      <InputGroup className="h-13 px-2">
        <InputGroupInput aria-label="Ask about access" placeholder="Ask about access" value={question}
          onChange={(event) => setQuestion(event.target.value)} maxLength={4_000} disabled={pending || !hasModel} />
        <InputGroupAddon><SparklesIcon aria-hidden="true" /></InputGroupAddon>
        <InputGroupAddon align="inline-end">
          {configured ? <InputGroupButton type="submit" size="icon-sm" variant="secondary" disabled={pending || !hasModel || !question.trim()} aria-label="Submit access question">
            <ArrowUpIcon aria-hidden="true" />
          </InputGroupButton> : <ConnectionsTrigger variant="secondary" size="sm">Connect AI</ConnectionsTrigger>}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

/** Latest explanation lives in the inspector; transcript context stays in tab memory. */
export function ExplorerChatAnswer() {
  const pending = useExplorerStore((state) => state.pending);
  const question = useExplorerStore((state) => state.question);
  const reply = useExplorerStore((state) => state.reply);
  const error = useExplorerStore((state) => state.error);
  const status = useExplorerStore((state) => state.replyNavigation);
  const applyReply = useExplorerStore((state) => state.applyReply);
  const clear = useExplorerStore((state) => state.clearConversation);
  const model = useAnalysisStore((state) => state.model);
  const selectObject = useWorkspaceStore((state) => state.selectObject);
  if (!pending && !reply && !error) return null;
  return (
    <section className="flex flex-col gap-4 border-b px-6 py-5" aria-label="Access question" aria-busy={pending}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{question ?? "Access question"}</h3>
        <Button variant="ghost" size="sm" onClick={clear} aria-label="Clear access conversation">Clear</Button>
      </div>
      <div aria-live="polite" className="flex flex-col gap-3">
        {pending ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        {reply ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{reply.answer}</p> : null}
      </div>
      {reply?.claimIds.length ? <ul className="flex flex-col gap-3" aria-label="Supporting claims">
        {reply.claimIds.map((id) => {
          const claim = model?.claims.find((claim) => claim.id === id);
          return claim ? <li key={id} className="flex flex-col gap-1 text-xs">
            <Badge variant="outline" className="w-fit">{claim.basis.replaceAll("_", " ")} · {claim.support}</Badge>
            <span>{claim.statement}</span>
            {claim.evidenceRefs.map((ref) => <Link key={`${ref.sourceId}:${ref.pointer}`} href={ref.sourceId === "context:application" ? "/context" : "/schema"}
              onClick={() => { if (ref.sourceId !== "context:application") selectObject(ref.sourceId); }}
              className="break-all font-mono text-muted-foreground underline underline-offset-4">{ref.sourceId}{ref.pointer}</Link>)}
          </li> : null;
        })}
      </ul> : null}
      {status === "available" ? <Button variant="outline" onClick={applyReply}>Show in scene</Button> : null}
    </section>
  );
}
