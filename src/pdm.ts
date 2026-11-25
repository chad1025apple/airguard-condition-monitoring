import { makeDemoData } from './demoData'
import { vdiDemoLimits, type Measurement, type Settings } from './domain'

export type PdmMetric = 'bandA' | 'bandB' | 'temperature'
type TrendProjection = { reason: string } | { slope: number; horizonHours: number }

export const hourMs = 3_600_000
const historyLimit = 24
const fitLimit = 12

export function pdmHistory(data: Measurement[], machineId: string, point: Measurement['point'], metric: PdmMetric) {
  const readings = data.flatMap((row) => {
    if (row.machineId !== machineId || row.point !== point) return []
    const time = Date.parse(row.timestamp)
    if (!Number.isFinite(time) || !Number.isFinite(row[metric]) || row[metric] < 0) return []
    return [{ time, row }]
  }).sort((a, b) => a.time - b.time)

  const latest = readings.at(-1)?.row
  const direction = latest?.direction?.trim() || 'Unspecified'
  const byTime = new Map<number, Measurement>()
  for (const { time, row } of readings) {
    const rowDirection = row.direction?.trim() || 'Unspecified'
    if (rowDirection.toLowerCase() === direction.toLowerCase() && Boolean(row.simulated) === Boolean(latest?.simulated)) {
      byTime.set(time, row)
    }
  }
  return { direction, history: [...byTime].slice(-historyLimit) }
}

export function projectTrend(history: ReturnType<typeof pdmHistory>['history'], metric: PdmMetric): TrendProjection {
  const latest = history.at(-1)
  if (!latest || latest[1].sensorStatus === 'Offline') {
    return { reason: 'No online reading at this point.' }
  }

  const [endTime, current] = latest
  const comparable = history.filter(([, row]) =>
    row.sensorStatus === 'Online' &&
    Math.abs(row.load - current.load) <= 5 &&
    Math.abs(row.rpm - current.rpm) <= current.rpm * 0.05,
  ).slice(-fitLimit)
  const samples = comparable.map(([time, row]) => ({ h: (time - endTime) / hourMs, value: row[metric] }))
  const spanHours = -(samples[0]?.h ?? 0)

  if (samples.length < 6 || spanHours < 1) {
    return { reason: 'Need at least 6 comparable online readings spanning 1 hour.' }
  }

  const meanHour = samples.reduce((total, sample) => total + sample.h, 0) / samples.length
  const meanValue = samples.reduce((total, sample) => total + sample.value, 0) / samples.length
  let covariance = 0
  let timeVariance = 0
  let valueVariance = 0
  for (const sample of samples) {
    const timeDelta = sample.h - meanHour
    const valueDelta = sample.value - meanValue
    covariance += timeDelta * valueDelta
    timeVariance += timeDelta ** 2
    valueVariance += valueDelta ** 2
  }

  const slope = covariance / timeVariance
  const fit = valueVariance > 0 ? covariance ** 2 / (timeVariance * valueVariance) : 0
  if (slope <= 0 || fit < 0.75) {
    return { reason: 'The recent readings show no consistent rise.' }
  }

  return { slope, horizonHours: Math.min(spanHours, 7 * 24) }
}

export function makePdmDemo(settings: Settings, machineId: string) {
  const rows = makeDemoData(machineId).slice(-48)
  const endTime = Date.parse(rows.at(-1)!.timestamp)
  return rows.map((row, index) => {
    const stepsBack = rows.length - 1 - index
    const age = Math.floor(stepsBack / 2)
    const variation = Math.sin(age * 1.4) * 0.008
    const scale = 0.92 - age * 0.021 + variation
    const bandAAlarm = vdiDemoLimits(row, 'bandA', settings)?.alarm
    const bandBAlarm = vdiDemoLimits(row, 'bandB', settings)?.alarm
    return {
      ...row,
      timestamp: new Date(endTime - stepsBack * 2 * hourMs).toISOString(),
      rpm: 2920,
      load: 75,
      bandA: bandAAlarm == null ? row.bandA : Number((bandAAlarm * scale).toFixed(2)),
      bandB: bandBAlarm == null ? row.bandB : Number((bandBAlarm * scale).toFixed(2)),
      temperature: Math.max(0, Number((settings.temperatureWarning - 2 - age * 0.42 + variation * 5).toFixed(2))),
    }
  })
}
