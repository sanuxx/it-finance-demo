import { describe, expect, it } from 'vitest'
import { resolveBasePath } from '../../vite.config'

describe('GitHub Pages base path', () => {
  it('uses / locally', () => {
    expect(resolveBasePath({})).toBe('/')
  })
  it('derives /<repo>/ on GitHub Actions', () => {
    expect(resolveBasePath({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'someone/finance-demo' })).toBe('/finance-demo/')
  })
  it('serves user/org pages from /', () => {
    expect(resolveBasePath({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'someone/someone.github.io' })).toBe('/')
  })
  it('honours an explicit override and adds a trailing slash', () => {
    expect(resolveBasePath({ VITE_BASE_PATH: '/custom', GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'a/b' })).toBe('/custom/')
  })
})
