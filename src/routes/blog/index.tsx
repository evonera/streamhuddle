import { createFileRoute, Link } from '@tanstack/react-router'
import { allPosts } from 'content-collections'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/blog/')({
  component: BlogComponent,
  head: () => ({
    meta: [
      { title: 'Blog - SquadView' },
      { name: 'description', content: 'Latest news, guides, and tips for streamers.' }
    ]
  })
})

function BlogComponent() {
  const sortedPosts = [...allPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="min-h-screen bg-background relative pb-24">
      <div className="p-6 border-b border-border flex flex-col gap-6 min-h-[250px] justify-center relative z-10 bg-card/30">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-4xl md:text-5xl tracking-tighter font-bold">
              SquadView Blog
            </h1>
            <p className="text-muted-foreground text-sm md:text-base lg:text-lg">
              Latest news, multistreaming guides, and updates.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative overflow-hidden">
          {sortedPosts.map((post) => (
            <Link key={post.slug} to="/blog/$slug" params={{ slug: post.slug }} className="group block h-full">
              <Card className="h-full bg-card/50 border-border/50 transition-colors hover:bg-muted/50 overflow-hidden flex flex-col">
                {post.thumbnail && (
                  <div className="relative w-full h-48 overflow-hidden bg-muted">
                    <img
                      src={post.thumbnail}
                      alt={post.title}
                      className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}
                <CardContent className="p-6 flex flex-col flex-grow gap-3">
                  <h3 className="text-xl font-semibold text-card-foreground group-hover:underline underline-offset-4 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-3 flex-grow">
                    {post.description}
                  </p>
                  <time className="block text-sm font-medium text-muted-foreground pt-4 mt-auto border-t border-border/50">
                    {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </time>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
