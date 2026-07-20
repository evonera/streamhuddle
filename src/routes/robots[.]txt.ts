import { createFileRoute } from '@tanstack/react-router'
import { SITE_URL } from '@/lib/site'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        const robots = `User-agent: *
Allow: /

# Block known AI training crawlers. Search/citation bots (Googlebot,
# OAI-SearchBot, Claude-SearchBot, PerplexityBot) remain allowed above.
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: CCBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Amazonbot
User-agent: Bytespider
User-agent: meta-externalagent
User-agent: Omgilibot
User-agent: FacebookBot
User-agent: anthropic-ai
User-agent: cohere-ai
Disallow: /

Sitemap: ${SITE_URL}/sitemap.xml`

        return new Response(robots, {
          headers: {
            'Content-Type': 'text/plain',
          },
        })
      },
    },
  },
})
