import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion } from 'framer-motion'
import { Eye, MonitorPlay, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/discover')({
  component: DiscoverPage,
})

function DiscoverPage() {
  const streamLists = useQuery(api.roster.getDiscoverStreamLists)

  return (
    <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold font-sans tracking-tight">Discover</h1>
          <p className="text-muted-foreground">
            Explore the most popular StreamLists curated by the community.
          </p>
        </div>

        {!streamLists ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 rounded-xl bg-zinc-900/50 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : streamLists.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-zinc-950/30">
            <MonitorPlay className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No StreamLists found yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streamLists.map((list, i) => (
              <motion.div
                key={list._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to="/roster"
                  search={{ list: list._id }}
                  className="block h-full group"
                >
                  <Card className="h-full bg-zinc-950 border-white/10 group-hover:border-primary/50 transition-colors duration-300 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-xl font-bold line-clamp-1 group-hover:text-primary transition-colors">
                          {list.name}
                        </CardTitle>
                        <Badge variant="secondary" className="shrink-0 flex items-center gap-1 bg-zinc-900 text-zinc-300 border-white/5">
                          <Eye className="w-3 h-3" /> {list.views}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <Users className="w-3 h-3" />
                        By {list.authorName}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {list.previewStreams.map((s, idx) => (
                          <Badge key={idx} variant="outline" className="border-white/10 bg-black/40 text-xs">
                            {s.type === 'chat' ? '💬 ' : '📺 '} {s.username}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
