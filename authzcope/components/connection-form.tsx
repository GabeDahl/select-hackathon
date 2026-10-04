"use client";

import type { FormEvent } from "react";
import Link from "next/link";

import { AiConnectionForm } from "@/components/ai-connection-form";
import { useDatabaseConnection } from "@/components/database-connection-provider";
import { DatabaseConnectionStatus } from "@/components/database-connection-status";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DialogClose } from "@/components/ui/dialog";

export function ConnectionForm() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <DatabaseConnectionForm />
      <AiConnectionForm />
    </div>
  );
}
function DatabaseConnectionForm() {
  const { configured, connectionString, result, pending, updateConnectionString, testConnection } = useDatabaseConnection();
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    testConnection();
  }

  return (
    <form onSubmit={submit} aria-labelledby="database-connection-title">
      <Card>
        <CardHeader>
          <CardTitle id="database-connection-title">Database</CardTitle>
          <CardAction><DatabaseConnectionStatus /></CardAction>
        </CardHeader>
        <CardContent>
          <FieldSet disabled={pending}>
            <FieldGroup>
              {configured ? (
                <FieldDescription>Using server credentials.</FieldDescription>
              ) : (
                <Field data-invalid={Boolean(errors?.connectionString)}>
                  <FieldLabel htmlFor="connectionString">Postgres connection URL</FieldLabel>
                  <Input
                    id="connectionString" name="connectionString" type="password"
                    autoComplete="off" spellCheck={false} required maxLength={8192}
                    placeholder="postgresql://user:password@host:5432/database"
                    value={connectionString}
                    onChange={(event) => updateConnectionString(event.target.value)}
                    aria-invalid={Boolean(errors?.connectionString)}
                    aria-describedby="connection-help"
                  />
                  <FieldDescription id="connection-help">
                    Cleared on reload. Use sslmode=verify-full for TLS.
                  </FieldDescription>
                  <FieldError>{errors?.connectionString}</FieldError>
                </Field>
              )}
              {configured && errors?.connectionString ? (
                <FieldError>{errors.connectionString}</FieldError>
              ) : null}
            </FieldGroup>
          </FieldSet>
        </CardContent>
        <CardFooter className="flex-col items-start gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Importing schema…" : "Connect & import schema"}
          </Button>
          {result ? (
            result.ok ? (
              <p role="status">
                Imported {result.snapshot.objects.length} objects. {" "}
                <DialogClose nativeButton={false} render={<Link href="/schema" className="underline underline-offset-4" />}>Inspect schema</DialogClose>
              </p>
            ) : (
              <FieldError>{result.message}</FieldError>
            )
          ) : null}
        </CardFooter>
      </Card>
    </form>
  );
}
