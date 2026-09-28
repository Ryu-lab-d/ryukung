export type VehicleVerdict = 'ok' | 'caution' | 'risky' | 'blocked'

export type RoadFeature = {
  type: 'Feature'
  properties: {
    name: string
    nameEn: string | null
    hw: string
    depthCm: number | null
    verdict: { motorbike: VehicleVerdict; sedan: VehicleVerdict; pickup: VehicleVerdict; truck: VehicleVerdict }
  }
  geometry:
    | { type: 'LineString'; coordinates: [number, number][] }
    | { type: 'MultiLineString'; coordinates: [number, number][][] }
}

export const VEHICLE_ORDER = { ok: 0, caution: 1, risky: 2, blocked: 3 } as const

// เอาเฉพาะถนนสายหลักที่มีผลต่อการเดินทางจริง ตัดซอยเล็กๆ (residential/unclassified) ออก ไม่งั้นรายการ/แผนที่รกเกินไป
export const MAJOR_ROAD_TYPES = new Set(['motorway', 'trunk', 'primary', 'primary_link', 'secondary', 'secondary_link'])

export function severityScore(v: RoadFeature['properties']['verdict']): number {
  return VEHICLE_ORDER[v.motorbike] + VEHICLE_ORDER[v.sedan] + VEHICLE_ORDER[v.pickup] + VEHICLE_ORDER[v.truck]
}

// กรอบพิกัดคร่าวๆ ของกรุงเทพฯ+ปริมณฑลใกล้เคียง — ใช้กรองข้อมูลถนนทั้งประเทศของ Floodboard ให้เหลือแค่โซนที่ลูกค้าเราสนใจ (ตาม
// ที่ร้านขอเจาะจงกรุงเทพฯ) ไม่ใช่เขตปกครองที่แม่นยำ 100% แค่พอกรองแผนที่ให้ไม่รกเกินไป
export const BANGKOK_BOUNDS: [[number, number], [number, number]] = [
  [13.49, 100.33],
  [13.95, 100.94],
]

function firstCoord(geometry: RoadFeature['geometry']): [number, number] | null {
  if (geometry.type === 'LineString') return geometry.coordinates[0] ?? null
  return geometry.coordinates[0]?.[0] ?? null
}

export function isInBangkok(f: RoadFeature): boolean {
  const c = firstCoord(f.geometry)
  if (!c) return false
  const [lng, lat] = c
  const [[minLat, minLng], [maxLat, maxLng]] = BANGKOK_BOUNDS
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
}
