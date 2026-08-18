import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportTable,
  type ExportCell,
  type ExportFormat,
} from "@/modules/lib/exportTable";
import { toast } from "sonner";

type Props = {
  filename: string;
  title?: string;
  headers: string[];
  rows: ExportCell[][];
  disabled?: boolean;
  className?: string;
};

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: "pdf", label: "PDF" },
  { format: "word", label: "Word doc" },
  { format: "excel", label: "Excel" },
  { format: "csv", label: "CSV" },
];

/** Outline export control with PDF / Word / Excel / CSV options. */
export function ExportMenu({ filename, title, headers, rows, disabled, className }: Props) {
  const onExport = (format: ExportFormat) => {
    if (!rows.length) {
      toast.error("Nothing to export.");
      return;
    }
    try {
      exportTable({ filename, headers, rows, format, title });
      toast.success(`Exported ${format === "word" ? "Word" : format.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={className}
        >
          Export
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {FORMATS.map((f) => (
          <DropdownMenuItem key={f.format} onClick={() => onExport(f.format)}>
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
