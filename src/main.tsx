import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './app'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './providers/auth-provider'
import { ThemeProvider } from './providers/theme-provider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster theme="dark" richColors position="top-right" />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
