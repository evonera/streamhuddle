import { createFileRoute } from "@tanstack/react-router"
import { seo } from "@/lib/seo"
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site"

import Landing01Demo from "@/components/home/demo"

export const Route = createFileRoute("/")({
  head: () => ({
    meta: seo({
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      image: "/og.png",
      url: SITE_URL,
    }),
    links: [{ rel: "canonical", href: SITE_URL }],
  }),
  component: Landing01Demo,
})
