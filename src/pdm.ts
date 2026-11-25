import { makeDemoData } from './demoData'
import { vdiDemoLimits, type Measurement, type Settings } from './domain'

export type PdmMetric = 'bandA' | 'bandB' | 'temperature'
export interface TrendProjection {
  slope: number
  slowerSlope: number
  fasterSlope: number
  spread: number
  horizonHours: number
}

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

export function projectTrend(history: ReturnType<typeof pdmHistory>['history'], metric: PdmMetric): TrendProjection | { reason: string } {
  const latest = history.at(-1)
  if (!latest || latest[1].sensorStatus === 'Offline') {
    return { reason: 'No online reading at this point.' }
  }

  const [endTime, current] = latest
  const comparable = history.slice(-fitLimit).reverse()
  const firstMismatch = comparable.findIndex(([, row]) =>
    row.sensorStatus !== 'Online' ||
    Math.abs(row.load - current.load) > 5 ||
    Math.abs(row.rpm - current.rpm) > current.rpm * 0.05,
  )
  const recentRun = firstMismatch === -1 ? comparable : comparable.slice(0, firstMismatch)
  const samples = recentRun.reverse().map(([time, row]) => ({ h: (time - endTime) / hourMs, value: row[metric] }))
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

  const residualSum = samples.reduce((sum, { h, value }) => {
    const fitted = meanValue + slope * (h - meanHour)
    return sum + (value - fitted) ** 2
  }, 0)
  const residual = Math.sqrt(residualSum / (samples.length - 2))
  const slopeSpread = 2 * residual / Math.sqrt(timeVariance)
  // A sensitivity range for planning, based on fit scatter and slope variation.
  return {
    slope,
    slowerSlope: Math.max(0, slope - slopeSpread),
    fasterSlope: slope + slopeSpread,
    spread: 2 * residual,
    horizonHours: Math.min(spanHours, 7 * 24),
  }
}

export function thresholdOutlook(projection: TrendProjection, value: number, limit: number) {
  const distance = limit - value
  if (distance <= 0) return null

  const earliest = Math.max(0, (distance - projection.spread) / projection.fasterSlope)
  if (earliest > projection.horizonHours) return null

  const estimated = distance / projection.slope
  const latest = (distance + projection.spread) / projection.slowerSlope
  return {
    earliest,
    estimated: estimated <= projection.horizonHours ? estimated : null,
    latest: latest <= projection.horizonHours ? latest : null,
  }
}

export function inspectionPlan(warning: number | null, critical: number | null, value: number | null, estimate: ReturnType<typeof thresholdOutlook>, leadHours: number) {
  if (value === null) return null
  if (critical !== null && value >= critical) return { state: 'urgent' } as const
  if (warning === null) return null
  if (value >= warning) return { state: 'warning' } as const
  if (!estimate) return null
  const hours = estimate.earliest - leadHours
  return hours <= 0 ? { state: 'soon' } as const : { state: 'planned', hours } as const
}

export function makePdmDemo(settings: Settings, machineId: string) {
  const rows = makeDemoData(machineId).slice(-48)
  const endTime = Date.parse(rows.at(-1)!.timestamp)
  return rows.map((row, index) => {
    const stepsBack = rows.length - 1 - index
    const age = Math.floor(stepsBack / 2)
    const variation = Math.sin(age * 1.6) * 0.015
    const rise = Math.max(0, 1 - age / 18) ** 1.45
    const bandA = vdiDemoLimits(row, 'bandA', settings)
    const bandB = vdiDemoLimits(row, 'bandB', settings)
    const demoReading = (limits: typeof bandA, fallback: number) => {
      if (limits?.alarm == null) return fallback
      const latest = limits.baseline + 0.75 * (limits.alarm - limits.baseline)
      return Number((limits.baseline + (latest - limits.baseline) * rise + variation * limits.alarm).toFixed(2))
    }
    const time = endTime - stepsBack * 6 * hourMs
    return {
      ...row,
      timestamp: new Date(time).toISOString(),
      windowEnd: new Date(time + 10_000).toISOString(),
      rpm: 2920,
      load: 75,
      bandA: demoReading(bandA, row.bandA),
      bandB: demoReading(bandB, row.bandB),
      temperature: Math.max(0, Number((settings.temperatureWarning - 9 + 7 * rise + variation * 20).toFixed(2))),
    }
  })
}
