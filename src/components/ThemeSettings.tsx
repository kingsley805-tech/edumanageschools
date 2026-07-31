import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const themes: {
  id: Theme;
  name: string;
  description: string;
  icon: typeof Sun;
  swatch: string;
}[] = [
  {
    id: "light",
    name: "Light",
    description: "White surfaces, ink text",
    icon: Sun,
    swatch: "bg-white",
  },
  {
    id: "dark",
    name: "Dark",
    description: "Black surfaces, white text",
    icon: Moon,
    swatch: "bg-neutral-950",
  },
];

export default function ThemeSettings() {
  const { theme, setTheme, glassmorphism, setGlassmorphism } = useTheme();

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Monitor className="h-4 w-4 md:h-5 md:w-5" />
            Appearance
          </CardTitle>
          <CardDescription className="text-sm">
            Choose how the portal looks. Your choice is saved to this device and
            applies everywhere in the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid gap-3 sm:grid-cols-2 sm:gap-4"
          >
            {themes.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setTheme(option.id);
                    toast.success(`${option.name} theme applied`);
                  }}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[var(--radius-card)] border p-4 text-left transition-colors",
                    selected
                      ? "border-primary bg-accent"
                      : "border-border hover:border-muted-foreground/50 hover:bg-accent/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border",
                      option.swatch,
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        option.id === "dark" ? "text-white" : "text-neutral-900",
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {option.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                  {selected ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Display options</CardTitle>
          <CardDescription className="text-sm">
            Fine-tune surface treatment across the portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-control)] border border-border p-3">
            <div className="min-w-0">
              <Label htmlFor="glassmorphism" className="text-sm font-medium">
                Translucent panels
              </Label>
              <p className="text-xs text-muted-foreground">
                Adds a frosted-glass effect to overlays and cards.
              </p>
            </div>
            <Switch
              id="glassmorphism"
              checked={glassmorphism}
              onCheckedChange={setGlassmorphism}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
