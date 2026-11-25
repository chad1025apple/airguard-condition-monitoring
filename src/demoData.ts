import { type AppAlert, type Measurement, type Settings, assessMeasurement, avgCurrent, currentUnbalance, presentationSpecs, standardGravity, vuf } from './domain'

const round = (value: number, digits = 2) => Number(value.toFixed(digits))

export type PresentationScenario = 'normal' | 'warning' | 'critical'

const snapshots = {
  // Final comparison values shown on slides 19–21. Acceleration in the screenshots was in g.
  normal: { bandA: 2.13, bandB: 1.55, accelerationG: 0.75, envelopeG: 0.36, temperature: 68.9, score: 0.19, rpm: 2911, load: 75 },
  warning: { bandA: 3.29, bandB: 2.44, accelerationG: 1.17, envelopeG: 0.57, temperature: 84.45, score: 0.82, rpm: 2919, load: 76.8 },
  critical: { bandA: 11.19, bandB: 8.75, accelerationG: 4.42, envelopeG: 2.36, temperature: 127.63, score: 0.77, rpm: 2895, load: 75.8 },
}

export function makeDemoData(machineId: string, scenario: PresentationScenario = 'normal'): Measurement[] {
  const now = Date.now()
  const final = snapshots[scenario]
  const points: Measurement[] = []

  for (let index = 0; index < 144; index += 1) {
    const phase = index / 8
    const wave = Math.sin(phase) * 0.16 + Math.cos(phase / 2.5) * 0.09
    const isP2 = index % 2 === 1
    const time = now - (143 - index) * 10 * 60_000
    const isLatest = index === 143
    const progress = isLatest ? 1 : scenario === 'critical' ? Math.max(0, (index - 136) / 7) : 0
    const approach = (baseline: number, target: number) => round(baseline + progress * (target - baseline))
    const imbalance = 0.7 + Math.abs(Math.sin(phase / 3)) * 0.4
    const voltageBase = 399.5 + Math.sin(phase) * 1.4
    // The case-study current reference is 62 A (slide 15).
    const currentBase = isLatest ? 62 : 62 + wave * 3
    const acceleration = approach(0.73 + Math.abs(wave) * 0.25, final.accelerationG)
    const envelope = approach(0.36 + Math.abs(wave) * 0.11, final.envelopeG)
    const crestFactor = round(3.82 + Math.abs(wave) * 0.35)
    const score = approach(0.18 + Math.abs(wave) * 0.08, final.score)
    points.push({
      id: `${machineId}-${scenario}-${time}-${index}`,
      windowId: `W${String(index + 1).padStart(2, '0')}`,
      timestamp: new Date(time).toISOString(),
      windowEnd: new Date(time + 10_000).toISOString(),
      operatingState: 'Simulated window',
      machineId,
      point: isP2 ? 'P2' : 'P1',
      direction: 'Radial H',
      simulated: true,
      vdiExample: true,
      rpm: isLatest ? final.rpm : round(2922 + Math.sin(phase / 1.8) * 22, 0),
      load: isLatest ? final.load : round(73 + Math.sin(phase / 2) * 5 + wave * 4, 1),
      pressure: isLatest ? presentationSpecs.operatingPressure : round(9.9 + Math.sin(phase / 4) * 0.10),
      voltageA: round(voltageBase + imbalance * 0.45),
      voltageB: round(voltageBase - imbalance * 0.8),
      voltageC: round(voltageBase + imbalance * 0.25),
      currentA: round(currentBase + imbalance * 0.44),
      currentB: round(currentBase - imbalance * 0.62),
      currentC: round(currentBase + imbalance * 0.18),
      bandA: approach(2.05 + wave + (isP2 ? 0.15 : 0), final.bandA),
      bandB: approach(1.48 + wave * 0.6 + (isP2 ? 0.11 : 0), final.bandB),
      acceleration: round(acceleration * standardGravity),
      accelerationPeak: round(acceleration * crestFactor * standardGravity),
      crestFactor,
      kurtosis: round(3.12 + Math.abs(wave) * 0.5 + progress * 0.7),
      oneX: round(0.56 + Math.abs(wave) * 0.2 + progress * (final.bandB - snapshots.normal.bandB) * 0.52),
      twoX: round(0.35 + Math.abs(wave) * 0.17 + progress * (final.bandB - snapshots.normal.bandB) * 0.3),
      envelopeRms: round(envelope * standardGravity),
      envelopePeak: round(envelope * 3 * standardGravity),
      temperature: approach(68.5 + Math.sin(phase / 3) * 1.5, final.temperature),
      anomalyScore: score,
      anomaly: score >= 0.62,
      sensorStatus: 'Online',
    })
  }
  return points
}

export function recentAlerts(data: Measurement[], settings: Settings): AppAlert[] {
  const alertable = data.flatMap((measurement) => {
    const { findings } = assessMeasurement(measurement, settings)
    const finding = findings.find(({ level }) => level === 'CRITICAL') ?? findings[0]
    return finding ? [{ measurement, finding }] : []
  }).slice(-8).reverse()
  return alertable.map(({ measurement, finding }) => {
    const { label, value, unit, limit, level, key } = finding
    return {
      id: `ALT-${measurement.id}-${measurement.timestamp}`,
      timestamp: measurement.timestamp,
      machineId: measurement.machineId,
      parameter: label,
      measured: `${round(value)}${unit}`,
      threshold: `${limit}${unit}`,
      severity: level === 'CRITICAL' ? 'Critical' : 'Warning',
      source: key === 'anomaly' ? 'AI anomaly detection' : 'Engineering rule',
      description: `${label} requires engineer review.`,
      status: 'New',
      note: '',
    }
  })
}

export function simulateMeasurement(previous: Measurement, settings: Settings, anomaly = false): Measurement {
  const variation = () => (Math.random() - 0.5)
  const now = Date.now()
  const f = anomaly ? 1.55 : 1
  const score = anomaly ? 0.76 + Math.random() * 0.14 : Math.max(0.1, previous.anomalyScore + variation() * 0.09)
  return {
    ...previous,
    id: `${previous.machineId}-${now}`,
    windowId: `W-${now}`,
    timestamp: new Date(now).toISOString(),
    windowEnd: new Date(now + 10_000).toISOString(),
    simulated: true,
    rpm: round(previous.rpm + variation() * 18, 0),
    load: round(previous.load + variation() * 4, 1),
    pressure: round(previous.pressure + variation() * 0.16),
    bandA: round((previous.bandA + variation() * 0.28) * f),
    bandB: round((previous.bandB + variation() * 0.22) * f),
    acceleration: round((previous.acceleration + variation() * 0.08 * standardGravity) * f),
    accelerationPeak: round((previous.accelerationPeak + variation() * 0.35 * standardGravity) * f),
    envelopeRms: round((previous.envelopeRms + variation() * 0.06 * standardGravity) * f),
    envelopePeak: round((previous.envelopePeak + variation() * 0.22 * standardGravity) * f),
    temperature: round(previous.temperature + (anomaly ? 12 + Math.random() * 4 : variation() * 0.7)),
    anomalyScore: round(score),
    anomaly: score >= settings.anomalyThreshold,
  }
}

export function exportRow(m: Measurement) {
  return [
    m.machineId, m.timestamp, m.point, m.direction ?? 'Radial', m.rpm, m.load, m.pressure, m.sensorStatus,
    m.windowId ?? m.id, m.windowEnd ?? '', m.sampleRateHz ?? '', m.operatingState ?? '',
    m.bandA, m.bandB, m.acceleration, m.accelerationPeak, m.crestFactor, m.kurtosis, m.oneX, m.twoX,
    m.envelopeRms, m.envelopePeak, avgCurrent(m).toFixed(2), currentUnbalance(m)?.toFixed(2) ?? '', vuf(m)?.toFixed(2) ?? '', m.temperature,
  ]
}
