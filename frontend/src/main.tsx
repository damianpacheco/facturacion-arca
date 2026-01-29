import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toast } from '@nimbus-ds/components'
import { AppProvider } from './contexts/AppContext'
import App from './App'
import NexoSyncRoute from './components/NexoSyncRoute'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toast.Provider>
        <AppProvider>
          <BrowserRouter>
            <NexoSyncRoute>
              <App />
            </NexoSyncRoute>
          </BrowserRouter>
        </AppProvider>
      </Toast.Provider>
    </QueryClientProvider>
  </React.StrictMode>,
)
