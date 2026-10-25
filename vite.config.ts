/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * Resolve the public base path.
 *
 * - `VITE_BASE_PATH` wins when set explicitly (e.g. "/my-repo/" or "./").
 * - On GitHub Actions the repository name is read from `GITHUB_REPOSITORY`
 *   ("owner/repo") so project pages are served from "/repo/". A user/org
 *   site repository ("owner.github.io") is served from "/".
 * - Local development and ordinary builds use "/".
 */
export function resolveBasePath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.VITE_BASE_PATH?.trim()
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`
  if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY) {
    const repo = env.GITHUB_REPOSITORY.split('/')[1] ?? ''
    if (!repo || repo.toLowerCase().endsWith('.github.io')) return '/'
    return `/${repo}/`
  }
  return '/'
}

export default defineConfig({
  base: resolveBasePath(),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
