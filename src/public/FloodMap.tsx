import { MapContainer, TileLayer, Polyline, Tooltip } from 'react-leaflet'
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BANGKOK_BOUNDS, MAJOR_ROAD_TYPES, isInBangkok, severityScore, type RoadFeature } from './floodData'

const BANGKOK_CENTER: LatLngExpression = [13.7563, 100.5018]
const MAP_BOUNDS: LatLngBoundsExpression = BANGKOK_BOUNDS

function severityColor(v: RoadFeature['properties']['verdict']): string {
  const s = severityScore(v)
  if (s === 0) return '#16a34a'
  if (s <= 4) return '#f59e0b'
  if (s <= 8) return '#ea580c'
  return '#dc2626'
}

function toLatLngLines(geometry: RoadFeature['geometry']): LatLngExpression[][] {
  if (geometry.type === 'LineString') {
    return [geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLngExpression)]
  }
  return geometry.coordinates.map((line) => line.map(([lng, lat]) => [lat, lng] as LatLngExpression))
}

/** แผนที่แสดงถนนสายหลักในเขตกรุงเทพฯ ไล่สีตามความรุนแรง (เขียว=ผ่านได้ปกติ ไปจนถึงแดง=รถผ่านไม่ได้เลย)
 * ใช้ OpenStreetMap tile ฟรี ไม่ต้องมี API key — ข้อมูลเส้นถนน+verdict มาจาก Floodboard.org (roads.geojson)
 * ที่ FloodStatusBanner โหลดมาให้แล้ว ที่นี่แค่กรองเอาเฉพาะที่อยู่ในกรอบพิกัดกรุงเทพฯ+ถนนสายหลักมาวาดเป็นเส้น */
export function FloodMap({ roads }: { roads: RoadFeature[] }) {
  const bangkokMajorRoads = roads.filter((f) => MAJOR_ROAD_TYPES.has(f.properties.hw) && isInBangkok(f))

  return (
    <div className="rounded-xl overflow-hidden border border-stone-200" style={{ height: 320 }}>
      <MapContainer
        center={BANGKOK_CENTER}
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        maxBounds={MAP_BOUNDS}
        maxBoundsViscosity={0.8}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bangkokMajorRoads.map((f, i) =>
          toLatLngLines(f.geometry).map((positions, j) => (
            <Polyline
              key={`${i}-${j}`}
              positions={positions}
              pathOptions={{ color: severityColor(f.properties.verdict), weight: 4, opacity: 0.8 }}
            >
              <Tooltip sticky>
                <span className="text-xs">
                  {f.properties.nameEn || f.properties.name || 'ถนนไม่ทราบชื่อ'}
                  {f.properties.depthCm != null ? ` — ลึก ${f.properties.depthCm} ซม.` : ''}
                </span>
              </Tooltip>
            </Polyline>
          ))
        )}
      </MapContainer>
    </div>
  )
}
