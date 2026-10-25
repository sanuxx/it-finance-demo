import { useState } from 'react'

/**
 * Run `callback` during render on the first render and whenever any of `deps` changes.
 * Use it to (re)initialise local state from a prop/selection — React's recommended
 * alternative to a `useEffect` that only calls `setState`
 * (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
 * The callback must only set state of the calling component.
 */
export function useOnChange(deps: readonly unknown[], callback: () => void): void {
  const [prev, setPrev] = useState<readonly unknown[] | null>(null)
  if (prev === null || prev.length !== deps.length || prev.some((d, i) => !Object.is(d, deps[i]))) {
    setPrev(deps)
    callback()
  }
}
