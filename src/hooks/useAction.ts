import { useCallback, useState } from 'react'
import { toast } from 'sonner'

/**
 * Wrap a repository call with pending state and toast feedback.
 * Validation errors thrown by repositories are shown to the user verbatim.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: { success?: string | ((result: R) => string); error?: string } = {}) {
  const [pending, setPending] = useState(false)
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true)
      try {
        const result = await fn(...args)
        const msg = typeof options.success === 'function' ? options.success(result) : options.success
        if (msg) toast.success(msg)
        return result
      } catch (error) {
        toast.error(error instanceof Error ? error.message : (options.error ?? 'Something went wrong.'))
        return undefined
      } finally {
        setPending(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, options.success, options.error],
  )
  return { run, pending }
}

/** Fire-and-toast helper for one-off calls outside of a component hook. */
export async function runWithToast<R>(promise: Promise<R>, success?: string): Promise<R | undefined> {
  try {
    const r = await promise
    if (success) toast.success(success)
    return r
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Something went wrong.')
    return undefined
  }
}
