import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

const COMPRESS_OPTIONS = { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true }

/** ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด ถ้าย่อไม่สำเร็จให้ใช้ไฟล์เดิมแทนดีกว่าอัปโหลดไม่ได้เลย */
export async function compressImage(file: File): Promise<File> {
  try {
    return (await imageCompression(file, COMPRESS_OPTIONS)) as File
  } catch {
    return file
  }
}

export async function uploadToBucket(
  bucket: string,
  folder: string,
  file: File
): Promise<{ path: string | null; error: { message: string } | null }> {
  const compressed = await compressImage(file)
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, compressed, { upsert: false })
  return { path: error ? null : path, error: error ? { message: error.message } : null }
}
