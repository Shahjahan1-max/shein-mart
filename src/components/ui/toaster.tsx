import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:bottom-0 sm:top-auto md:max-w-[420px] pointer-events-none">
      {toasts.map(({ id, title, description, variant, action, className }) => (
        <div
          key={id}
          role="status"
          className={cn(
            "pointer-events-auto relative flex w-full items-start justify-between gap-4 overflow-hidden rounded-md border p-4 pr-10 shadow-lg transition-colors",
            variant === "destructive"
              ? "border-red-500 bg-red-600 text-white"
              : "border-gray-200 bg-white text-gray-950 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50",
            className,
          )}
        >
          <div className="grid gap-1">
            {title && <div className="text-sm font-semibold">{title}</div>}
            {description && <div className="text-sm opacity-90">{description}</div>}
          </div>
          {action}
          <button
            type="button"
            aria-label="Close notification"
            onClick={() => dismiss(id)}
            className="absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
