"use client";

import { useId } from "react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Presentation definitions can be supplied by an adapter for validated model output.
// Choosing a value does not evaluate access or mutate a database.
export type ExplorerControl = {
  id: string;
  label: string;
  kind: "navigation" | "scenario";
  placeholder: string;
  options: readonly { id: string; label: string }[];
};

export const emptyExplorerControls: readonly ExplorerControl[] = [
  { id: "role", label: "Role / relationship", kind: "navigation", placeholder: "Awaiting model", options: [] },
  { id: "scenario", label: "Scenario", kind: "scenario", placeholder: "Awaiting model", options: [] },
];

function ExplorerControlField({ control, value, onValueChange }: {
  control: ExplorerControl;
  value: string | null;
  onValueChange: (id: string, value: string | null) => void;
}) {
  const id = useId();
  return (
    <Field className="min-w-0" data-control-id={control.id} data-control-kind={control.kind}>
      <FieldLabel htmlFor={id}>{control.label}</FieldLabel>
      <Select
        items={control.options.map((option) => ({ value: option.id, label: option.label }))}
        value={value}
        onValueChange={(next: string | null) => onValueChange(control.id, next)}
        disabled={control.options.length === 0}
      >
        <SelectTrigger id={id} className="min-h-8 w-full whitespace-normal data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none">
          <SelectValue className="min-w-0 whitespace-normal [overflow-wrap:anywhere]" placeholder={control.placeholder} />
        </SelectTrigger>
        <SelectContent
          align="end"
          alignItemWithTrigger={false}
          className="w-max min-w-(--anchor-width) max-w-(--available-width)"
        >
          <SelectGroup>
            {control.options.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
                className="[&>span]:min-w-0 [&>span]:shrink [&>span]:whitespace-normal [&>span]:[overflow-wrap:anywhere]"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ExplorerControls({ controls, values, onValueChange }: {
  controls: readonly ExplorerControl[];
  values: Readonly<Record<string, string | null>>;
  onValueChange: (id: string, value: string | null) => void;
}) {
  return (
    <FieldGroup className="min-w-0 gap-3" aria-label="Explorer lenses and scenarios">
      {controls.map((control) => (
        <ExplorerControlField
          key={control.id}
          control={control}
          value={values[control.id] ?? null}
          onValueChange={onValueChange}
        />
      ))}
    </FieldGroup>
  );
}
