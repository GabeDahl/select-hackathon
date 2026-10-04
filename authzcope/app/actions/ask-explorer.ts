"use server";

import { runExplorerChat } from "@/lib/explorer-chat-service";

export async function askExplorer(input: unknown) {
  return runExplorerChat(input);
}
