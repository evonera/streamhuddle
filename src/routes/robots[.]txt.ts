import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        // Use process.env.SITE_URL injected by vite.config.ts to perfectly match the sitemap plugin
        const siteUrl = process.env.SITE_URL || "http://localhost:3000"
        
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

Sitemap: ${siteUrl}/sitemap.xml`

        return new Response(robots, {
          headers: {
            'Content-Type': 'text/plain',
          },
        })
      },
    },
  },
})
