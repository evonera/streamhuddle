import PaintBoardIcon from "@hugeicons/core-free-icons/PaintBoardIcon"
import { HugeiconsIcon } from "@hugeicons/react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { useNavigate } from "@tanstack/react-router"
import LockIcon from "@hugeicons/core-free-icons/LockIcon"

export function ThemeToggle() {
  const { setTheme } = useTheme()
  const me = useQuery(api.users.getMe)
  const navigate = useNavigate()

  const handleTheme = (theme: string, isPro: boolean = false) => {
    if (isPro && (!me || !me.isPro)) {
      navigate({ to: "/pricing" })
      return
    }
    setTheme(theme)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" aria-label="Toggle theme" />}
      >
        <HugeiconsIcon
          icon={PaintBoardIcon}
          className="size-5 transition-all"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Free Themes</div>
        <DropdownMenuItem onClick={() => handleTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTheme("gryffindor")}>Gryffindor</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTheme("dracula")}>Dracula</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTheme("ocean")}>Ocean</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleTheme("system")}>System</DropdownMenuItem>

        <div className="px-2 py-1.5 mt-2 text-xs font-semibold text-muted-foreground flex items-center justify-between">
          <span>Pro Themes</span>
          <HugeiconsIcon icon={LockIcon} className="w-3 h-3" />
        </div>
        
        {['monokai', 'nord', 'solarized', 'neon', 'cyberpunk', 'synthwave', 'hacker', 'forest'].map(theme => (
          <DropdownMenuItem 
            key={theme} 
            onClick={() => handleTheme(theme, true)}
            className="capitalize flex items-center justify-between"
          >
            {theme}
            {(!me || !me.isPro) && <HugeiconsIcon icon={LockIcon} className="w-3 h-3 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
