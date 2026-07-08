/* eslint-disable react-refresh/only-export-components */
import { ScriptOnce } from "@tanstack/react-router"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

type Theme = string

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

function buildThemeScript(storageKey: string, defaultTheme: Theme) {
  return `(function(){try{var k=${JSON.stringify(storageKey)};var d=${JSON.stringify(defaultTheme)};var t=localStorage.getItem(k);if(!t){t=d}var m=matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(m?'dark':'light'):t;var e=document.documentElement;if(r!=='light'&&r!=='dark'){e.classList.add('theme-'+r);e.classList.add('dark')}else{e.classList.add(r)}e.style.colorScheme=r==='light'?'light':'dark'}catch(e){}})();`
}

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: "system",
  setTheme: () => {},
})

function resolveTheme(theme: Theme): string {
  if (theme !== "system") return theme
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(resolved: string) {
  const root = document.documentElement
  // Remove all theme classes
  const classesToRemove = Array.from(root.classList).filter(c => c.startsWith('theme-') || c === 'light' || c === 'dark')
  root.classList.remove(...classesToRemove)
  
  if (resolved !== "light" && resolved !== "dark") {
    root.classList.add(`theme-${resolved}`)
    root.classList.add("dark") // Custom themes are generally dark mode based
    root.style.colorScheme = "dark"
  } else {
    root.classList.add(resolved)
    root.style.colorScheme = resolved
  }
}

function isTheme(value: unknown): value is Theme {
  return typeof value === "string"
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme
    const stored = localStorage.getItem(storageKey)
    return isTheme(stored) ? stored : defaultTheme
  })

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    applyTheme(resolveTheme(theme))
  }, [theme])

  useEffect(() => {
    if (theme !== "system") return undefined
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme(media.matches ? "dark" : "light")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = useCallback(
    (next: Theme) => {
      localStorage.setItem(storageKey, next)
      setThemeState(next)
    },
    [storageKey],
  )

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ThemeProviderContext value={value}>
      <ScriptOnce>{buildThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  )
}

export function useTheme() {
  return useContext(ThemeProviderContext)
}
