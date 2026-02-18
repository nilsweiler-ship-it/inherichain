import { Loader2 } from "lucide-react";

export function Spinner({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={`${className} animate-spin text-gold`} />
    </div>
  );
}
