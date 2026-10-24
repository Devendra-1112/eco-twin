import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load server-side environment variables in local development without exposing them to client code
  const env = loadEnv(mode, process.cwd(), '')
  const serverKeys = ['GEMINI_API_KEY', 'GEMINI_API_KEY_FALLBACK_1', 'GEMINI_API_KEY_FALLBACK_2', 'GEMINI_MODEL']
  for (const k of serverKeys) {
    if (env[k] && !process.env[k]) {
      process.env[k] = env[k]
    }
  }

  return {
    plugins: [
      build(),
      devServer({
        adapter,
        entry: 'src/index.tsx'
      })
    ]
  }
})

