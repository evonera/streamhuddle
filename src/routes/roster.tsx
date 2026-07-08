import { createFileRoute } from '@tanstack/react-router'
import { RosterLayout } from '@/components/roster-layout'
import { z } from "zod"

const searchSchema = z.object({
  list: z.string().optional(),
})

export const Route = createFileRoute('/roster')({
  validateSearch: searchSchema,
  component: RosterPage,
})

function RosterPage() {
  const { list } = Route.useSearch()

  return (
    <div className="min-h-screen bg-background w-full">
      <RosterLayout initialListId={list} />
    </div>
  )
}
