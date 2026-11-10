'use client'

// Last-resort screen when the root layout itself fails (every other crash is
// caught by the app's own error boundaries). It replaces the whole document,
// so it carries its own <html>/<body> and minimal inline styling, and shows
// both languages because the language setting may be what failed to load.
import { useEffect } from 'react'
import { reportClientError } from '@/lib/client-error-report'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, 'global-error')
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f6faf9',
          color: '#0f1f1d',
          padding: 16,
        }}
      >
        <main style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 4px' }}>কিছু একটা সমস্যা হয়েছে</p>
          <p style={{ fontSize: 14, color: '#4b5d5a', margin: '12px 0 20px' }}>
            Please reload the page. · পেজটি রিলোড করুন।
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: '#0f766e',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Try again · আবার চেষ্টা করুন
          </button>
        </main>
      </body>
    </html>
  )
}
