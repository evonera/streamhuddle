import { createFileRoute } from '@tanstack/react-router'
import { RosterLayout } from '@/components/roster-layout'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/university')({
  component: UniversityPage,
})

function UniversityPage() {
  const [showNotice, setShowNotice] = useState(false)

  useEffect(() => {
    const isDismissed = localStorage.getItem('streamer-university-notice-dismissed')
    if (!isDismissed) {
      setShowNotice(true)
    }
  }, [])

  const handleDismiss = () => {
    setShowNotice(false)
    localStorage.setItem('streamer-university-notice-dismissed', 'true')
  }

  return (
    <div className="min-h-screen bg-background w-full flex flex-col">
      {showNotice && (
        <div className="relative w-full bg-zinc-900 border-b border-border py-2 px-4 text-center pr-10">
          <p className="text-xs text-muted-foreground font-mono">
            <span className="text-primary font-bold">Note:</span> StreamHuddle is not affiliated with StreamerUniversity and KaiCenat, this is solely for users.
          </p>
          <button onClick={handleDismiss} aria-label="Dismiss notice" className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>
      )}
      <div className="flex-1">
        <RosterLayout autoLoadAll={true} />
      </div>
    </div>
  )
}
