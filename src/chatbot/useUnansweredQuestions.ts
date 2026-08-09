import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type UnansweredQuestion = {
  id: string
  question_text: string
  asked_count: number
  last_asked_at: string
}

export function useUnansweredQuestions() {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('chat_unanswered_questions')
      .select('*')
      .order('asked_count', { ascending: false })
      .order('last_asked_at', { ascending: false })
    setQuestions(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('chat_unanswered_questions').delete().eq('id', id)
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [load]
  )

  return { questions, loading, remove, reload: load }
}
