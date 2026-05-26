import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BRAND_DEFAULTS, normalizeHex, type BrandColors } from "@/lib/themeColors";
import { RotateCcw } from "lucide-react";

const SWATCHES: { key: keyof BrandColors; label: string; hint: string }[] = [
  { key: "primary", label: "Primary (Green)", hint: "Buttons, links, active navigation" },
  { key: "secondary", label: "Secondary (Black)", hint: "Sidebar, headings, body text" },
  { key: "accent", label: "Accent (White)", hint: "Page background, cards, surfaces" },
];

interface SchoolBrandColorPickerProps {
  colors: BrandColors;
  onChange: (colors: BrandColors) => void;
  onPreview?: (colors: BrandColors) => void;
  disabled?: boolean;
}

export function SchoolBrandColorPicker({
  colors,
  onChange,
  onPreview,
  disabled,
}: SchoolBrandColorPickerProps) {
  const update = (key: keyof BrandColors, value: string) => {
    const next = { ...colors, [key]: normalizeHex(value) };
    onChange(next);
    onPreview?.(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {SWATCHES.map(({ key, label, hint }) => (
          <div key={key} className="space-y-2">
            <Label className="text-sm font-medium">{label}</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={colors[key]}
                onChange={(e) => update(key, e.target.value)}
                disabled={disabled}
                className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                aria-label={label}
              />
              <Input
                value={colors[key]}
                onChange={(e) => update(key, e.target.value)}
                disabled={disabled}
                className="font-mono text-xs uppercase"
                maxLength={7}
              />
            </div>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl border-2 border-border overflow-hidden"
        aria-hidden
      >
        <div
          className="h-10 flex items-center px-4 text-sm font-medium"
          style={{ background: colors.secondary, color: colors.accent }}
        >
          Sidebar preview
        </div>
        <div
          className="p-4 flex flex-wrap gap-2"
          style={{ background: colors.accent, color: colors.secondary }}
        >
          <span
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: colors.primary, color: "#fff" }}
          >
            Primary button
          </span>
          <span className="text-sm opacity-80">Content on accent background</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          const defaults = { ...BRAND_DEFAULTS };
          onChange(defaults);
          onPreview?.(defaults);
        }}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset to green / black / white
      </Button>
    </div>
  );
}
