import { type HTMLAttributes } from "react";
import { clsx } from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ className, hover = false, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-navy-light border border-gray-700 rounded-xl p-6",
        hover && "hover:border-gold/50 transition-colors duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
