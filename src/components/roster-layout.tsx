import { useQuery, useMutation } from 'convex/react'
import { api } from "@convex/_generated/api"
import { useState, useEffect } from 'react'
import { type StreamData } from '@/components/player/StreamPlayer'
import { StreamGrid } from '@/components/player/StreamGrid'
import { ChatBox } from '@/components/player/ChatBox'
import { UserMenu } from "@/components/user-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Link, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import Home01Icon from "@hugeicons/core-free-icons/Home01Icon"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import PanelLeftCloseIcon from "@hugeicons/core-free-icons/PanelLeftCloseIcon"
import PanelLeftOpenIcon from "@hugeicons/core-free-icons/PanelLeftOpenIcon"
import PanelRightCloseIcon from "@hugeicons/core-free-icons/PanelRightCloseIcon"
import PanelRightOpenIcon from "@hugeicons/core-free-icons/PanelRightOpenIcon"
import Message01Icon from "@hugeicons/core-free-icons/Message01Icon"
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon"
import Share01Icon from "@hugeicons/core-free-icons/Share01Icon"
import Tv01Icon from "@hugeicons/core-free-icons/Tv01Icon"
import Maximize01Icon from "@hugeicons/core-free-icons/Maximize01Icon"
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function RosterLayout({ initialListId, autoLoadAll }: { initialListId?: string, autoLoadAll?: boolean }) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>()
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  
  const [activeLayoutName, setActiveLayoutName] = useState("")
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(initialListId || null)
  const [activeStreams, setActiveStreams] = useState<StreamData[]>([])
  const [gridSize, setGridSize] = useState<"auto" | number>("auto")
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  
  // Auto-close sidebars on mobile on mount (SSR safe)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setLeftSidebarOpen(false)
      setRightSidebarOpen(false)
    }
  }, [])
  
  const [theaterMode, setTheaterMode] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && theaterMode) {
        setTheaterMode(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [theaterMode])

  useEffect(() => {
    if (activeStreams.length > 0 && (!activeChatId || !activeStreams.find(s => s.id === activeChatId))) {
      setActiveChatId(activeStreams[0].id)
    } else if (activeStreams.length === 0) {
      setActiveChatId(null)
    }
  }, [activeStreams, activeChatId])

  const filtersQuery = useQuery(api.roster.getCountriesAndLanguages)
  const creatorsQuery = useQuery(api.roster.getAllCreators, {
    language: selectedLanguage,
    category: selectedCategory
  })
  
  const userLayouts = useQuery(api.roster.getUserLayouts)
  const saveLayoutMutation = useMutation(api.roster.saveLayout)
  const incrementViewsMutation = useMutation(api.roster.incrementStreamListViews)
  const sharedListQuery = useQuery(api.roster.getStreamListById, initialListId ? { id: initialListId as any } : "skip")

  // Auto-load shared list
  useEffect(() => {
    if (sharedListQuery && creatorsQuery && activeStreams.length === 0 && activeLayoutId === initialListId) {
      const loadedStreams = sharedListQuery.streams.map((s, idx) => {
        const creator = creatorsQuery.find(c => c._id === s.creatorId)
        if (!creator) return null
        return {
          id: creator._id,
          platform: creator.platform as any,
          channel: creator.platform === "custom" && creator.platformId ? creator.platformId : creator.username,
          displayName: creator.username,
          type: s.type || "stream",
          gridIndex: idx
        }
      }).filter(Boolean) as StreamData[]
      setActiveLayoutName(sharedListQuery.name)
      setActiveStreams(loadedStreams)
      incrementViewsMutation({ id: initialListId as any }).catch(console.error)
    }
  }, [sharedListQuery, creatorsQuery])

  // Auto-load all creators for specific routes (like /university)
  useEffect(() => {
    if (autoLoadAll && creatorsQuery && activeStreams.length === 0 && !activeLayoutId) {
      const loadedStreams = creatorsQuery.slice(0, 20).map((creator, idx) => ({
        id: creator._id,
        platform: creator.platform as any,
        channel: creator.platform === "custom" && creator.platformId ? creator.platformId : creator.username,
        displayName: creator.username,
        type: "stream" as const,
        gridIndex: idx
      }))
      setActiveStreams(loadedStreams)
    }
  }, [autoLoadAll, creatorsQuery, activeLayoutId, activeStreams.length])

  const handleAddCell = (creator: any, type: "stream" | "chat") => {
    setActiveStreams(prev => {
      // Check if this exact cell is already there
      const exists = prev.find(s => s.id === creator._id && s.type === type)
      if (exists) {
        return prev.filter(s => !(s.id === creator._id && s.type === type))
      } else {
        if (prev.length >= 20) {
          toast.error("Absolute limit of 20 cells reached.")
          return prev;
        }
        
        let nextGridIndex = prev.length;
        if (gridSize !== "auto") {
          const usedIndices = new Set(prev.map(s => s.gridIndex).filter(i => i !== undefined));
          for (let i = 0; i < gridSize; i++) {
            if (!usedIndices.has(i)) {
              nextGridIndex = i;
              break;
            }
          }
          if (nextGridIndex >= gridSize) {
            toast.error("Grid is full. Increase grid size or remove a stream.");
            return prev;
          }
        } else {
          if (prev.length === 8) {
            toast.warning("Warning: Loading more than 8 streams requires significant RAM and bandwidth. Your browser may experience lag.")
          }
        }
        
        return [...prev, {
          id: creator._id,
          platform: creator.platform as any,
          channel: creator.platform === "custom" && creator.platformId ? creator.platformId : creator.username,
          displayName: creator.username,
          type,
          gridIndex: nextGridIndex
        }]
      }
    })
  }

  const handleSwapStream = (draggedId: string, draggedType: "stream" | "chat", targetGridIndex: number) => {
    setActiveStreams(prev => {
      const draggedIndex = prev.findIndex(s => s.id === draggedId && s.type === draggedType);
      if (draggedIndex === -1) return prev;
      
      const newStreams = [...prev];
      const targetIndex = newStreams.findIndex(s => s.gridIndex === targetGridIndex);
      
      const oldGridIndex = newStreams[draggedIndex].gridIndex ?? draggedIndex;
      
      newStreams[draggedIndex] = { ...newStreams[draggedIndex], gridIndex: targetGridIndex };
      if (targetIndex !== -1) {
        newStreams[targetIndex] = { ...newStreams[targetIndex], gridIndex: oldGridIndex };
      }
      return newStreams;
    });
  };

  const handleSaveLayout = async () => {
    if (!activeLayoutName) {
      toast.error("Please enter a StreamList name.");
      return;
    }
    if (activeStreams.length === 0) {
      toast.error("Please add at least one stream to save a StreamList.");
      return;
    }
    try {
      const res = await saveLayoutMutation({
        name: activeLayoutName,
        creatorIds: activeStreams.map(s => ({ id: s.id as any, type: s.type || "stream" }))
      })
      if (res.layoutId) setActiveLayoutId(res.layoutId)
      toast.success("StreamList saved successfully!")
    } catch (e: any) {
      toast.error(e.message || "Failed to save StreamList.")
      if (e.message && e.message.includes("Free tier")) {
        navigate({ to: "/pricing" })
      }
    }
  }

  // Filter to only actual video streams for the Universal Chat selector
  const videoStreams = activeStreams.filter(s => !s.type || s.type === "stream");
  const activeChatStream = videoStreams.find(s => s.id === activeChatId) || videoStreams[0];

  const filteredCreators = creatorsQuery?.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col md:flex-row w-full h-screen md:p-2 gap-2 bg-background overflow-hidden relative">
      
      {/* Mobile Notice & Navbar */}
      <div className="md:hidden flex flex-col w-full shrink-0 z-10">
        <div className="bg-yellow-500/20 border-b border-yellow-500/50 text-yellow-200 text-[10px] sm:text-xs p-1.5 text-center flex items-center justify-center gap-2">
          <HugeiconsIcon icon={Tv01Icon} size={14} />
          Computer recommended for the best experience!
        </div>
        {!theaterMode && (
          <div className="flex items-center justify-between p-2 bg-card border-b border-border shadow-sm">
            <button onClick={() => setLeftSidebarOpen(true)} className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded text-foreground transition-colors">
              <HugeiconsIcon icon={PanelLeftOpenIcon} size={18} />
            </button>
            <div className="font-bold text-sm tracking-tight text-foreground/90">StreamHuddle</div>
            <button onClick={() => setRightSidebarOpen(true)} className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded text-foreground transition-colors">
              <HugeiconsIcon icon={PanelRightOpenIcon} size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Left Sidebar: Roster */}
      {leftSidebarOpen && !theaterMode && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setLeftSidebarOpen(false)} />
          <div className="fixed md:relative top-0 left-0 md:top-auto md:left-auto z-[70] md:z-40 w-[85vw] max-w-[320px] md:w-80 shrink-0 h-full md:h-[calc(100vh-1rem)] flex flex-col gap-4 bg-card border-r md:border border-border md:rounded-xl p-4 shadow-2xl md:shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h2 className="font-bold text-foreground">Roster</h2>
            <button onClick={() => setLeftSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
              <HugeiconsIcon icon={PanelLeftCloseIcon} size={20} />
            </button>
          </div>
          
          <div className="flex flex-col gap-2 text-sm">
            <div className="relative">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search streamer..."
                className="pl-8 h-8 text-xs bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? undefined : (v as string))}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Student">Student</SelectItem>
                  <SelectItem value="Professor">Professor</SelectItem>
                  <SelectItem value="Janitor">Janitor</SelectItem>
                  <SelectItem value="Campus Police">Campus Police</SelectItem>
                  <SelectItem value="Club Director">Club Director</SelectItem>
                  <SelectItem value="Librarian/Counselor">Librarian/Counselor</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedLanguage || "all"} onValueChange={(v) => setSelectedLanguage(v === "all" ? undefined : (v as string))}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {filtersQuery?.languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2 mt-2 overflow-y-auto pr-1 no-scrollbar">
            {filteredCreators === undefined ? (
              <div className="text-muted-foreground text-sm text-center pt-4">Loading creators...</div>
            ) : filteredCreators.map(creator => (
              <div 
                key={creator._id}
                className={`p-2 rounded-lg border relative transition-all ${
                  !creator.isLive ? 'opacity-60 hover:opacity-100 grayscale hover:grayscale-0' : ''
                } bg-background border-border hover:border-primary/50`}
              >
                <div className="flex items-center gap-3">
                  <img src={creator.avatarUrl || `https://avatar.vercel.sh/${creator.username}`} className="w-8 h-8 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="font-semibold text-foreground text-sm leading-tight">{creator.username}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{creator.platform}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                  <button
                    onClick={() => handleAddCell(creator, "stream")}
                    className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs transition-colors ${
                      activeStreams.find(s => s.id === creator._id && (!s.type || s.type === "stream"))
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-zinc-800/50 hover:bg-zinc-800 text-muted-foreground'
                    }`}
                  >
                    <HugeiconsIcon icon={Tv01Icon} size={14} /> Stream
                  </button>
                  <button
                    onClick={() => handleAddCell(creator, "chat")}
                    className={`flex-1 flex items-center justify-center gap-1 p-1.5 rounded text-xs transition-colors ${
                      activeStreams.find(s => s.id === creator._id && s.type === "chat")
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-zinc-800/50 hover:bg-zinc-800 text-muted-foreground'
                    }`}
                  >
                    <HugeiconsIcon icon={Message01Icon} size={14} /> Chat
                  </button>
                </div>
                {creator.isLive ? (
                  <div className="absolute top-2 right-2 flex flex-col items-end">
                    <div className="flex items-center gap-1 text-red-500 font-bold text-[10px] uppercase animate-pulse">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Live
                    </div>
                    {creator.viewerCount && (
                      <div className="text-[9px] font-bold text-muted-foreground bg-background/50 px-1 rounded mt-0.5">
                        {creator.viewerCount.toLocaleString()} Viewers
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 text-[10px] text-muted-foreground font-medium">Offline</div>
                )}
              </div>
            ))}
          </div>
        </div>
        </>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 h-full md:h-[calc(100vh-1rem)] p-2 md:p-0">
        
        {/* Sleek Toolbar */}
        {!theaterMode && (
          <div className="hidden md:flex items-center justify-between bg-card/50 backdrop-blur-md border border-border rounded-xl px-4 py-2 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            {!leftSidebarOpen && (
              <button onClick={() => setLeftSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
                <HugeiconsIcon icon={PanelLeftOpenIcon} size={20} />
              </button>
            )}
            
            <Link
              to="/"
              aria-label="Home"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-8 w-8 [&_svg]:size-4 hidden sm:flex"
              )}
            >
              <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
            </Link>
            
            <div className="h-4 w-px bg-border mx-1 hidden sm:block"></div>
            
            <div className="hidden md:flex items-center gap-2">
              <Input 
                type="text" 
                placeholder="StreamList Name..."
                className="h-8 text-xs w-40"
                value={activeLayoutName}
                onChange={e => setActiveLayoutName(e.target.value)}
              />
              <Button 
                onClick={handleSaveLayout}
                size="sm"
                className="h-8 text-xs font-semibold"
              >
                Save
              </Button>
              {activeLayoutId && (
                <Button 
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("list", activeLayoutId);
                    navigator.clipboard.writeText(url.toString());
                    toast.success("Share link copied to clipboard!");
                  }}
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0"
                  title="Share StreamList"
                >
                  <HugeiconsIcon icon={Share01Icon} className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Grid Size Selector */}
          <div className="hidden lg:flex items-center gap-1 bg-zinc-900/50 rounded-lg p-1 border border-border mx-2">
            {(["auto", 1, 2, 3, 4, 5, 6, 8, 12, 16] as const).map(size => (
              <button
                key={size}
                onClick={() => setGridSize(size)}
                className={`w-7 h-7 flex items-center justify-center rounded text-xs font-semibold transition-colors ${
                  gridSize === size 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800'
                }`}
              >
                {size === "auto" ? "A" : size}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Select 
              value="none" 
              onValueChange={(val) => {
                if (val !== "none") {
                  const layout = userLayouts?.find(l => l._id === val)
                  if (layout && creatorsQuery) {
                    const loadedStreams = layout.streams.map((s, idx) => {
                      const creator = creatorsQuery.find(c => c._id === s.creatorId)
                      if (!creator) return null
                      return {
                        id: creator._id,
                        platform: creator.platform as any,
                        channel: creator.platform === "custom" && creator.platformId ? creator.platformId : creator.username,
                        displayName: creator.username,
                        type: s.type || "stream",
                        gridIndex: idx
                      }
                    }).filter(Boolean) as StreamData[]
                    setActiveLayoutName(layout.name)
                    setActiveLayoutId(layout._id)
                    setActiveStreams(loadedStreams)
                  }
                }
              }}
            >
              <SelectTrigger className="h-8 w-[140px] md:w-[160px] text-xs bg-background">
                <SelectValue placeholder="Load StreamList..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Load StreamList...</SelectItem>
                {userLayouts?.map(l => (
                  <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="h-4 w-px bg-border mx-1"></div>
            <button
              onClick={() => {
                setTheaterMode(true)
                toast("Zen Mode Activated", { description: "Press ESC to exit zen mode." })
              }}
              className="text-muted-foreground hover:text-foreground flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent"
              title="Enter Zen Mode"
            >
              <HugeiconsIcon icon={Maximize01Icon} size={18} />
            </button>

            <div className="h-4 w-px bg-border mx-1"></div>
            <UserMenu />
            <ThemeToggle />

            {!rightSidebarOpen && (
              <>
                <div className="h-4 w-px bg-border mx-1"></div>
                <button onClick={() => setRightSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
                  <HugeiconsIcon icon={PanelRightOpenIcon} size={20} />
                </button>
              </>
            )}
          </div>
        </div>
        )}
        
        {/* The Grid */}
        <div className="flex-1 rounded-xl overflow-hidden border border-border shadow-2xl bg-background relative">
          <StreamGrid 
            streams={activeStreams} 
            gridSize={gridSize}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            onRemoveStream={(id, type) => setActiveStreams(prev => prev.filter(s => !(s.id === id && s.type === type)))}
            onAddStreamClick={() => setLeftSidebarOpen(true)}
            onSwapStream={handleSwapStream}
          />
          
          {/* Escape Theater Mode Overlay */}
          {theaterMode && (
            <div className="absolute top-4 right-4 opacity-0 hover:opacity-100 transition-opacity z-50">
              <Button onClick={() => setTheaterMode(false)} variant="secondary" className="bg-background/50 backdrop-blur hover:bg-background/80">
                Exit Theater Mode (ESC)
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Chat */}
      {rightSidebarOpen && !theaterMode && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setRightSidebarOpen(false)} />
          <div className="fixed md:relative top-0 right-0 md:top-auto md:right-auto z-[70] md:z-40 w-[85vw] max-w-[340px] md:w-80 shrink-0 h-full md:h-[calc(100vh-1rem)] flex flex-col bg-card border-l md:border border-border md:rounded-xl shadow-2xl md:shadow-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border bg-card/80 backdrop-blur shrink-0">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Message01Icon} size={16} className="text-primary" />
              <h2 className="font-bold text-foreground text-sm">Universal Chat</h2>
            </div>
            <button onClick={() => setRightSidebarOpen(false)} className="text-muted-foreground hover:text-foreground">
              <HugeiconsIcon icon={PanelRightCloseIcon} size={18} />
            </button>
          </div>

          {videoStreams.length > 0 && (
            <div className="p-2 border-b border-border bg-background shrink-0">
              <Select value={activeChatId || ""} onValueChange={setActiveChatId}>
                <SelectTrigger className="w-full text-xs h-8">
                  <SelectValue placeholder="Select stream chat" />
                </SelectTrigger>
                <SelectContent>
                  {videoStreams.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="capitalize text-muted-foreground mr-1">[{s.platform}]</span> 
                      {s.displayName || s.channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex-1 bg-background overflow-hidden relative">
            {videoStreams.length > 0 && activeChatStream ? (
              <ChatBox 
                platform={activeChatStream.platform} 
                channel={activeChatStream.channel} 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm">
                Add streams to view chat
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  )
}
