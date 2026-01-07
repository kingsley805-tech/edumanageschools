import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";

interface GradientColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function GradientColorPicker({ label, value, onChange }: GradientColorPickerProps) {
  // Parse HSL value (e.g., "217 91% 60%")
  const parseHSL = (hsl: string) => {
    const parts = hsl.split(/\s+/);
    return {
      h: parseInt(parts[0]) || 0,
      s: parseInt(parts[1]) || 0,
      l: parseInt(parts[2]) || 0,
    };
  };

  const hsl = parseHSL(value);
  const [h, setH] = useState(hsl.h);
  const [s, setS] = useState(hsl.s);
  const [l, setL] = useState(hsl.l);

  const updateColor = (newH: number, newS: number, newL: number) => {
    setH(newH);
    setS(newS);
    setL(newL);
    onChange(`${newH} ${newS}% ${newL}%`);
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <Label className="text-sm md:text-base">{label}</Label>
      
      {/* Color Preview with gradient */}
      <Card className="h-20 md:h-24 rounded-lg border-2 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, hsl(${h} ${s}% ${l}%), hsl(${(h + 30) % 360} ${s}% ${Math.max(l - 10, 10)}%))`,
          }}
        />
      </Card>

      {/* Hue Slider */}
      <div className="space-y-1.5 md:space-y-2">
        <div className="flex justify-between text-xs md:text-sm">
          <Label className="text-muted-foreground text-xs md:text-sm">Hue</Label>
          <span className="text-muted-foreground text-xs md:text-sm">{h}°</span>
        </div>
        <div className="relative h-2.5 md:h-3 rounded-full overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))',
            }}
          />
        </div>
        <Slider
          value={[h]}
          onValueChange={([value]) => updateColor(value, s, l)}
          max={360}
          step={1}
          className="mt-1 md:mt-2"
        />
      </div>

      {/* Saturation Slider */}
      <div className="space-y-1.5 md:space-y-2">
        <div className="flex justify-between text-xs md:text-sm">
          <Label className="text-muted-foreground text-xs md:text-sm">Saturation</Label>
          <span className="text-muted-foreground text-xs md:text-sm">{s}%</span>
        </div>
        <div className="relative h-2.5 md:h-3 rounded-full overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))`,
            }}
          />
        </div>
        <Slider
          value={[s]}
          onValueChange={([value]) => updateColor(h, value, l)}
          max={100}
          step={1}
          className="mt-1 md:mt-2"
        />
      </div>

      {/* Lightness Slider */}
      <div className="space-y-1.5 md:space-y-2">
        <div className="flex justify-between text-xs md:text-sm">
          <Label className="text-muted-foreground text-xs md:text-sm">Lightness</Label>
          <span className="text-muted-foreground text-xs md:text-sm">{l}%</span>
        </div>
        <div className="relative h-2.5 md:h-3 rounded-full overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, hsl(${h} ${s}% 0%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 100%))`,
            }}
          />
        </div>
        <Slider
          value={[l]}
          onValueChange={([value]) => updateColor(h, s, value)}
          max={100}
          step={1}
          className="mt-1 md:mt-2"
        />
      </div>
    </div>
  );
}
