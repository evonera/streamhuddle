import { createFileRoute } from '@tanstack/react-router'


export const Route = createFileRoute('/streamer/$username')({
  component: StreamerProfileRoute,
})

function StreamerProfileRoute() {
  const { username } = Route.useParams()
  // Wait, we need a query to fetch a streamer by username
  // For now, this is just a placeholder component
  // const streamer = useQuery(api.creators.getByUsername, { username })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-6 mb-8">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          {/* <img src={streamer?.avatarUrl} alt={username} className="w-full h-full object-cover" /> */}
          <span className="text-2xl font-bold">{username.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold">{username}</h1>
          <p className="text-muted-foreground mt-2">
            Streamer description will go here...
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-2">Live Status</h3>
          <p>This will show if they are currently live, their viewer count, and the stream title.</p>
        </div>
        
        <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
          <h3 className="font-semibold text-lg mb-2">Events</h3>
          <p>This will list the events this creator is participating in (e.g., Streamer University).</p>
        </div>
      </div>
    </div>
  )
}
