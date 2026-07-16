import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useConvexAuth } from "convex/react"
import { api } from "../../convex/_generated/api"
import { HugeiconsIcon } from "@hugeicons/react"
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon"
import FloppyDiskIcon from "@hugeicons/core-free-icons/FloppyDiskIcon"
import Tv01Icon from "@hugeicons/core-free-icons/Tv01Icon"
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon"
import { toast } from "sonner"
import { useNavigate } from "@tanstack/react-router"

export default function CreateStreamlistBar() {
  const { isAuthenticated } = useConvexAuth()
  const creators = useQuery(api.roster.getAllCreators, {}) || []
  const saveLayout = useMutation(api.roster.saveLayout)
  const navigate = useNavigate()
  
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<typeof creators>([])
  const [listName, setListName] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredCreators = creators.filter(c => 
    c.username.toLowerCase().includes(search.toLowerCase()) &&
    !selected.find(s => s._id === c._id)
  ).slice(0, 10)

  const handleAdd = (creator: any) => {
    if (selected.length >= 20) {
      toast.error("You can only add up to 20 streams.")
      return
    }
    setSelected([...selected, creator])
    setSearch("")
    setIsFocused(false)
  }

  const handleRemove = (id: string) => {
    setSelected(selected.filter(s => s._id !== id))
  }

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to save a StreamList")
      navigate({ to: "/sign-in" })
      return
    }
    if (!listName.trim()) {
      toast.error("Please enter a name for your StreamList")
      return
    }
    if (isSaving) return
    
    try {
      setIsSaving(true)
      const creatorIds = selected.map(s => ({ id: s._id, type: "stream" as const }))
      const { layoutId } = await saveLayout({ name: listName, creatorIds })
      toast.success("StreamList saved successfully!")
      navigate({ to: "/roster", search: { list: layoutId } })
    } catch (e: any) {
      toast.error(e.message || "Failed to save StreamList")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePlayNow = () => {
    if (selected.length === 0) {
      toast.error("Add at least one streamer to play")
      return
    }
    
    const streamsData = selected.map((c, i) => ({
        id: c._id,
        platform: c.platform,
        channel: c.platform === "custom" && c.platformId ? c.platformId : c.username,
        displayName: c.username,
        type: "stream",
        gridIndex: i
    }))
    localStorage.setItem('streamhuddle-session', JSON.stringify(streamsData))
    navigate({ to: "/roster" })
  }

  return (
    <div className="w-full relative group z-10">
      {/* Animated glow behind the card */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-primary/30 via-purple-500/30 to-primary/30 rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
      
      <div className="w-full bg-zinc-950/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 md:p-6 shadow-2xl overflow-visible relative flex flex-col gap-4">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <HugeiconsIcon icon={Tv01Icon} className="w-5 h-5 text-primary" />
              Build a StreamList
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Search creators to build your custom multi-stream layout.</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          
          {/* Search & Add */}
          <div className="relative w-full md:w-72 shrink-0 z-20" ref={searchRef}>
            <div className="relative">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Search creators..."
                value={search}
                onChange={e => { setSearch(e.target.value); setIsFocused(true) }}
                onFocus={() => setIsFocused(true)}
                className="w-full h-12 pl-10 pr-4 bg-zinc-900/50 border border-white/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-zinc-600 text-white shadow-inner"
              />
            </div>
            
            {isFocused && search.trim() !== "" && (
              <div className="absolute top-full left-0 w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto z-30">
                {filteredCreators.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-500 text-center font-mono">No creators found</div>
                ) : (
                  <div className="p-1">
                    {filteredCreators.map(c => (
                      <button 
                        key={c._id}
                        onClick={() => handleAdd(c)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors text-left group/btn"
                      >
                        <img src={c.avatarUrl || `https://avatar.vercel.sh/${c.username}`} alt="" className="w-10 h-10 rounded-full bg-zinc-800 object-cover shadow-sm group-hover/btn:ring-2 ring-primary/50 transition-all" />
                        <div className="flex-1 overflow-hidden">
                          <div className="text-sm font-semibold text-zinc-200 truncate">{c.username}</div>
                          <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{c.platform}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Horizontal Bar */}
          <div className="flex-1 w-full overflow-x-auto pb-2 -mb-2 no-scrollbar">
            {selected.length === 0 ? (
              <div className="h-12 flex items-center justify-center text-sm text-zinc-600 border border-dashed border-zinc-700/50 rounded-xl px-4 bg-zinc-900/20">
                Add streamers to see them here
              </div>
            ) : (
              <div className="flex items-center gap-3 h-14">
                {selected.map(s => (
                  <div key={s._id} className="relative group/avatar shrink-0">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/30 overflow-hidden bg-zinc-800 shadow-md group-hover/avatar:border-primary transition-colors">
                      <img src={s.avatarUrl || `https://avatar.vercel.sh/${s.username}`} alt={s.username} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-1.5 rounded text-[9px] font-bold text-white tracking-widest truncate max-w-[48px] opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                      {s.username}
                    </div>
                    <button 
                      onClick={() => handleRemove(s._id)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full text-white flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all scale-75 group-hover/avatar:scale-100 shadow-lg z-10"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="h-12 px-3 flex items-center justify-center rounded-full bg-zinc-900 border border-white/5 text-xs font-mono font-bold text-zinc-500 ml-2 shadow-inner">
                  {selected.length} / 20
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto shrink-0 mt-2 md:mt-0">
            <input 
              type="text"
              placeholder="List Name"
              value={listName}
              onChange={e => setListName(e.target.value)}
              className="w-full md:w-36 h-12 px-4 bg-zinc-900/50 border border-white/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-zinc-600 shadow-inner text-white"
            />
            <div className="flex items-center gap-2">
              <button 
                onClick={handleSave}
                disabled={selected.length === 0 || isSaving}
                className="h-12 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <HugeiconsIcon icon={FloppyDiskIcon} className="w-4 h-4" />
                <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save"}</span>
              </button>
              <button 
                onClick={handlePlayNow}
                disabled={selected.length === 0}
                className="h-12 px-6 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-bold text-sm uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_oklch(var(--primary)/.3)] hover:shadow-[0_0_25px_oklch(var(--primary)/.5)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
              >
                <HugeiconsIcon icon={Tv01Icon} className="w-4 h-4" />
                <span>Play Now</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
