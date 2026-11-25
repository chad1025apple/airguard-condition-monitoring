import { type AppAlert, type Measurement, type Settings, assessMeasurement, avgCurrent, currentUnbalance, vuf } from './domain'

const round = (value: number, digits = 2) => Number(value.toFixed(digits))

export function makeDemoData(machineId: string, scenario: 'normal' | 'warning' | 'anomaly' = 'normal'): Measurement[] {
  const now = Date.now()
  const points: Measurement[] = []
  const factors = scenario === 'anomaly'
    ? { vibration: 2.1, heat: 1.42, imbalance: 2.6, score: 0.78 }
    : scenario === 'warning'
      ? { vibration: 1.35, heat: 1.18, imbalance: 1.45, score: 0.57 }
      : { vibration: 1, heat: 1, imbalance: 1, score: 0.18 }

  for (let index = 0; index < 144; index += 1) {
    const phase = index / 8
    const wave = Math.sin(phase) * 0.16 + Math.cos(phase / 2.5) * 0.09
    const isP2 = index % 2 === 1
    const drift = index > 118 && scenario !== 'normal' ? (index - 118) / 38 : 0
    const load = 73 + Math.sin(phase / 2) * 5 + wave * 4
    const rpm = 2922 + Math.sin(phase / 1.8) * 22
    const imbalance = (0.7 + Math.abs(Math.sin(phase / 3)) * 0.4) * factors.imbalance + drift
    const bandA = (2.05 + wave + (isP2 ? 0.15 : 0)) * factors.vibration + drift * 1.2
    const bandB = (1.48 + wave * 0.6 + (isP2 ? 0.11 : 0)) * factors.vibration + drift * 0.95
    const score = Math.min(0.98, factors.score + Math.abs(wave) * 0.08 + drift * 0.17)
    const voltageBase = 399.5 + Math.sin(phase) * 1.4
    const currentBase = 115 + load * 0.72
    points.push({
      id: `${machineId}-${index}`,
      timestamp: new Date(now - (143 - index) * 10 * 60_000).toISOString(),
      machineId,
      point: isP2 ? 'P2' : 'P1',
      direction: 'Radial',
      simulated: true,
      vdiExample: true,
      rpm: round(rpm, 0),
      load: round(load, 1),
      pressure: round(7.05 + Math.sin(phase / 4) * 0.13, 2),
      voltageA: round(voltageBase + imbalance * 0.45),
      voltageB: round(voltageBase - imbalance * 0.8),
      voltageC: round(voltageBase + imbalance * 0.25),
      currentA: round(currentBase + imbalance * 1.2),
      currentB: round(currentBase - imbalance * 1.7),
      currentC: round(currentBase + imbalance * 0.5),
      bandA: round(bandA),
      bandB: round(bandB),
      acceleration: round((0.73 + Math.abs(wave) * 0.25) * factors.vibration + drift * 0.3),
      accelerationPeak: round((2.85 + Math.abs(wave) * 0.7) * factors.vibration + drift * 0.9),
      crestFactor: round(3.82 + Math.abs(wave) * 0.35 + drift * 0.5),
      kurtosis: round(3.12 + Math.abs(wave) * 0.5 + drift * 0.7),
      oneX: round((0.56 + Math.abs(wave) * 0.2) * factors.vibration),
      twoX: round((0.35 + Math.abs(wave) * 0.17) * factors.vibration),
      envelopeRms: round((0.36 + Math.abs(wave) * 0.11) * factors.vibration + drift * 0.28),
      envelopePeak: round((1.08 + Math.abs(wave) * 0.35) * factors.vibration + drift * 0.8),
      temperature: round((64.5 + Math.sin(phase / 3) * 1.5 + load * 0.065) * factors.heat + drift * 5.4),
      anomalyScore: round(score),
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
  const f = anomaly ? 1.55 : 1
  const score = anomaly ? 0.76 + Math.random() * 0.14 : Math.max(0.1, previous.anomalyScore + variation() * 0.09)
  return {
    ...previous,
    id: `${previous.machineId}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    simulated: true,
    rpm: round(previous.rpm + variation() * 18, 0),
    load: round(previous.load + variation() * 4, 1),
    pressure: round(previous.pressure + variation() * 0.16),
    bandA: round((previous.bandA + variation() * 0.28) * f),
    bandB: round((previous.bandB + variation() * 0.22) * f),
    acceleration: round((previous.acceleration + variation() * 0.08) * f),
    accelerationPeak: round((previous.accelerationPeak + variation() * 0.35) * f),
    envelopeRms: round((previous.envelopeRms + variation() * 0.06) * f),
    envelopePeak: round((previous.envelopePeak + variation() * 0.22) * f),
    temperature: round(previous.temperature + (anomaly ? 12 + Math.random() * 4 : variation() * 0.7)),
    anomalyScore: round(score),
    anomaly: score >= settings.anomalyThreshold,
  }
}

export function exportRow(m: Measurement) {
  return [
    m.machineId, m.timestamp, m.point, m.direction ?? 'Radial', m.rpm, m.load, m.pressure, m.sensorStatus,
    m.bandA, m.bandB, m.acceleration, m.accelerationPeak, m.crestFactor, m.kurtosis, m.oneX, m.twoX,
    m.envelopeRms, m.envelopePeak, avgCurrent(m).toFixed(2), currentUnbalance(m)?.toFixed(2) ?? '', vuf(m)?.toFixed(2) ?? '', m.temperature,
  ]
}
