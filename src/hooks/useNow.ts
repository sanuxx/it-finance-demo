import { useState } from 'react'

/** The current time, captured once when the component mounts (keeps render pure). */
export function useNow(): Date {
  const [now] = useState(() => new Date())
  return now
}
