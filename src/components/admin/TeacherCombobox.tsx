import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type TeacherOption = {
  id: string;
  full_name: string;
  email: string;
  employee_no: string | null;
  avatar_url?: string | null;
};

interface Props {
  teachers: TeacherOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function TeacherCombobox({ teachers, value, onChange, placeholder = "Select teacher" }: Props) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => teachers.find((t) => t.id === value), [teachers, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-12 w-full items-center justify-between gap-2 rounded-md border border-[#2a2a2a] bg-[#1c1c1c] px-3 text-left text-sm text-[#fafafa] transition hover:bg-[#222] focus:outline-none focus:ring-2 focus:ring-primary",
          )}
        >
          {selected ? (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={selected.avatar_url ?? undefined} alt={selected.full_name} />
                <AvatarFallback className="bg-primary/20 text-[11px] text-primary">
                  {initials(selected.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <div className="truncate font-medium">{selected.full_name}</div>
                <div className="truncate text-xs text-[#a3a3a3]">
                  {selected.email}
                  {selected.employee_no ? ` · ${selected.employee_no}` : ""}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-[#a3a3a3]">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#a3a3a3]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] border-[#2a2a2a] bg-[#141414] p-0 text-[#fafafa]"
      >
        <Command className="bg-transparent">
          <div className="flex items-center border-b border-[#2a2a2a] px-3">
            <Search className="h-4 w-4 text-[#a3a3a3]" />
            <CommandInput
              placeholder="Search by name, email or staff ID…"
              className="h-10 border-0 bg-transparent text-sm text-[#fafafa] placeholder:text-[#6b6b6b] focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[320px]">
            <CommandEmpty className="py-6 text-center text-sm text-[#a3a3a3]">
              No teachers found.
            </CommandEmpty>
            <CommandGroup>
              {teachers.map((t) => {
                const isSel = t.id === value;
                return (
                  <CommandItem
                    key={t.id}
                    value={`${t.full_name} ${t.email} ${t.employee_no ?? ""}`}
                    onSelect={() => {
                      onChange(t.id);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2 text-[#fafafa] aria-selected:bg-[#222]"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={t.avatar_url ?? undefined} alt={t.full_name} />
                      <AvatarFallback className="bg-primary/20 text-xs text-primary">
                        {initials(t.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-sm font-medium">{t.full_name}</div>
                      <div className="truncate text-xs text-[#a3a3a3]">
                        {t.email}
                        {t.employee_no ? ` · ${t.employee_no}` : ""}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0 text-primary",
                        isSel ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
