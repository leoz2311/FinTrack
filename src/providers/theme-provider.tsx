import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'
interface ThemeValue { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void }
const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('fintrack-theme') as Theme | null) ?? 'dark')
  const setTheme = (next: Theme) => {
    setThemeState(next)
    localStorage.setItem('fintrack-theme', next)
  }
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])
  const value = useMemo(() => ({ theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark') }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme mora biti unutar ThemeProvidera.')
  return value
}
