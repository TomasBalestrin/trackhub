import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "dark" | "gold";
}

export function Card({ className, variant = "default", children, ...props }: CardProps) {
  const variants = {
    default: "bg-white border border-gray-200",
    dark: "bg-navy-dark text-white",
    gold: "bg-white border-l-4 border-l-gold border border-gray-200",
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)]",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-navy-50 mt-1", className)} {...props}>
      {children}
    </p>
  );
}
