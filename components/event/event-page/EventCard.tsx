import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import type { ResolvedTheme } from "@/lib/theme";

type EventCardProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  theme: ResolvedTheme;
  flush?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export function EventCard<T extends ElementType = "section">({
  as,
  children,
  theme: t,
  flush = false,
  style,
  ...props
}: EventCardProps<T>) {
  const Component = as ?? "section";

  return (
    <Component
      {...props}
      style={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: t.cardRadius,
        padding: flush ? 0 : "24px",
        marginBottom: "16px",
        backdropFilter: "blur(12px)",
        boxShadow: t.cardShadow,
        ...(flush ? { overflow: "hidden" } : {}),
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
