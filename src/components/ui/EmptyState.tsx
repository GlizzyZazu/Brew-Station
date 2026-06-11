import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <article className="emptyCard">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </article>
  );
}
