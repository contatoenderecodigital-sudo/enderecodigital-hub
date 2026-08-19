"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/groow/utils";
import { Button } from "@/components/groow/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/groow/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/groow/ui/popover";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Número à direita (ex.: tarefas pendentes). */
  count?: number;
  /** Inicial/sigla mostrada num círculo à esquerda (ex.: "IS"). */
  initials?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  emptyText = "Nada encontrado.",
  className,
  allowClear = true,
}: {
  options: SearchSelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  /** Clicar no item já selecionado limpa a seleção. */
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || null;

  const chip = (initials?: string) =>
    initials ? (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {initials}
      </span>
    ) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between gap-2 border-border bg-background px-3 font-medium text-foreground hover:bg-background focus-visible:outline-0 focus-visible:ring-0",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {chip(selected?.initials)}
            <span className={cn("truncate", !selected && "font-normal text-muted-foreground")}>
              {selected ? selected.label : placeholder}
            </span>
          </span>
          <ChevronDown size={16} strokeWidth={2} className="shrink-0 text-muted-foreground/70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popper-anchor-width)] border-border p-0"
        align="start"
        sideOffset={6}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => {
                    onChange(o.value === value && allowClear ? null : o.value);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  {chip(o.initials)}
                  <span className="truncate">{o.label}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {o.count != null && o.count > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {o.count}
                      </span>
                    )}
                    {value === o.value && <Check size={15} strokeWidth={2.5} className="text-primary" />}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
