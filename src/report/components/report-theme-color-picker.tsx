import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_REPORT_THEME,
  REPORT_THEME_PRESETS,
  buildReportBrandColors,
  isValidHexColor,
} from "@/report/lib/report-brand-colors";
import { normalizeHex } from "@/lib/themeColors";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
};

export function ReportThemeColorPicker({ value, onChange, disabled }: Props) {
  const safe = isValidHexColor(value) ? normalizeHex(value) : DEFAULT_REPORT_THEME;
  const preview = buildReportBrandColors(safe);

  const setHex = (raw: string) => {
    if (!raw.trim()) return;
    const next = raw.startsWith("#") ? raw : `#${raw}`;
    if (isValidHexColor(next)) {
      onChange(normalizeHex(next));
    } else {
      onChange(next);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {REPORT_THEME_PRESETS.map((p) => (
          <button
            key={p.hex}
            type="button"
            disabled={disabled}
            title={p.label}
            onClick={() => onChange(p.hex)}
            className={cn(
              "h-9 w-9 rounded-full border-2 transition-transform hover:scale-105",
              safe === p.hex ? "border-foreground ring-2 ring-offset-2 ring-primary" : "border-border",
            )}
            style={{ background: p.hex }}
            aria-label={`${p.label} theme`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label>Primary color</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={isValidHexColor(safe) ? safe : DEFAULT_REPORT_THEME}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1"
              aria-label="Pick report theme color"
            />
            <Input
              value={value}
              onChange={(e) => setHex(e.target.value)}
              disabled={disabled}
              placeholder="#000000"
              className="w-28 font-mono text-xs uppercase"
              maxLength={7}
            />
          </div>
          {!isValidHexColor(value) && value.trim() && (
            <p className="text-xs text-destructive">Enter a valid HEX code (e.g. #000000)</p>
          )}
        </div>
      </div>

      <div
        className="rounded-xl border overflow-hidden shadow-sm"
        aria-label="Report card theme preview"
      >
        <div
          className="px-4 py-3 text-sm font-bold text-white"
          style={{ background: preview.primaryDark }}
        >
          Report header preview
        </div>
        <div className="p-4 bg-white space-y-2">
          <div
            className="h-1 rounded"
            style={{ background: preview.primaryLight }}
          />
          <div className="flex gap-2">
            <span
              className="text-xs font-bold px-2 py-1 rounded-full text-white"
              style={{ background: preview.primaryDark }}
            >
              Grade A
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded border"
              style={{ borderColor: preview.primary, color: preview.primary }}
            >
              Table border
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden bg-gray-100 max-w-[200px]"
          >
            <div
              className="h-full rounded-full"
              style={{ width: "72%", background: preview.primary }}
            />
          </div>
        </div>
        <div
          className="px-4 py-2 text-[10px] text-white opacity-90"
          style={{ background: preview.primaryDark }}
        >
          Footer · applies to print &amp; PDF
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange(DEFAULT_REPORT_THEME)}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset to black
      </Button>
    </div>
  );
}
