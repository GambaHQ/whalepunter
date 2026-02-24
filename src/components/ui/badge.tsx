import * as React from "react";
import { cn } from "@/lib/utils/helpers";

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}>(({ className, variant = "default", ...props }, ref) => {
  const variants: Record<string, string> = {
    default: "border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
    secondary: "border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
    destructive: "border-transparent bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
    outline: "text-[hsl(var(--foreground))]",
    success: "border-transparent bg-green-500/20 text-green-500",
    warning: "border-transparent bg-yellow-500/20 text-yellow-500",
  };

  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
Badge.displayName = "Badge";

export { Badge };
