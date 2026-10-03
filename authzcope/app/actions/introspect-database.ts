"use server";

import { runIntrospection } from "@/lib/introspection";
import type { IntrospectionInput, IntrospectionResult } from "@/lib/introspection-types";

export async function introspectDatabase(
  input: IntrospectionInput,
): Promise<IntrospectionResult> {
  return runIntrospection(input);
}
