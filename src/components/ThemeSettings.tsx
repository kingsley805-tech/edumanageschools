import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { GradientColorPicker } from "./GradientColorPicker";
import { toast } from "sonner";

const themes = [
  { id: "default", name: "Default", colors: "bg-gradient-to-br from-blue-500 to-cyan-500" },
  { id: "dark", name: "Dark", colors: "bg-gradient-to-br from-slate-800 to-slate-900" },
  { id: "blue", name: "Blue", colors: "bg-gradient-to-br from-blue-500 to-blue-600" },
  { id: "purple", name: "Purple", colors: "bg-gradient-to-br from-purple-500 to-purple-600" },
  { id: "green", name: "Green", colors: "bg-gradient-to-br from-green-500 to-green-600" },
  { id: "custom", name: "Custom", colors: "bg-gradient-to-br from-pink-500 to-orange-500" },
];

const defaultCustomColors = {
  primary: "217 91% 60%",
  accent: "189 94% 43%",
  background: "0 0% 100%",
  foreground: "220 13% 13%",
};

export default function ThemeSettings() {
  const { theme, setTheme, customColors, setCustomColors } = useTheme();
  const [primaryHSL, setPrimaryHSL] = useState(customColors.primary);
  const [accentHSL, setAccentHSL] = useState(customColors.accent);
  const [backgroundHSL, setBackgroundHSL] = useState(customColors.background);
  const [foregroundHSL, setForegroundHSL] = useState(customColors.foreground);

  // Sync local state when customColors change from outside
  useEffect(() => {
    setPrimaryHSL(customColors.primary);
    setAccentHSL(customColors.accent);
    setBackgroundHSL(customColors.background);
    setForegroundHSL(customColors.foreground);
  }, [customColors]);

  const handleApplyCustomColors = () => {
    setCustomColors({ 
      primary: primaryHSL, 
      accent: accentHSL,
      background: backgroundHSL,
      foreground: foregroundHSL,
    });
    setTheme("custom");
    toast.success("Custom theme applied successfully!");
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Palette className="h-4 w-4 md:h-5 md:w-5" />
            Theme Selection
          </CardTitle>
          <CardDescription className="text-sm md:text-base">Choose a theme for your portal</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                className={`relative flex flex-col items-center gap-2 md:gap-3 p-3 md:p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                  theme === t.id ? "border-primary shadow-lg" : "border-border hover:border-muted-foreground"
                }`}
              >
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full ${t.colors}`} />
                <span className="font-medium text-sm md:text-base">{t.name}</span>
                {theme === t.id && (
                  <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-2.5 w-2.5 md:h-3 md:w-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {theme === "custom" && (
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">Customize Colors</CardTitle>
            <CardDescription className="text-sm md:text-base">
              Use the gradient sliders to create your custom theme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6 p-4 md:p-6 pt-0">
            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              <GradientColorPicker
                label="Primary Color"
                value={primaryHSL}
                onChange={setPrimaryHSL}
              />
              <GradientColorPicker
                label="Accent Color"
                value={accentHSL}
                onChange={setAccentHSL}
              />
              <GradientColorPicker
                label="Background Color"
                value={backgroundHSL}
                onChange={setBackgroundHSL}
              />
              <GradientColorPicker
                label="Foreground Color"
                value={foregroundHSL}
                onChange={setForegroundHSL}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleApplyCustomColors} className="flex-1 w-full sm:w-auto">
                Apply Custom Colors
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPrimaryHSL(defaultCustomColors.primary);
                  setAccentHSL(defaultCustomColors.accent);
                  setBackgroundHSL(defaultCustomColors.background);
                  setForegroundHSL(defaultCustomColors.foreground);
                }}
                className="w-full sm:w-auto"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
