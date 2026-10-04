"use client";

import type { FormEvent } from "react";
import { useAiStore } from "@/components/ai-connection-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AI_PROVIDERS, type AiProvider } from "@/lib/ai-connection-types";

export function AiConnectionForm() {
  const input = useAiStore((s) => s.input);
  const result = useAiStore((s) => s.result);
  const pending = useAiStore((s) => s.pending);
  const configured = useAiStore((s) => s.configuration.apiKeyConfigured[s.input.aiProvider]);
  const updateInput = useAiStore((s) => s.updateInput);
  const checkSettings = useAiStore((s) => s.checkSettings);
  const testConnection = useAiStore((s) => s.testConnection);
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.value === "connection") void testConnection();
    else void checkSettings();
  }

  return (
    <form onSubmit={submit} aria-labelledby="ai-connection-title">
      <Card>
        <CardHeader>
          <CardTitle id="ai-connection-title">AI</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldSet disabled={Boolean(pending)}>
            <FieldGroup>
              <Field data-invalid={Boolean(errors?.aiProvider)}>
                <FieldLabel id="ai-provider-label">Provider</FieldLabel>
                <ToggleGroup
                  variant="outline" value={[input.aiProvider]} disabled={Boolean(pending)}
                  aria-labelledby="ai-provider-label" aria-invalid={Boolean(errors?.aiProvider)}
                  onValueChange={(values) => {
                    if (values[0]) updateInput({ aiProvider: values[0] as AiProvider });
                  }}
                >
                  {AI_PROVIDERS.map((provider) => (
                    <ToggleGroupItem key={provider.id} value={provider.id} type="button">{provider.label}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <FieldError>{errors?.aiProvider}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors?.aiModel)}>
                <FieldLabel htmlFor="aiModel">Model ID</FieldLabel>
                <Input
                  id="aiModel" name="aiModel" autoComplete="off" spellCheck={false}
                  required maxLength={200}
                  value={input.aiModel} onChange={(event) => updateInput({ aiModel: event.target.value })}
                  aria-invalid={Boolean(errors?.aiModel)}
                />
                <FieldError>{errors?.aiModel}</FieldError>
              </Field>
              {configured ? (
                <FieldDescription>Using server API key.</FieldDescription>
              ) : (
                <Field data-invalid={Boolean(errors?.aiApiKey)}>
                  <FieldLabel htmlFor="aiApiKey">API key</FieldLabel>
                  <Input
                    id="aiApiKey" name="aiApiKey" type="password" autoComplete="off"
                    spellCheck={false} required maxLength={8192} value={input.aiApiKey ?? ""}
                    onChange={(event) => updateInput({ aiApiKey: event.target.value })}
                    aria-invalid={Boolean(errors?.aiApiKey)} aria-describedby="ai-key-help"
                  />
                  <FieldDescription id="ai-key-help">Cleared on reload or provider change.</FieldDescription>
                  <FieldError>{errors?.aiApiKey}</FieldError>
                </Field>
              )}
              {configured && errors?.aiApiKey ? <FieldError>{errors.aiApiKey}</FieldError> : null}
              <FieldDescription>Connection tests may incur a provider charge.</FieldDescription>
            </FieldGroup>
          </FieldSet>
        </CardContent>
        <CardFooter className="flex-col items-start gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="submit" value="settings" variant="outline" disabled={Boolean(pending)}>
              {pending === "settings" ? "Checking…" : "Check settings"}
            </Button>
            <Button type="submit" value="connection" disabled={Boolean(pending)}>
              {pending === "connection" ? "Testing…" : "Test connection"}
            </Button>
          </div>
          {result ? result.ok ? (
            <p role="status">{result.stage === "connection"
              ? "Connection verified."
              : "Settings valid. Connection not tested."}</p>
          ) : <FieldError>{result.message}</FieldError> : null}
        </CardFooter>
      </Card>
    </form>
  );
}
