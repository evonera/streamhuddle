import { useQuery, useMutation } from 'convex/react'
import { api } from "@convex/_generated/api"
import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
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
import PauseIcon from "@hugeicons/core-free-icons/PauseIcon"
import PlayIcon from "@hugeicons/core-free-icons/PlayIcon"
import ReloadIcon from "@hugeicons/core-free-icons/ReloadIcon"
import VolumeHighIcon from "@hugeicons/core-free-icons/VolumeHighIcon"
import VolumeMute01Icon from "@hugeicons/core-free-icons/VolumeMute01Icon"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiClipQueueWidget } from "./clip-queue/ClipQueueWidget"
import { RosterCreatorRow } from "./roster-creator-row"
import { pauseAllTwitch, playAllTwitch, setAllTwitchQuality } from "@/components/player/twitch-registry"
import { parseStreamsParam, MAX_GRID_STREAMS } from "@/lib/streams-param"
import type { Id } from "@convex/_generated/dataModel"

const SESSION_STORAGE_KEY = 'streamhuddle-session'
const PREFS_STORAGE_KEY = 'streamhuddle-prefs'
const TOUR_SEEN_KEY = 'streamhuddle-tour-seen'

type Prefs = {
  leftSidebarOpen?: boolean
  rightSidebarOpen?: boolean
  globalMuted?: boolean
  twitchQuality?: string
}

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return {}
  try {
    const saved = localStorage.getItem(PREFS_STORAGE_KEY)
    if (!saved) return {}
    return JSON.parse(saved) as Prefs
  } catch {
    return {}
  }
}

const TOUR_STEPS = [
  {
    title: "1 · Build your grid",
    body: "Search the roster and hit Stream to add a creator, or paste any Twitch / Kick / YouTube URL into an empty slot. Up to 30 cells.",
  },
  {
    title: "2 · One stream has audio",
    body: "Click any cell (or press Enter on it) to give it sound. The focused cell gets a green border — everything else stays muted.",
  },
  {
    title: "3 · Master controls",
    body: "The toolbar mutes all streams, pauses/plays Twitch embeds, reloads everything at once, and forces Twitch quality. Pause and quality apply to Twitch players only.",
  },
  {
    title: "4 · Chat + share",
    body: "Pick which chat to follow in the right panel, save the setup as a StreamList, and share it with a link anyone can load in one click.",
  },
]

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

export function RosterLayout({ initialListId, autoLoadAll, initialStreamsParam }: { initialListId?: string, autoLoadAll?: boolean, initialStreamsParam?: string }) {

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

  // Persisted UI prefs (sidebars, mute-all, quality) survive reloads.
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  // Narrow viewports force sidebars closed for layout, but that override must
  // never be persisted: writing it would destroy the user's desktop prefs.
  const [isMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768,
  )
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [globalMuted, setGlobalMuted] = useState(false)
  const [twitchQuality, setTwitchQuality] = useState("auto")
  const [remountKey, setRemountKey] = useState(0)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  const [addStreamDialog, setAddStreamDialog] = useState<{isOpen: boolean; gridIndex?: number}>({ isOpen: false })
  const [customUrlInput, setCustomUrlInput] = useState("")

  // Save layout dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveLayoutName, setSaveLayoutName] = useState("")
  const saveLayoutMutation = useMutation(api.roster.saveLayout)
  const [isSaving, setIsSaving] = useState(false)

  // Clip state
  const [clipModalOpen, setClipModalOpen] = useState(false)

  // Drag-and-drop (dnd-kit): sidebar rows and grid headers are draggables,
  // grid slots are droppables. Pointer sensor covers mouse + touch; the
  // distance constraint keeps plain clicks working.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const [dragOverlayLabel, setDragOverlayLabel] = useState<string | null>(null)

  const handleDndStart = (event: DragStartEvent) => {
    const label = (event.active.data.current as { label?: string } | undefined)?.label
    setDragOverlayLabel(label ?? null)
  }

  const handleDndEnd = (event: DragEndEvent) => {
    setDragOverlayLabel(null)
    const overGridIndex = (event.over?.data.current as { gridIndex?: number } | undefined)?.gridIndex
    if (overGridIndex === undefined) return
    const data = (event.active.data.current ?? {}) as {
      source?: string
      creatorId?: string
      cellType?: "stream" | "chat"
      streamId?: string
      streamType?: "stream" | "chat"
    }
    if (data.source === "sidebar" && data.creatorId) {
      const creator = creatorsQuery?.find(c => c._id === data.creatorId)
      if (creator) handleAddCell(creator, data.cellType ?? "stream", overGridIndex)
    } else if (data.source === "cell" && data.streamId) {
      handleSwapStream(data.streamId, data.streamType ?? "stream", overGridIndex)
    }
  }

  const handleDndCancel = () => setDragOverlayLabel(null)
  
  // User isPro check (via BetterAuth or Convex)
  const { data: session } = authClient.useSession()
  const isPro = (session?.user as any)?.isPro || false

  useEffect(() => {
    // Load saved prefs first on every viewport: the persistence effect writes
    // on every change, so skipping the load on mobile would let mobile
    // defaults overwrite the user's saved desktop settings.
    const prefs = loadPrefs()
    if (prefs.leftSidebarOpen !== undefined) setLeftSidebarOpen(prefs.leftSidebarOpen)
    if (prefs.rightSidebarOpen !== undefined) setRightSidebarOpen(prefs.rightSidebarOpen)
    if (prefs.globalMuted !== undefined) setGlobalMuted(prefs.globalMuted)
    if (prefs.twitchQuality) setTwitchQuality(prefs.twitchQuality)
    if (isMobileViewport) {
      // Small screens start with overlays closed regardless of saved prefs.
      setLeftSidebarOpen(false)
      setRightSidebarOpen(false)
    }
    setPrefsLoaded(true)
  }, [isMobileViewport])

  // Persist sidebar/mute/quality prefs (skip until initial load resolves).
  // On mobile viewports the sidebar values are a forced layout override, so
  // re-save the previously stored ones instead of the override.
  useEffect(() => {
    if (!prefsLoaded) return
    try {
      const prev = isMobileViewport ? loadPrefs() : {}
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({
        leftSidebarOpen: isMobileViewport ? prev.leftSidebarOpen : leftSidebarOpen,
        rightSidebarOpen: isMobileViewport ? prev.rightSidebarOpen : rightSidebarOpen,
        globalMuted,
        twitchQuality,
      } satisfies Prefs))
    } catch {
      // ignore quota errors
    }
  }, [prefsLoaded, isMobileViewport, leftSidebarOpen, rightSidebarOpen, globalMuted, twitchQuality])

  // Apply an explicit Twitch quality to all mounted players (and future mounts via prop).
  // Switching back to Auto remounts players: the embed has no "reset to Auto"
  // API, so a reload is the only way to restore adaptive quality.
  const handleQualityChange = (q: string | null) => {
    if (!q) return
    setTwitchQuality(q)
    if (q === "auto") {
      setRemountKey(k => k + 1)
      toast.info("Quality reset to Auto (streams reloaded).")
    } else {
      setAllTwitchQuality(q)
    }
  }

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
      const loadedStreams = (creatorsQuery || []).slice(0, MAX_GRID_STREAMS).map((creator, idx) => ({
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

  // Instant-watch links: ?streams=twitch:xqc,kick:adinross,youtube:VIDEOID
  // (bare names default to Twitch). Roster matches resolve to live-status
  // aware cells; unknown names mount directly as Twitch embeds.
  const streamsParamLoadedRef = useRef(false)
  useEffect(() => {
    if (streamsParamLoadedRef.current) return
    if (!initialStreamsParam || !creatorsQuery || activeStreams.length !== 0 || activeLayoutId) return
    const parsed = parseStreamsParam(initialStreamsParam)
    if (parsed.length === 0) return
    // Match on platform AND username: the same handle can exist on Twitch,
    // Kick, and YouTube, and the URL encodes which one was meant.
    // Usernames fold case; custom URLs and YouTube IDs stay case-sensitive.
    const byPlatformAndName = new Map(
      (creatorsQuery || []).map((c) => [`${c.platform}:${c.username.toLowerCase()}`, c]),
    )
    const lookupKey = (p: { platform: string; channel: string }) =>
      p.platform === "custom" || p.platform === "youtube"
        ? `${p.platform}:${p.channel}`
        : `${p.platform}:${p.channel.toLowerCase()}`
    // Deduplicate repeated entries: duplicate cells share one stream.id, which
    // would collide in the Twitch player registry and break global controls.
    // Roster matches dedupe on the resolved roster ID; unmatched entries keep
    // unique index-based IDs, so only exact repeats are dropped.
    const seen = new Set<string>()
    const unique = parsed.filter((p) => {
      const match = byPlatformAndName.get(lookupKey(p))
      const key = match ? `roster:${match._id}` : `raw:${lookupKey(p)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const loaded: StreamData[] = unique.map((p, idx) => {
      const match = byPlatformAndName.get(lookupKey(p))
      if (match) {
        return {
          id: match._id,
          platform: match.platform as any,
          channel: match.platform === "custom" && match.platformId ? match.platformId : match.username,
          displayName: match.username,
          type: "stream" as const,
          gridIndex: idx,
        }
      }
      return {
        id: `param-${p.platform}-${p.channel.toLowerCase()}-${idx}`,
        platform: p.platform,
        channel: p.channel,
        displayName: p.displayName,
        type: "stream" as const,
        gridIndex: idx,
      }
    })
    setActiveStreams(loaded)
    setGridSize("auto")
    streamsParamLoadedRef.current = true
  }, [initialStreamsParam, creatorsQuery, activeStreams.length, activeLayoutId])

  // Auto-open the onboarding tour on first empty visit
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(TOUR_SEEN_KEY)) return
    if (initialListId || autoLoadAll || initialStreamsParam) return
    if (creatorsQuery === undefined) return
    if (activeStreams.length === 0 && loadSession().length === 0) {
      setTourOpen(true)
    }
  }, [creatorsQuery, activeStreams.length, initialListId, autoLoadAll, initialStreamsParam])

  const closeTour = () => {
    setTourOpen(false)
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1")
    } catch {
      // ignore
    }
  }

  // stream.id -> isLive for roster cells (drives offline placeholders in the grid)
  const liveMap: Record<string, boolean> = {}
  if (creatorsQuery) {
    for (const c of creatorsQuery) {
      if (c.isLive !== undefined) liveMap[c._id] = !!c.isLive
    }
  }

  // Streams the user explicitly retried: mount a player even while the
  // backend still reports them offline, so Retry has a visible effect. The
  // platform embed itself shows its own offline state if truly offline.
  const [forceMountedIds, setForceMountedIds] = useState<Record<string, true>>({})

  const handleRetryStream = (id: string) => {
    setForceMountedIds(prev => ({ ...prev, [id]: true }))
    // Also remount so the fresh player attempt isn't served a cached embed.
    setRemountKey(k => k + 1)
  }

  // Restore anonymous session from localStorage (only when no shared list,
  // auto-load, or instant-watch param)
  const sessionLoadedRef = useRef(false)
  useEffect(() => {
    if (sessionLoadedRef.current) return
    if (initialListId || autoLoadAll || initialStreamsParam) return
    const saved = loadSession()
    if (saved.length > 0) {
      setActiveStreams(saved)
      sessionLoadedRef.current = true
      toast.info("Session restored from last visit", {
        description: isAuthenticated ? "Save it permanently from the toolbar." : "Sign in to save it permanently.",
        duration: 4000,
      })
    }
  }, [initialListId, autoLoadAll, initialStreamsParam, isAuthenticated])

  // Auto-save session to localStorage whenever streams change
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    // Don't clobber a shared-list or instant-watch view
    if (initialListId || initialStreamsParam) return
    saveSession(activeStreams)
  }, [activeStreams, initialListId, initialStreamsParam])

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
        if (prev.length >= MAX_GRID_STREAMS) {
          toast.error(`Absolute limit of ${MAX_GRID_STREAMS} cells reached.`)
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
            if (prev.length === 10) {
              toast.warning("Warning: Loading more than 10 streams requires significant RAM and bandwidth. Your browser may experience lag. Tip: set Twitch quality to Audio only.")
            }
          }
        } else {
          // Explicit drop target (sidebar drag or empty-slot add): an occupied
          // slot relocates its occupant instead of stacking two cells on one
          // grid index (the second would render hidden but still count).
          if (gridSize !== "auto" && targetGridIndex >= gridSize) {
             toast.error("Invalid grid cell.");
             return prev;
          }
          nextGridIndex = targetGridIndex;
          const occupantIdx = prev.findIndex(s => (s.gridIndex ?? prev.indexOf(s)) === targetGridIndex);
          if (occupantIdx !== -1) {
            let freeIdx: number | null = null;
            if (gridSize === "auto") {
              freeIdx = prev.length > 0 ? Math.max(...prev.map(s => s.gridIndex ?? 0)) + 1 : 0;
            } else {
              const used = new Set(prev.map(s => s.gridIndex));
              for (let i = 0; i < gridSize; i++) {
                if (!used.has(i)) { freeIdx = i; break; }
              }
            }
            if (freeIdx === null) {
              toast.error("Grid is full. Increase grid size or remove a stream.");
              return prev;
            }
            const relocated = prev.map((s, i) => i === occupantIdx ? { ...s, gridIndex: freeIdx as number } : s);
            return [...relocated, {
              id: creator._id,
              platform: creator.platform as any,
              channel: creator.platform === "custom" && creator.platformId ? creator.platformId : creator.username,
              displayName: creator.username,
              type,
              gridIndex: nextGridIndex
            }];
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
    <DndContext
      sensors={dndSensors}
      onDragStart={handleDndStart}
      onDragEnd={handleDndEnd}
      onDragCancel={handleDndCancel}
    >
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
              <RosterCreatorRow
                key={creator._id}
                creator={creator}
                isStreamActive={!!activeStreams.find(s => s.id === creator._id && (!s.type || s.type === "stream"))}
                isChatActive={!!activeStreams.find(s => s.id === creator._id && s.type === "chat")}
                onAdd={(c, type) => handleAddCell(c, type)}
              />
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

              {/* Global stream controls (Viewington parity) */}
              {activeStreams.length > 0 && (
                <>
                  <div className="h-4 w-px bg-border mx-1" />
                  <Button
                    onClick={() => setGlobalMuted(m => !m)}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title={globalMuted ? "Unmute all streams" : "Mute all streams"}
                    aria-label={globalMuted ? "Unmute all streams" : "Mute all streams"}
                    aria-pressed={globalMuted}
                  >
                    <HugeiconsIcon icon={globalMuted ? VolumeMute01Icon : VolumeHighIcon} className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => { pauseAllTwitch(); toast.info("Paused Twitch streams (Twitch only).") }}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Pause all Twitch streams"
                    aria-label="Pause all Twitch streams"
                  >
                    <HugeiconsIcon icon={PauseIcon} className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => playAllTwitch()}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Play all paused Twitch streams"
                    aria-label="Play all paused Twitch streams"
                  >
                    <HugeiconsIcon icon={PlayIcon} className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => { setRemountKey(k => k + 1); toast.info("Reloading all streams.") }}
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Reload all streams"
                    aria-label="Reload all streams"
                  >
                    <HugeiconsIcon icon={ReloadIcon} className="w-4 h-4" />
                  </Button>
                  <Select value={twitchQuality} onValueChange={handleQualityChange}>
                    <SelectTrigger
                      className="h-8 w-[104px] text-xs"
                      title="Twitch quality (Twitch players only; Kick/YouTube stay on Auto)"
                      aria-label="Twitch stream quality"
                    >
                      <SelectValue placeholder="Quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="1080p60">1080p60</SelectItem>
                      <SelectItem value="720p60">720p60</SelectItem>
                      <SelectItem value="480p">480p</SelectItem>
                      <SelectItem value="360p">360p</SelectItem>
                      <SelectItem value="160p">160p</SelectItem>
                      <SelectItem value="audio_only">Audio only</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>

          {/* Grid Size Selector */}
          <div className="hidden lg:flex shrink-0 items-center gap-1 bg-zinc-900/50 rounded-lg p-1 border border-border mx-2">
            <span className="text-[10px] text-muted-foreground px-2 font-bold tracking-wider">{activeStreams.length} / {MAX_GRID_STREAMS}</span>
            {(["auto", 2, 4, 6, 8, 12, 16, 18, 20, 24, 30] as const).map(size => (
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
            globalMuted={globalMuted}
            twitchQuality={twitchQuality === "auto" ? undefined : twitchQuality}
            remountKey={remountKey}
            liveMap={liveMap}
            forceMountIds={forceMountedIds}
            onRetryStream={handleRetryStream}
            onStartTour={() => { setTourStep(0); setTourOpen(true) }}
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

      {/* Right Sidebar */}
      {rightSidebarOpen && !theaterMode && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setRightSidebarOpen(false)} />
          <div className="fixed md:relative top-0 right-0 md:top-auto md:right-auto z-[70] md:z-40 w-[85vw] max-w-[340px] md:w-80 shrink-0 h-full md:h-[calc(100vh-1rem)] flex flex-col bg-card border-l md:border border-border md:rounded-xl shadow-2xl md:shadow-xl overflow-hidden">
            <Tabs defaultValue="chat" className="flex flex-col h-full">
              <div className="flex items-center justify-between p-2 border-b border-border bg-card/80 backdrop-blur shrink-0">
                <TabsList className="bg-zinc-900 border border-border">
                  <TabsTrigger value="chat" className="text-xs px-3">Chat</TabsTrigger>
                  <TabsTrigger value="queue" className="text-xs px-3">Clips</TabsTrigger>
                </TabsList>
                <button onClick={() => setRightSidebarOpen(false)} className="text-muted-foreground hover:text-foreground mr-1">
                  <HugeiconsIcon icon={PanelRightCloseIcon} size={18} />
                </button>
              </div>

              {/* Chat Tab Content */}
              <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 overflow-hidden outline-none data-[state=inactive]:hidden">
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
              </TabsContent>

              {/* Clip Queue Tab Content */}
              <TabsContent value="queue" className="flex-1 flex flex-col m-0 p-0 overflow-hidden outline-none data-[state=inactive]:hidden bg-[#141414]">
                <MultiClipQueueWidget 
                  creatorIds={activeStreams
                    .filter(s => !s.id.startsWith("custom-")) // Only Convex creator IDs
                    .map(s => s.id as Id<"creators">)
                  } 
                />
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
      {/* Onboarding tour overlay */}
      {tourOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="StreamHuddle tour">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-foreground">{TOUR_STEPS[tourStep].title}</h3>
              <button onClick={closeTour} aria-label="Close tour" className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{TOUR_STEPS[tourStep].body}</p>
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTourStep(i)}
                  aria-label={`Go to tour step ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === tourStep ? "w-6 bg-primary" : "w-1.5 bg-zinc-700 hover:bg-zinc-600"}`}
                />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={closeTour}>
                {tourStep === TOUR_STEPS.length - 1 ? "Finish" : "Skip"}
              </Button>
              {tourStep < TOUR_STEPS.length - 1 && (
                <Button onClick={() => setTourStep(s => s + 1)}>Next</Button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Drag ghost */}
      <DragOverlay dropAnimation={null}>
        {dragOverlayLabel ? (
          <div className="bg-zinc-900 border border-primary/50 rounded-lg px-4 py-2 text-sm font-semibold text-foreground shadow-2xl cursor-grabbing">
            {dragOverlayLabel}
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
  )
}
