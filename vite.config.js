import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Local API middleware so Vercel serverless endpoints in ./api/* also work
 * seamlessly during `vite` dev & `vite preview`!
 */
function localApiPlugin() {
  const routes = {
    '/api/cup': () => import('./api/cup.js'),
    '/api/cup/submit': () => import('./api/cup/submit.js'),
    '/api/cheer': () => import('./api/cheer.js'),
    '/api/name': () => import('./api/name/index.js'),
    '/api/name/claim': () => import('./api/name/claim.js'),
  }

  function attach(middlewares) {
    middlewares.use(async (req, res, next) => {
      const rawUrl = req.url || ''
      if (!rawUrl.startsWith('/api/')) return next()
      const urlObj = new URL(rawUrl, 'http://localhost')
      const pathname = urlObj.pathname.replace(/\/+$/, '')
      const loader = routes[pathname]
      if (!loader) return next()

      try {
        req.query = Object.fromEntries(urlObj.searchParams.entries())
        if (req.method === 'POST' || req.method === 'PUT') {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const rawBody = Buffer.concat(chunks).toString('utf8')
          req.body = rawBody ? JSON.parse(rawBody) : {}
        }
        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.json = (obj) => {
          if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(obj))
          return res
        }
        const mod = await loader()
        await mod.default(req, res)
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: err?.message || 'internal error' }))
      }
    })
  }

  return {
    name: 'monhouse-local-api',
    configureServer(server) {
      attach(server.middlewares)
    },
    configurePreviewServer(server) {
      attach(server.middlewares)
    },
  }
}

export default defineConfig({
  plugins: [react(), localApiPlugin()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
