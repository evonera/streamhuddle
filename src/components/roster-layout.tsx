import { useQuery, useMutation } from 'convex/react'
import { api } from "@convex/_generated/api"
import { useState, useEffect, useRef } from 'react'
import { type StreamData } from '@/components/player/StreamPlayer'
import { StreamGrid } from '@/components/player/StreamGrid'
import { ChatBox } from '@/components/player/ChatBox'
import { UserMenu } from "@/components/user-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Link } from "@tanstack/react-router"
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
import Search02Icon from "@hugeicons/core-free-icons/Search02Icon"
import Share01Icon from "@hugeicons/core-free-icons/Share01Icon"
import Tv01Icon from "@hugeicons/core-free-icons/Tv01Icon"
import Maximize01Icon from "@hugeicons/core-free-icons/Maximize01Icon"
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon"
import FloppyDiskIcon from "@hugeicons/core-free-icons/FloppyDiskIcon"
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useConvexAuth } from 'convex/react'
import Video01Icon from "@hugeicons/core-free-icons/Video01Icon"
import { ClipModal } from "./clip/ClipModal"
import { authClient } from "@/lib/auth-client"

const SESSION_STORAGE_KEY = 'streamhuddle-session'

function loadSession(): StreamData[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!saved) return []
    return JSON.parse(saved) as StreamData[]
  } catch {
    return []
  }
}

function saveSession(streams: StreamData[]) {
  if (typeof window === 'undefined') return
  try {
    if (streams.length === 0) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(streams))
    }
  } catch {
    // ignore quota errors
  }
}

export function RosterLayout({ initialListId, autoLoadAll }: { initialListId?: string, autoLoadAll?: boolean }) {

  const { isAuthenticated } = useConvexAuth()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>()
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false)
  const [layoutSearch, setLayoutSearch] = useState("")
  const layoutPickerRef = useRef<HTMLDivElement>(null)

  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(initialListId || null)
  const [activeStreams, setActiveStreams] = useState<StreamData[]>([])
  const [gridSize, setGridSize] = useState<"auto" | number>("auto")
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)

  const [addStreamDialog, setAddStreamDialog] = useState<{isOpen: boolean; gridIndex?: number}>({ isOpen: false })
  const [customUrlInput, setCustomUrlInput] = useState("")

  // Save layout dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveLayoutName, setSaveLayoutName] = useState("")
  const saveLayoutMutation = useMutation(api.roster.saveLayout)
  const [isSaving, setIsSaving] = useState(false)

  // Clip state
  const [clipModalOpen, setClipModalOpen] = useState(false)
  
  // User isPro check (via BetterAuth or Convex)
  const { data: session } = authClient.useSession()
  const isPro = (session?.user as any)?.isPro || false

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setLeftSidebarOpen(false)
      setRightSidebarOpen(false)
    }
  }, [])

  // Close layout picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (layoutPickerRef.current && !layoutPickerRef.current.contains(e.target as Node)) {
        setLayoutPickerOpen(false)
      }
    }
    if (layoutPickerOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [layoutPickerOpen])
  
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
    const vStreams = activeStreams.filter(s => !s.type || s.type === "stream");
    if (vStreams.length > 0 && (!activeChatId || !vStreams.find(s => s.id === activeChatId))) {
      setActiveChatId(vStreams[0].id)
    } else if (vStreams.length === 0) {
      setActiveChatId(null)
    }
  }, [activeStreams, activeChatId])

  const filtersQuery = useQuery(api.roster.getCountriesAndLanguages)
  const creatorsQuery = useQuery(api.roster.getAllCreators, {
    language: selectedLanguage,
    category: selectedCategory
  })
  
  const userLayouts = useQuery(api.roster.getUserLayouts)
  const discoverLayouts = useQuery(api.roster.getDiscoverStreamLists)
  
  // Combine user layouts and discover layouts, avoiding duplicates (user layouts take precedence)
  const allLayouts = (() => {
    const combined = [...(userLayouts || [])]
    if (discoverLayouts) {
      discoverLayouts.forEach(dl => {
        if (!combined.find(l => l._id === dl._id)) {
          combined.push(dl as any)
        }
      })
    }
    return combined
  })()

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
      setActiveStreams(loadedStreams)
      setGridSize("auto")
      incrementViewsMutation({ id: initialListId as any }).catch(console.error)
    }
  }, [sharedListQuery, creatorsQuery])

  // Auto-load all creators for specific routes (like /university)
  const hasAutoLoadedRef = useRef(false)
  useEffect(() => {
    if (hasAutoLoadedRef.current) return
    if (autoLoadAll && creatorsQuery && activeStreams.length === 0 && !activeLayoutId) {
      const loadedStreams = (creatorsQuery || []).slice(0, 20).map((creator, idx) => ({
        id: creator._id,
        platform: creator.platform as any,
        channel: creator.platform === "custom" && creator.platformId ? creator.platformId : creator.username,
        displayName: creator.username,
        type: "stream" as const,
        gridIndex: idx
      }))
      setActiveStreams(loadedStreams)
      hasAutoLoadedRef.current = true
    }
  }, [autoLoadAll, creatorsQuery, activeLayoutId, activeStreams.length])

  // Restore anonymous session from localStorage (only when no initialListId and not autoLoadAll)
  const sessionLoadedRef = useRef(false)
  useEffect(() => {
    if (sessionLoadedRef.current) return
    if (initialListId || autoLoadAll) return
    const saved = loadSession()
    if (saved.length > 0) {
      setActiveStreams(saved)
      sessionLoadedRef.current = true
      toast.info("Session restored from last visit", {
        description: isAuthenticated ? "Save it permanently from the toolbar." : "Sign in to save it permanently.",
        duration: 4000,
      })
    }
  }, [initialListId, autoLoadAll, isAuthenticated])

  // Auto-save session to localStorage whenever streams change
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    // Don't clobber a shared-list view
    if (initialListId) return
    saveSession(activeStreams)
  }, [activeStreams, initialListId])

  // Truncate active streams if gridSize is reduced below the current stream count
  useEffect(() => {
    if (gridSize !== "auto") {
      const outOfBounds = activeStreams.some(s => (s.gridIndex ?? activeStreams.indexOf(s)) >= gridSize);
      if (outOfBounds) {
        toast.info(`Grid shrunk to ${gridSize}. Extra streams were removed.`);
        setActiveStreams(prev => prev.filter(s => (s.gridIndex ?? prev.indexOf(s)) < gridSize));
      }
    }
  }, [gridSize, activeStreams]);

  const handleAddCell = (creator: any, type: "stream" | "chat", targetGridIndex?: number) => {
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
        
        let nextGridIndex = targetGridIndex !== undefined ? targetGridIndex : (gridSize === "auto" ? 0 : gridSize);
        if (targetGridIndex === undefined) {
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
            // Prevent collisions in auto mode if streams were removed from the middle
            nextGridIndex = prev.length > 0 ? Math.max(...prev.map(s => s.gridIndex ?? 0)) + 1 : 0;
            if (prev.length === 8) {
              toast.warning("Warning: Loading more than 8 streams requires significant RAM and bandwidth. Your browser may experience lag.")
            }
          }
        } else {
          if (gridSize !== "auto" && targetGridIndex >= gridSize) {
             toast.error("Invalid grid cell.");
             return prev;
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

  const handleAddCustomStream = (url: string, targetGridIndex?: number) => {
    let platform: "twitch" | "youtube" | "kick" | "custom" = "custom";
    let channel = url;
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      if (parsedUrl.hostname.includes('twitch.tv')) {
        platform = 'twitch';
        channel = parsedUrl.pathname.split('/').filter(Boolean)[0] || url;
      } else if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        platform = 'youtube';
        if (url.includes('v=')) {
          channel = parsedUrl.searchParams.get('v') || url;
        } else {
          channel = parsedUrl.pathname.split('/').pop() || url;
        }
      } else if (parsedUrl.hostname.includes('kick.com')) {
        platform = 'kick';
        channel = parsedUrl.pathname.split('/').filter(Boolean)[0] || url;
      }
    } catch (e) {}

    const dummyCreator = {
      _id: `custom-${Date.now()}`,
      platform,
      platformId: channel,
      username: channel,
    };
    handleAddCell(dummyCreator as any, "stream", targetGridIndex);
  };

  const handleSwapStream = (draggedId: string, draggedType: "stream" | "chat", targetGridIndex: number) => {
    setActiveStreams(prev => {
      const draggedIndex = prev.findIndex(s => s.id === draggedId && s.type === draggedType);
      if (draggedIndex === -1) return prev;
      
      const newStreams = [...prev];
      const targetIndex = newStreams.findIndex(s => (s.gridIndex ?? newStreams.indexOf(s)) === targetGridIndex);
      
      const oldGridIndex = newStreams[draggedIndex].gridIndex ?? draggedIndex;
      
      newStreams[draggedIndex] = { ...newStreams[draggedIndex], gridIndex: targetGridIndex };
      if (targetIndex !== -1) {
        newStreams[targetIndex] = { ...newStreams[targetIndex], gridIndex: oldGridIndex };
        
        // Swap their positions in the array so auto mode renders the new order
        const temp = newStreams[draggedIndex];
        newStreams[draggedIndex] = newStreams[targetIndex];
        newStreams[targetIndex] = temp;
      }
      return newStreams;
    });
  };

  const handleClearAll = () => {
    const prevStreams = [...activeStreams]
    setActiveStreams([])
    toast("All streams cleared", {
      action: {
        label: "Undo",
        onClick: () => setActiveStreams(prevStreams)
      },
      duration: 5000,
    })
  }

  const handleSaveLayout = async () => {
    if (!isAuthenticated) {
      toast.error("Sign in to save your layout permanently", {
        action: {
          label: "Sign in",
          onClick: () => window.location.href = '/sign-in'
        }
      })
      return
    }
    setSaveDialogOpen(true)
    setSaveLayoutName("")
  }

  const handleConfirmSave = async () => {
    if (!saveLayoutName.trim()) {
      toast.error("Please enter a name for your layout.")
      return
    }
    // Only roster creators (those with real Convex IDs) can be saved
    const rosterStreams = activeStreams.filter(s => !s.id.startsWith('custom-'))
    if (rosterStreams.length === 0) {
      toast.error("No roster creators to save. Add some from the sidebar first.")
      return
    }
    setIsSaving(true)
    try {
      const result = await saveLayoutMutation({
        name: saveLayoutName.trim(),
        creatorIds: rosterStreams.map(s => ({ id: s.id as any, type: s.type || "stream" }))
      })
      setSaveDialogOpen(false)
      toast.success(`Layout "${saveLayoutName}" saved!`, {
        description: "You can load it from the StreamLists dropdown."
      })
      setActiveLayoutId(result.layoutId)
    } catch (err: any) {
      toast.error(err?.message || "Failed to save layout.")
    } finally {
      setIsSaving(false)
    }
  }

  // Filter to only actual video streams for the Universal Chat selector
  const videoStreams = activeStreams.filter(s => !s.type || s.type === "stream");
  const activeChatStream = videoStreams.find(s => s.id === activeChatId) || videoStreams[0];

  const filteredCreators = (creatorsQuery || []).filter(c => 
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
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Alumni 2025">Alumni 2025</SelectItem>
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
                  <SelectItem value="all">All Languages</SelectItem>
                  {filtersQuery && filtersQuery.languages ? filtersQuery.languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>) : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2 mt-2 overflow-y-auto pr-1 no-scrollbar">
            {creatorsQuery === undefined ? (
              <div className="text-muted-foreground text-sm text-center pt-4">Loading creators...</div>
            ) : filteredCreators.length === 0 ? (
              <div className="text-muted-foreground text-sm text-center pt-4">No creators found.</div>
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
          <div className="hidden md:flex items-center justify-between bg-card/50 backdrop-blur-md border border-border rounded-xl px-4 py-2 shrink-0 shadow-sm overflow-x-auto no-scrollbar gap-4">
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
                "h-8 w-8 [&_svg]:size-4 hidden sm:flex text-muted-foreground hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
            </Link>
            
            <Link
              to="/discover"
              aria-label="Discover"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-8 w-8 [&_svg]:size-4 hidden sm:flex text-muted-foreground hover:text-foreground"
              )}
            >
              <HugeiconsIcon icon={Search02Icon} strokeWidth={2} />
            </Link>
            
            <div className="h-4 w-px bg-border mx-1 hidden sm:block"></div>
            
            <div className="hidden md:flex items-center gap-2">
              {/* Clip Feature Button */}
              <Button 
                onClick={() => setClipModalOpen(true)}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs border-purple-500/30 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                title="Create a Clip"
              >
                <HugeiconsIcon icon={Video01Icon} className="w-3.5 h-3.5" /> Clip
              </Button>

              {/* Save Layout Button */}
              <Button 
                onClick={handleSaveLayout}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={activeStreams.length === 0}
                title="Save this layout"
              >
                <HugeiconsIcon icon={FloppyDiskIcon} className="w-3.5 h-3.5" /> Save
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

              {/* Clear All Button */}
              {activeStreams.length > 0 && (
                <Button
                  onClick={handleClearAll}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                  title="Clear all streams"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Grid Size Selector */}
          <div className="hidden lg:flex shrink-0 items-center gap-1 bg-zinc-900/50 rounded-lg p-1 border border-border mx-2">
            <span className="text-[10px] text-muted-foreground px-2 font-bold tracking-wider">{activeStreams.length} / 20</span>
            {(["auto", 2, 4, 6, 8, 12, 16, 18, 20] as const).map(size => (
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
            {/* Searchable StreamList Picker */}
            <div className="relative" ref={layoutPickerRef}>
              <button
                onClick={() => { setLayoutPickerOpen(o => !o); setLayoutSearch("") }}
                className={cn(
                  "h-8 min-w-[140px] md:min-w-[160px] flex items-center justify-between gap-2 px-3 text-xs border rounded-md bg-background transition-colors",
                  layoutPickerOpen ? "border-primary/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                )}
              >
                <span className="truncate">
                  {activeLayoutId && allLayouts.find(l => l._id === activeLayoutId)
                    ? allLayouts.find(l => l._id === activeLayoutId)!.name
                    : "Load StreamList..."
                  }
                </span>
                <svg className={cn("w-3 h-3 shrink-0 transition-transform", layoutPickerOpen && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              {layoutPickerOpen && (
                <div className="absolute right-0 top-full mt-1 z-[999] w-56 bg-zinc-950 border border-zinc-800 rounded-md shadow-xl overflow-hidden">
                  {/* Search input */}
                  <div className="p-2 border-b border-zinc-800">
                    <div className="relative">
                      <HugeiconsIcon icon={Search01Icon} className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search layouts..."
                        value={layoutSearch}
                        onChange={e => setLayoutSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded text-foreground placeholder:text-zinc-600 outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    {(userLayouts === undefined && discoverLayouts === undefined) ? (
                      <div className="px-3 py-4 text-xs text-zinc-500 text-center">Loading...</div>
                    ) : allLayouts.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                        No saved layouts yet.<br />
                        <span className="text-zinc-600">Save one using the Save button above.</span>
                      </div>
                    ) : (
                      (() => {
                        const filtered = allLayouts.filter(l =>
                          l.name.toLowerCase().includes(layoutSearch.toLowerCase())
                        )
                        if (filtered.length === 0) return (
                          <div className="px-3 py-4 text-xs text-zinc-500 text-center">No results for "{layoutSearch}"</div>
                        )
                        return filtered.map(l => (
                          <button
                            key={l._id}
                            onClick={() => {
                              setActiveLayoutId(l._id)
                              setLayoutPickerOpen(false)
                              setGridSize("auto")
                              
                              if (creatorsQuery) {
                                const loadedStreams = l.streams.map((s, idx) => {
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
                                setActiveStreams(loadedStreams)
                              }
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors flex items-center justify-between",
                              activeLayoutId === l._id && "text-primary font-medium bg-zinc-800/50"
                            )}
                          >
                            <span className="truncate">{l.name}</span>
                            <span className="text-[10px] text-zinc-500 ml-2 shrink-0">{l.streams?.length || 0} streams</span>
                          </button>
                        ))
                      })()
                    )}
                  </div>
                </div>
              )}
            </div>
            
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
            onAddStreamClick={(gridIndex) => {
              if (gridIndex !== undefined) {
                setAddStreamDialog({ isOpen: true, gridIndex });
                setCustomUrlInput("");
              } else {
                setLeftSidebarOpen(true);
              }
            }}
            onSwapStream={handleSwapStream}
          />
          
          {addStreamDialog.isOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl w-[400px] shadow-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Add Custom Stream</h3>
                  <button onClick={() => setAddStreamDialog({ isOpen: false })} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
                <p className="text-sm text-muted-foreground">Paste a Twitch, Kick, or YouTube URL to add it to this slot.</p>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Paste Twitch/YouTube URL here..."
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCustomStream(customUrlInput, addStreamDialog.gridIndex);
                        setAddStreamDialog({isOpen: false});
                      }
                    }}
                    className="bg-muted border-border"
                  />
                  <Button onClick={() => {
                    if (customUrlInput) {
                      handleAddCustomStream(customUrlInput, addStreamDialog.gridIndex);
                      setAddStreamDialog({ isOpen: false });
                    }
                  }}>Add</Button>
                </div>
              </div>
            </div>
          )}

          {/* Save Layout Dialog */}
          {saveDialogOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl w-[400px] shadow-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Save Layout</h3>
                  <button onClick={() => setSaveDialogOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Give your layout a name. Only roster creators (not custom URLs) will be saved.
                </p>
                <Input
                  placeholder="e.g. Night Stream, Study Session..."
                  value={saveLayoutName}
                  onChange={(e) => setSaveLayoutName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSave() }}
                  className="bg-muted border-border"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleConfirmSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Layout"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {clipModalOpen && (
            <ClipModal 
              broadcasters={activeStreams
                .filter(s => s.platform === 'twitch' && (!s.type || s.type === 'stream'))
                .map(s => {
                  const creator = creatorsQuery?.find(c => c._id === s.id);
                  return {
                    broadcasterId: creator?.platformId || "",
                    broadcasterName: s.channel
                  };
                })
                .filter(b => b.broadcasterId && /^\d+$/.test(b.broadcasterId))
              }
              isPro={isPro}
              onClose={() => setClipModalOpen(false)}
            />
          )}

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
              <Select value={activeChatId?.toString() || ""} onValueChange={setActiveChatId}>
                <SelectTrigger className="w-full text-xs h-8">
                  <SelectValue placeholder="Select stream chat">
                    {activeChatStream ? (
                      <div className="flex items-center truncate">
                        <span className="capitalize text-muted-foreground mr-1">[{activeChatStream.platform}]</span>
                        <span className="truncate">{activeChatStream.displayName || activeChatStream.channel}</span>
                      </div>
                    ) : "Select stream chat"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {videoStreams.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
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
