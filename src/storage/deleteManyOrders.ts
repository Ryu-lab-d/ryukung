import { deleteOrder } from '../orders/api'

/** ลบออเดอร์หลายรายการทีละอัน (ใช้ร่วมกันทุกส่วนของหน้าจัดการพื้นที่จัดเก็บ) */
export async function deleteManyOrders(orderIds: string[]) {
  const errors: string[] = []
  for (const id of orderIds) {
    const { error } = await deleteOrder(id)
    if (error) errors.push(error.message)
  }
  return { errors }
}
