import { createFileRoute } from '@tanstack/react-router'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const content = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

## Key Facts
- Built with TanStack Start
- Supports React 19
- Uses Convex + Better Auth for backend and authentication
- Watch multiple Twitch, Kick, YouTube, and Custom live streams simultaneously. Build and share your perfect StreamLists.

## Contact
- Website: ${SITE_URL}
- GitHub: https://github.com/ramonclaudio/tanvex
`

        return new Response(content, {
          headers: {
            'Content-Type': 'text/plain',
          },
        })
      },
    },
  },
})
