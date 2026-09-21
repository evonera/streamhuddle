import { createFileRoute } from '@tanstack/react-router'
import { RosterLayout } from '@/components/roster-layout'
import { seo } from '@/lib/seo'
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site'
import { z } from "zod"

const searchSchema = z.object({
  list: z.string().optional(),
  streams: z.string().optional(),
})

export const Route = createFileRoute('/roster')({
  validateSearch: searchSchema,
  head: () => ({
    meta: seo({
      title: "Watch — StreamHuddle",
      description: SITE_DESCRIPTION,
      image: "/og.png",
      url: `${SITE_URL}/roster`,
    }),
    links: [{ rel: "canonical", href: `${SITE_URL}/roster` }],
  }),
  component: RosterPage,
})

function RosterPage() {
  const { list, streams } = Route.useSearch()

  return (
    <div className="min-h-screen bg-background w-full">
      <RosterLayout initialListId={list} initialStreamsParam={streams} />
    </div>
  )
}
