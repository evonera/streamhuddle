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
    <div className="w-full bg-card border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
      
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        
        {/* Search & Add */}
        <div className="relative w-full md:w-72 shrink-0 z-20" ref={searchRef}>
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search to add streamers..."
              value={search}
              onChange={e => { setSearch(e.target.value); setIsFocused(true) }}
              onFocus={() => setIsFocused(true)}
              className="w-full h-10 pl-9 pr-4 bg-background border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          
          {isFocused && search.trim() !== "" && (
            <div className="absolute top-full left-0 w-full mt-2 bg-background border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
              {filteredCreators.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">No creators found</div>
              ) : (
                filteredCreators.map(c => (
                  <button 
                    key={c._id}
                    onClick={() => handleAdd(c)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-white/5 transition-colors text-left"
                  >
                    <img src={c.avatarUrl || `https://avatar.vercel.sh/${c.username}`} alt="" className="w-8 h-8 rounded-full bg-white/10" />
                    <div className="flex-1 overflow-hidden">
                      <div className="text-sm font-semibold truncate">{c.username}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{c.platform}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected Horizontal Bar */}
        <div className="flex-1 w-full overflow-x-auto pb-2 -mb-2 no-scrollbar">
          {selected.length === 0 ? (
            <div className="h-10 flex items-center text-sm text-muted-foreground border border-dashed border-white/10 rounded-lg px-4 bg-white/5">
              Build your custom StreamList here...
            </div>
          ) : (
            <div className="flex items-center gap-2 h-12">
              {selected.map(s => (
                <div key={s._id} className="relative group shrink-0">
                  <div className="w-10 h-10 rounded-full border-2 border-primary/20 overflow-hidden bg-white/5">
                    <img src={s.avatarUrl || `https://avatar.vercel.sh/${s.username}`} alt={s.username} className="w-full h-full object-cover" />
                  </div>
                  <button 
                    onClick={() => handleRemove(s._id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 shadow-md"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="h-10 px-3 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-xs font-mono font-bold text-muted-foreground ml-2">
                {selected.length} / 20
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <input 
            type="text"
            placeholder="My List Name"
            value={listName}
            onChange={e => setListName(e.target.value)}
            className="w-full md:w-32 h-10 px-3 bg-background border border-white/10 rounded-lg text-sm focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button 
            onClick={handleSave}
            disabled={selected.length === 0 || isSaving}
            className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HugeiconsIcon icon={FloppyDiskIcon} className="w-4 h-4" /> {isSaving ? "Saving..." : "Save"}
          </button>
          <button 
            onClick={handlePlayNow}
            disabled={selected.length === 0}
            className="h-10 px-4 bg-primary text-background hover:bg-primary/90 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HugeiconsIcon icon={Tv01Icon} className="w-4 h-4" /> Play
          </button>
        </div>

      </div>
    </div>
  )
}
