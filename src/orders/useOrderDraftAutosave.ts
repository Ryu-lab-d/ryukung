import { loadFormDraft, clearFormDraft, useFormDraft } from '../lib/formDraft'

const PREFIX = 'order-draft:'

export function loadDraftFromLocalStorage<T>(orderId: string): T | null {
  return loadFormDraft<T>(PREFIX + orderId)
}

export function clearDraftFromLocalStorage(orderId: string) {
  clearFormDraft(PREFIX + orderId)
}

export function useOrderDraftAutosave<T>(orderId: string | null, draft: T) {
  useFormDraft(orderId ? PREFIX + orderId : null, draft)
}
