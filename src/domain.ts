export type Status = 'NORMAL' | 'WARNING' | 'HIGH ALERT' | 'CRITICAL' | 'OFFLINE' | 'NOT CONFIGURED'
export type Severity = 'Info' | 'Warning' | 'High' | 'Critical'
export type AlertStatus = 'New' | 'Acknowledged' | 'Under Inspection' | 'Resolved'
export type VdiMount = 'rigid' | 'resilient'
export type VibrationBand = 'bandA' | 'bandB'
export type View =
  | 'overview'
  | 'vibration'
  | 'electrical'
  | 'temperature'
  | 'diagnosis'
  | 'ai'
  | 'dataset'
  | 'alerts'
  | 'settings'

export interface Measurement {
  id: string
  timestamp: string
  machineId: string
  point: 'P1' | 'P2'
  direction?: string
  windowId?: string
  windowEnd?: string
  sampleRateHz?: number
  operatingState?: string
  simulated?: boolean
  vdiExample?: boolean
  rpm: number
  load: number
  pressure: number
  voltageA?: number
  voltageB?: number
  voltageC?: number
  currentA?: number
  currentB?: number
  currentC?: number
  csvElectrical?: { averageCurrent: number; currentUnbalance: number; vuf: number }
  bandA: number
  bandB: number
  acceleration: number
  accelerationPeak: number
  crestFactor: number
  kurtosis: number
  oneX: number
  twoX: number
  envelopeRms: number
  envelopePeak: number
  temperature: number
  anomalyScore: number
  anomaly: boolean
  sensorStatus: 'Online' | 'Offline'
}

export interface AppAlert {
  id: string
  timestamp: string
  machineId: string
  parameter: string
  measured: string
  threshold: string
  severity: Severity
  source: 'Engineering rule' | 'AI anomaly detection' | 'Data quality' | 'Diagnosis'
  description: string
  status: AlertStatus
  note: string
}

export interface Settings {
  machineId: string
  machineName: string
  ratedPower: number
  ratedRpm: number
  vdiMount: VdiMount
  baselineP1BandA: number
  baselineP1BandB: number
  baselineBandA: number
  baselineBandB: number
  vufWarning: number
  currentUnbalanceWarning: number
  temperatureWarning: number
  temperatureCritical: number
  anomalyThreshold: number
  modelVersion: string
  modelStatus: 'DEMO MODE' | 'Connected'
  measurementWindow: number
  refreshInterval: number
}

export const presentationSpecs = {
  machineId: 'AC-01',
  machineName: 'Screw Airend',
  ratedPower: 55,
  ratedRpm: 3000,
  operatingPressure: 10,
  freeAirDelivery: 9.3,
}

export const defaultSettings: Settings = {
  machineId: presentationSpecs.machineId,
  machineName: presentationSpecs.machineName,
  ratedPower: presentationSpecs.ratedPower,
  ratedRpm: presentationSpecs.ratedRpm,
  vdiMount: 'rigid',
  baselineP1BandA: 2.0,
  baselineP1BandB: 1.5,
  baselineBandA: 2.1,
  baselineBandB: 1.6,
  vufWarning: 2,
  currentUnbalanceWarning: 5,
  temperatureWarning: 78,
  temperatureCritical: 88,
  anomalyThreshold: 0.62,
  modelVersion: 'IF-DEMO-0.3',
  modelStatus: 'DEMO MODE',
  measurementWindow: 10,
  refreshInterval: 30,
}

export const featureHeaders = [
  'F01_Band_A_Velocity_RMS', 'F02_Band_B_Velocity_RMS', 'F03_Acceleration_RMS',
  'F04_Acceleration_Absolute_Peak', 'F05_Crest_Factor', 'F06_Pearson_Kurtosis',
  'F07_1x_Velocity_RMS', 'F08_2x_Velocity_RMS', 'F09_Envelope_RMS',
  'F10_Envelope_Spectral_Peak', 'F11_Average_3phase_Current_RMS',
  'F12_Current_Unbalance_Index', 'F13_Voltage_Unbalance_Factor',
  'F14_Housing_Temperature',
]

export const legacyMetadataHeaders = [
  'Machine_ID', 'Timestamp', 'Measurement_Point', 'Direction', 'RPM', 'Load_Percent',
  'Discharge_Pressure', 'Sensor_Status',
]
export const windowMetadataHeaders = [
  'Window_ID', 'Window_End', 'Sample_Rate_Hz', 'Operating_State',
]
export const csvHeaders = [
  ...legacyMetadataHeaders, ...windowMetadataHeaders, ...featureHeaders,
]

export const standardGravity = 9.80665

export function avgCurrent(m: Measurement) {
  if (m.csvElectrical) return m.csvElectrical.averageCurrent
  return ((m.currentA ?? 0) + (m.currentB ?? 0) + (m.currentC ?? 0)) / 3
}

export function currentUnbalance(m: Measurement) {
  if (m.csvElectrical) return m.csvElectrical.currentUnbalance
  const average = avgCurrent(m)
  if (!average || m.currentA === undefined || m.currentB === undefined || m.currentC === undefined) return null
  return Math.max(Math.abs(m.currentA - average), Math.abs(m.currentB - average), Math.abs(m.currentC - average)) / average * 100
}

export function vuf(m: Measurement) {
  if (m.csvElectrical) return m.csvElectrical.vuf
  const [ab, bc, ca] = [m.voltageA ?? 0, m.voltageB ?? 0, m.voltageC ?? 0]
  if (Math.min(ab, bc, ca) <= 0 || 2 * Math.max(ab, bc, ca) >= ab + bc + ca) return null

  // Equivalent sequence ratio from the three fundamental line-to-line RMS magnitudes.
  // The synthetic voltages have normal phase rotation.
  const beta = (ab ** 4 + bc ** 4 + ca ** 4) / (ab ** 2 + bc ** 2 + ca ** 2) ** 2
  const sequenceTerm = Math.sqrt(Math.max(0, Math.min(1, 3 - 6 * beta)))
  return 100 * Math.sqrt((1 - sequenceTerm) / (1 + sequenceTerm))
}

const featureDefinitions = [
  ['Band A velocity RMS', 'mm/s'], ['Band B velocity RMS', 'mm/s'],
  ['Acceleration RMS', 'm/s²'], ['Absolute acceleration peak', 'm/s²'],
  ['Crest factor', ''], ['Pearson kurtosis', ''],
  ['1× velocity RMS', 'mm/s'], ['2× velocity RMS', 'mm/s'],
  ['Envelope RMS after mean removal', 'm/s²'], ['Envelope spectrum peak amplitude', 'm/s²'],
  ['Average three-phase current RMS', 'A'], ['Current unbalance index', '%'],
  ['Voltage unbalance factor (VUF)', '%'], ['Bearing housing temperature', '°C'],
] as const

export function measurementFeatures(m: Measurement) {
  const values = [
    m.bandA, m.bandB, m.acceleration, m.accelerationPeak, m.crestFactor, m.kurtosis,
    m.oneX, m.twoX, m.envelopeRms, m.envelopePeak, avgCurrent(m), currentUnbalance(m), vuf(m), m.temperature,
  ]
  return featureDefinitions.map(([label, unit], index) => ({
    code: featureHeaders[index].slice(0, 3), label, unit, value: values[index],
  }))
}

// VDI 3836:2012, 4.1.2 Table 1, Group 3 row (no timing gears, P >= 55 kW).
const group3Zones = {
  rigid: { bandA: [8, 12], bandB: [3, 4.5] },
  resilient: { bandA: [10, 15], bandB: [4.5, 7] },
} as const

export function vibrationBaseline(point: Measurement['point'], band: VibrationBand, settings: Settings) {
  if (point === 'P1') return band === 'bandA' ? settings.baselineP1BandA : settings.baselineP1BandB
  return band === 'bandA' ? settings.baselineBandA : settings.baselineBandB
}

export function vdiDemoLimits(m: Measurement | undefined, band: VibrationBand, settings: Settings) {
  if (!m?.vdiExample || m.machineId !== settings.machineId || !(settings.ratedPower >= 55)) return null
  const mount = settings.vdiMount === 'resilient' ? 'resilient' : 'rigid'
  const [zone1, zone2] = group3Zones[mount][band]
  const baseline = vibrationBaseline(m.point, band, settings)
  // VDI 3836 5.1: baseline plus 25% of the Zone I upper boundary, capped at 125%.
  const alarm = baseline > 0 && baseline < zone1 ? Math.min(baseline + 0.25 * zone1, 1.25 * zone1) : null
  return { mount, zone1, zone2, baseline, alarm }
}

export function demoThermalLimits(m: Measurement | undefined, settings: Settings) {
  const { temperatureWarning: warning, temperatureCritical: critical } = settings
  return m?.vdiExample && Number.isFinite(warning) && Number.isFinite(critical) && warning > 0 && critical > warning
    ? { warning, critical }
    : null
}

export interface AlarmFinding {
  key: 'bandA' | 'bandB' | 'temperature' | 'vuf' | 'currentUnbalance' | 'anomaly'
  label: string
  value: number
  unit: string
  limit: number
  level: 'WARNING' | 'CRITICAL'
}

function thresholdFinding(key: AlarmFinding['key'], label: string, value: number | null, unit: string, warning: number | null, critical?: number): AlarmFinding | null {
  if (value === null) return null
  if (critical !== undefined && value >= critical) return { key, label, value, unit, limit: critical, level: 'CRITICAL' }
  if (warning !== null && value >= warning) return { key, label, value, unit, limit: warning, level: 'WARNING' }
  return null
}

export function assessMeasurement(m: Measurement, s: Settings): { status: Status; findings: AlarmFinding[] } {
  if (m.sensorStatus === 'Offline') return { status: 'OFFLINE', findings: [] }
  if (!m.vdiExample) return { status: 'NOT CONFIGURED', findings: [] }

  const bandA = vdiDemoLimits(m, 'bandA', s)
  const bandB = vdiDemoLimits(m, 'bandB', s)
  const thermal = demoThermalLimits(m, s)
  // Zone III maps to the prototype's highest review priority. No trip is configured.
  const findings = [
    thresholdFinding('temperature', 'Bearing housing temperature', m.temperature, ' °C', thermal?.warning ?? null, thermal?.critical),
    thresholdFinding('bandA', 'Band A vibration', m.bandA, ' mm/s', bandA?.alarm ?? null, bandA?.zone2),
    thresholdFinding('bandB', 'Band B vibration', m.bandB, ' mm/s', bandB?.alarm ?? null, bandB?.zone2),
    thresholdFinding('vuf', 'Voltage unbalance', vuf(m), '%', s.vufWarning),
    thresholdFinding('currentUnbalance', 'Current unbalance', currentUnbalance(m), '%', s.currentUnbalanceWarning),
    thresholdFinding('anomaly', 'Demo anomaly score', m.anomalyScore, '', s.anomalyThreshold),
  ].filter((finding) => finding !== null)

  if (findings.some(({ level }) => level === 'CRITICAL')) return { status: 'CRITICAL', findings }
  return { status: findings.length ? 'WARNING' : bandA?.alarm != null && bandB?.alarm != null && thermal ? 'NORMAL' : 'NOT CONFIGURED', findings }
}

export function statusFor(m: Measurement, s: Settings): Status {
  return assessMeasurement(m, s).status
}

export function severityFor(m: Measurement, s: Settings): Severity {
  const status = statusFor(m, s)
  return status === 'CRITICAL' ? 'Critical' : status === 'WARNING' ? 'Warning' : 'Info'
}
