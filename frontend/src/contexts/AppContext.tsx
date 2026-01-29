import React, { createContext, useContext, useState } from 'react'

interface AppContextType {
  isEmbedded: boolean
  isNexoConnected: boolean
  setNexoConnected: (connected: boolean) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

/**
 * Detecta si la aplicación está corriendo dentro de un iframe (TiendaNube Admin).
 */
function detectEmbeddedMode(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isEmbedded] = useState(() => detectEmbeddedMode())
  const [isNexoConnected, setNexoConnected] = useState(false)

  return (
    <AppContext.Provider value={{ isEmbedded, isNexoConnected, setNexoConnected }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
