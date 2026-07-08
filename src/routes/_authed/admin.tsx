import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Users, LayoutTemplate, Activity, Radio, Trash2, RefreshCcw, Plus } from "lucide-react"

export const Route = createFileRoute('/_authed/admin')({
  component: AdminRoute,
})

function AdminRoute() {
  const stats = useQuery(api.admin.getStats)
  const creators = useQuery(api.roster.getAllCreators, {})
  
  const addCreator = useMutation(api.admin.addCreator)
  const removeCreator = useMutation(api.admin.removeCreator)
  const forceRefresh = useAction(api.admin.forceLiveStatusRefresh)

  const [platform, setPlatform] = useState<string>("twitch")
  const [username, setUsername] = useState("")
  const [platformId, setPlatformId] = useState("")
  const [category, setCategory] = useState("Student")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleAddCreator = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username) return toast.error("Username is required")
    
    try {
      await addCreator({
        platform: platform as any,
        username,
        platformId: platform === "custom" ? platformId : undefined,
        category,
      })
      toast.success("Creator added to roster!")
      setUsername("")
      setPlatformId("")
    } catch (err: any) {
      toast.error(err.message || "Failed to add creator")
    }
  }

  const handleRemove = async (id: any) => {
    if (!window.confirm("Are you sure you want to remove this creator from the roster?")) return
    try {
      await removeCreator({ creatorId: id })
      toast.success("Creator removed.")
    } catch (err: any) {
      toast.error(err.message || "Failed to remove creator")
    }
  }

  const handleForceRefresh = async () => {
    setIsRefreshing(true)
    try {
      await forceRefresh()
      toast.success("Live status refreshed!")
    } catch (err: any) {
      toast.error(err.message || "Failed to refresh live status")
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage the platform, creators, and view analytics.</p>
        </div>
        <Button 
          onClick={handleForceRefresh} 
          disabled={isRefreshing}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Force Live Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Creators</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.totalCreators ?? "..."}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Currently Live</CardTitle>
            <Radio className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.currentlyLive ?? "..."}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total StreamLists</CardTitle>
            <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.totalLayouts ?? "..."}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registered Users</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.totalUsers ?? "..."}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Creator Roster Table */}
        <Card className="lg:col-span-2 bg-card border-border shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Roster Management</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Creator</th>
                    <th className="px-6 py-3 font-semibold">Platform</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {creators === undefined ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading roster...</td>
                    </tr>
                  ) : creators.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No creators in roster.</td>
                    </tr>
                  ) : creators.map((creator: any) => (
                    <tr key={creator._id} className="bg-card hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <img src={creator.avatarUrl || `https://avatar.vercel.sh/${creator.username}`} className="w-8 h-8 rounded-full" />
                          <div>
                            <div className="font-semibold text-foreground">{creator.username}</div>
                            <div className="text-xs text-muted-foreground">{creator.categories?.join(", ")}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant="outline" className="capitalize text-xs font-medium">
                          {creator.platform}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        {creator.isLive ? (
                          <div className="flex items-center gap-1.5 text-red-500 font-semibold text-xs">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            LIVE ({creator.viewerCount?.toLocaleString()})
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs font-medium">Offline</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRemove(creator._id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Add Creator Form */}
        <Card className="bg-card border-border shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Add to Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCreator} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Platform</label>
                <Select value={platform} onValueChange={(val: string | null) => setPlatform(val || "twitch")}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twitch">Twitch</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="kick">Kick</SelectItem>
                    <SelectItem value="custom">Custom URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {platform === "custom" ? "Display Name" : "Username / Channel ID"}
                </label>
                <Input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={platform === "custom" ? "e.g. Lofi Girl 24/7" : "e.g. tarik"}
                  className="bg-background"
                />
              </div>

              {platform === "custom" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Stream URL</label>
                  <Input 
                    type="url" 
                    value={platformId}
                    onChange={(e) => setPlatformId(e.target.value)}
                    placeholder="https://example.com/embed/..."
                    className="bg-background"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be an embed-friendly URL. Standard web links may be blocked by the provider.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Category</label>
                <Select value={category} onValueChange={(val: string | null) => setCategory(val || "Student")}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Student">Student</SelectItem>
                    <SelectItem value="Professor">Professor</SelectItem>
                    <SelectItem value="Janitor">Janitor</SelectItem>
                    <SelectItem value="Campus Police">Campus Police</SelectItem>
                    <SelectItem value="Club Director">Club Director</SelectItem>
                    <SelectItem value="Librarian/Counselor">Librarian/Counselor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full mt-2 font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Add Creator
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
