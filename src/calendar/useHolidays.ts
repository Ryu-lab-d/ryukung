import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Holiday = { id: string; holiday_date: string; note: string | null }

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('shop_holidays').select('*').order('holiday_date')
    setHolidays(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const addHoliday = useCallback(
    async (date: string, note: string | null) => {
      const { error } = await supabase.from('shop_holidays').insert({ holiday_date: date, note })
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [load]
  )

  const removeHoliday = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('shop_holidays').delete().eq('id', id)
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [load]
  )

  return { holidays, loading, addHoliday, removeHoliday, reload: load }
}
