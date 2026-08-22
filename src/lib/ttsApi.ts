import { supabase } from './supabase'

/** เรียก Edge Function แปลงข้อความเป็นเสียงพูดภาษาไทยจริงจาก Google Cloud TTS — คืน MP3 เป็น base64 */
export async function synthesizeThaiSpeech(text: string): Promise<{ audioContent: string | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('speak-thai', { body: { text } })
  if (error) return { audioContent: null, error: error.message }
  return { audioContent: (data?.audioContent as string | undefined) ?? null, error: null }
}
