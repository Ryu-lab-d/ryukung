import { useCallback, useRef, useState } from 'react'

export function useGuardedSubmit<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>
) {
  const [busy, setBusy] = useState(false)
  const runningRef = useRef(false)

  const run = useCallback(
    async (...args: Args): Promise<Result | undefined> => {
      if (runningRef.current) return undefined
      runningRef.current = true
      setBusy(true)
      try {
        return await action(...args)
      } finally {
        runningRef.current = false
        setBusy(false)
      }
    },
    [action]
  )

  return { run, busy }
}
