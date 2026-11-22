import { useEffect, useId, useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

export function RosterDialog({ open, onClose, title, description, children }: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLInputElement>("input:not([disabled])")?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={onClose}
      onClose={onClose}
      className="m-auto w-[calc(100vw-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-6 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <Button type="button" variant="ghost" size="icon" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>✕</Button>
      </div>
      <p id={descriptionId} className="my-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </dialog>
  )
}
