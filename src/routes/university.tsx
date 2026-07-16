import { createFileRoute } from '@tanstack/react-router'
import { RosterLayout } from '@/components/roster-layout'

export const Route = createFileRoute('/university')({
  component: UniversityPage,
})

function UniversityPage() {
  return (
    <div className="min-h-screen bg-background w-full flex flex-col">
      <div className="w-full bg-zinc-900 border-b border-border py-2 px-4 text-center">
        <p className="text-xs text-muted-foreground font-mono">
          <span className="text-primary font-bold">Note:</span> StreamHuddle is not affiliated with StreamerUniversity and KaiCenat, this is solely for users.
        </p>
      </div>
      <div className="flex-1">
        <RosterLayout autoLoadAll={true} />
      </div>
    </div>
  )
}
