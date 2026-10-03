"use client";

import { useState, useTransition, type FormEvent } from "react";

import { introspectDatabase } from "@/app/actions/introspect-database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ConfigurationStatus, IntrospectionInput, IntrospectionResult } from "@/lib/introspection-types";

export function ConnectionForm({ configuration }: { configuration: ConfigurationStatus }) {
  const [input, setInput] = useState<IntrospectionInput>({
    connectionString: "",
    aiModel: "",
    aiApiKey: "",
  });
  const [result, setResult] = useState<IntrospectionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  function update(field: keyof IntrospectionInput, value: string) {
    setInput((current) => ({ ...current, [field]: value }));
    setResult(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await introspectDatabase(input));
      } catch {
        setResult({ ok: false, message: "The connection request failed. Please try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Database and AI settings</CardTitle>
          <CardDescription>
            Check your database connection. AI settings are accepted for later analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet disabled={pending}>
            <FieldGroup>
              {configuration.databaseConfigured ? (
                <FieldDescription>Database credentials are configured on the server.</FieldDescription>
              ) : (
                <Field data-invalid={Boolean(errors?.connectionString)}>
                  <FieldLabel htmlFor="connectionString">Postgres connection URL</FieldLabel>
                  <Input
                    id="connectionString" name="connectionString" type="password"
                    autoComplete="off" spellCheck={false} required maxLength={8192}
                    placeholder="postgresql://user:password@host:5432/database"
                    value={input.connectionString}
                    onChange={(event) => update("connectionString", event.target.value)}
                    aria-invalid={Boolean(errors?.connectionString)}
                    aria-describedby="connection-help"
                  />
                  <FieldDescription id="connection-help">
                    Credentials stay in memory for this page. Use sslmode=verify-full for TLS.
                  </FieldDescription>
                  <FieldError>{errors?.connectionString}</FieldError>
                </Field>
              )}
              {configuration.databaseConfigured && errors?.connectionString ? (
                <FieldError>{errors.connectionString}</FieldError>
              ) : null}
              <Field data-invalid={Boolean(errors?.aiModel)}>
                <FieldLabel htmlFor="aiModel">AI model</FieldLabel>
                <Input
                  id="aiModel" name="aiModel" autoComplete="off" spellCheck={false}
                  required maxLength={200} placeholder="Enter a model identifier"
                  value={input.aiModel}
                  onChange={(event) => update("aiModel", event.target.value)}
                  aria-invalid={Boolean(errors?.aiModel)}
                  aria-describedby="model-help"
                />
                <FieldDescription id="model-help">
                  Choose the model you want to use when analysis is available.
                </FieldDescription>
                <FieldError>{errors?.aiModel}</FieldError>
              </Field>
              {configuration.aiApiKeyConfigured ? (
                <FieldDescription>An AI API key is configured on the server.</FieldDescription>
              ) : (
                <Field data-invalid={Boolean(errors?.aiApiKey)}>
                  <FieldLabel htmlFor="aiApiKey">AI API key</FieldLabel>
                  <Input
                    id="aiApiKey" name="aiApiKey" type="password" autoComplete="off"
                    spellCheck={false} required maxLength={8192} value={input.aiApiKey}
                    onChange={(event) => update("aiApiKey", event.target.value)}
                    aria-invalid={Boolean(errors?.aiApiKey)}
                  />
                  <FieldError>{errors?.aiApiKey}</FieldError>
                </Field>
              )}
              {configuration.aiApiKeyConfigured && errors?.aiApiKey ? (
                <FieldError>{errors.aiApiKey}</FieldError>
              ) : null}
            </FieldGroup>
          </FieldSet>
        </CardContent>
        <CardFooter className="flex-col items-start gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Checking connection…" : "Check connection"}
          </Button>
          {result ? (
            result.ok ? (
              <p role="status">Database connection verified. AI settings received; no AI request was made.</p>
            ) : (
              <FieldError>{result.message}</FieldError>
            )
          ) : null}
        </CardFooter>
      </Card>
    </form>
  );
}
