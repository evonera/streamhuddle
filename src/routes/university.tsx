import { createFileRoute } from '@tanstack/react-router'
import { RosterLayout } from '@/components/roster-layout'

export const Route = createFileRoute('/university')({
  component: UniversityPage,
})

function UniversityPage() {
  return (
    <div className="min-h-screen bg-background w-full">
      <RosterLayout autoLoadAll={true} />
    </div>
  )
}
