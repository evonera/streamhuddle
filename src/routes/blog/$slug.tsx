import { createFileRoute, notFound } from '@tanstack/react-router'
import { allPosts } from 'content-collections'
import { MDXContent } from '@content-collections/mdx/react'
import { Card, CardContent } from '@/components/ui/card'
import { HugeiconsIcon } from '@hugeicons/react'
import ArrowLeft01Icon from '@hugeicons/core-free-icons/ArrowLeft01Icon'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/blog/$slug')({
  loader: ({ params }) => {
    const post = allPosts.find((p) => p.slug === params.slug)
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] }
    return {
      meta: [
        { title: `${loaderData.title} - SquadView Blog` },
        { name: 'description', content: loaderData.description }
      ]
    }
  },
  component: BlogPostComponent,
})

function BlogPostComponent() {
  const post = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-background relative pb-24">
      <div className="max-w-4xl mx-auto w-full px-6 lg:px-8 mt-12">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4" />
          Back to Blog
        </Link>
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {post.thumbnail && (
            <div className="w-full h-64 md:h-96 relative overflow-hidden bg-muted">
              <img
                src={post.thumbnail}
                alt={post.title}
                className="object-cover w-full h-full"
              />
            </div>
          )}
          <CardContent className="p-8 md:p-12">
            <header className="mb-8 border-b border-border/50 pb-8">
              <h1 className="font-heading text-4xl md:text-5xl tracking-tight font-bold mb-4">
                {post.title}
              </h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <time className="text-sm font-medium">
                  {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </time>
                {post.tags && post.tags.length > 0 && (
                  <div className="flex gap-2">
                    {post.tags.map(tag => (
                      <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </header>
            
            <article className="prose prose-invert prose-lg max-w-none prose-headings:font-heading prose-a:text-primary hover:prose-a:text-primary/80">
              <MDXContent code={post.mdx} />
            </article>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
