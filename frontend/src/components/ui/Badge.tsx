import { clsx } from "clsx";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}

export function Badge({ variant = "default", children }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        {
          "bg-gray-600 text-gray-200": variant === "default",
          "bg-green-900 text-green-300": variant === "success",
          "bg-yellow-900 text-yellow-300": variant === "warning",
          "bg-red-900 text-red-300": variant === "danger",
          "bg-blue-900 text-blue-300": variant === "info",
        }
      )}
    >
      {children}
    </span>
  );
}
