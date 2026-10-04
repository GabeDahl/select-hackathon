import { readFileSync, writeFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(new URL("../docs/authorization-model.schema.json", import.meta.url), "utf8"));
const name = (value) => value[0].toUpperCase() + value.slice(1);

function type(node) {
  if (node.$ref) return name(node.$ref.split("/").at(-1));
  if ("const" in node) return JSON.stringify(node.const);
  if (node.enum) return node.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (node.anyOf) return node.anyOf.map(type).join(" | ");
  if (Array.isArray(node.type)) return node.type.map((value) => type({ type: value })).join(" | ");
  if (node.type === "array") return `Array<${type(node.items)}>`;
  if (node.type === "object") {
    return `{\n${Object.entries(node.properties).map(([key, value]) =>
      `  ${key}${node.required.includes(key) ? "" : "?"}: ${type(value)};`).join("\n")}\n}`;
  }
  if (node.type === "null") return "null";
  if (["string", "number", "boolean"].includes(node.type)) return node.type;
  throw new Error("Unsupported contract schema node");
}

const output = "// Generated from docs/authorization-model.schema.json.\n" +
  "// Run node scripts/generate-authorization-types.mjs after changing the contract.\n\n" +
  Object.entries(schema.definitions).map(([key, value]) => `export type ${name(key)} = ${type(value)};\n`).join("\n") +
  `\nexport type AuthorizationModel = ${type(schema)};\n`;
writeFileSync(new URL("../lib/authorization-model-types.ts", import.meta.url), output);
