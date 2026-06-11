import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  tone?: "default" | "accent" | "muted";
};

export function Badge({ children, tone = "default" }: BadgeProps) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}
