import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Settings = {
  id: string
  shop_name: string
  logo_path: string | null
  phone: string | null
  address: string | null
  promptpay: string | null
  receipt_footer: string | null
  receipt_show_logo: boolean
  receipt_show_address: boolean
  receipt_show_phone: boolean
  receipt_show_promptpay: boolean
  order_no_prefix: string
  receipt_no_prefix: string
  shipping_lead_days: number
  require_full_customer_info: boolean
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('settings').select('*').single()
    setSettings(data as Settings | null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(
    async (patch: Partial<Settings>) => {
      if (!settings) return { error: { message: 'ยังโหลดข้อมูลไม่เสร็จ' } }
      const { error } = await supabase
        .from('settings')
        .update(patch)
        .eq('id', settings.id)
      if (!error) await load()
      return { error: error ? { message: error.message } : null }
    },
    [settings, load]
  )

  const uploadLogo = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `logo/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true })
      if (upErr) return { error: { message: upErr.message } }
      return save({ logo_path: path })
    },
    [save]
  )

  return { settings, loading, save, uploadLogo }
}
