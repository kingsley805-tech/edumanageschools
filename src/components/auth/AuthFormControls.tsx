import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon?: LucideIcon;
  hint?: ReactNode;
};

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { id, label, icon: Icon, hint, className, ...props },
  ref,
) {
  return (
    <div className="space-y-1.5 text-left">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="group relative flex items-center">
        {Icon ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground transition-colors group-focus-within:text-green-400">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}
        <Input
          ref={ref}
          id={id}
          className={cn(
            "h-12 rounded-xl border-border/80 bg-background/60 text-sm font-medium transition-all hover:border-white/20 focus-visible:border-green-500/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-green-500/20",
            Icon && "pl-10",
            className,
          )}
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...props}
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground/80 pl-1">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

type AuthPasswordFieldProps = AuthFieldProps & {
  containerClassName?: string;
};

export const AuthPasswordField = forwardRef<HTMLInputElement, AuthPasswordFieldProps>(
  function AuthPasswordField({ id, label, icon: Icon, hint, className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="space-y-1.5 text-left">
        <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        <div className="group relative flex items-center">
          {Icon ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground transition-colors group-focus-within:text-green-400">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          ) : null}
          <Input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            className={cn(
              "h-12 rounded-xl border-border/80 bg-background/60 pr-11 text-sm font-medium transition-all hover:border-white/20 focus-visible:border-green-500/60 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-green-500/20",
              Icon && "pl-10",
              className,
            )}
            aria-describedby={hint ? `${id}-hint` : undefined}
            {...props}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 z-10">
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground/80 pl-1">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

type AuthSegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
};

export function AuthSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: AuthSegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 border border-border/40"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function AuthSectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}
