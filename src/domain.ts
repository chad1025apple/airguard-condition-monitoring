export type Status = 'NORMAL' | 'WARNING' | 'HIGH ALERT' | 'CRITICAL' | 'OFFLINE' | 'NOT CONFIGURED'
export type Severity = 'Info' | 'Warning' | 'High' | 'Critical'
export type AlertStatus = 'New' | 'Acknowledged' | 'Under Inspection' | 'Resolved'
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
  rpm: number
  load: number
  pressure: number
  voltageA: number
  voltageB: number
  voltageC: number
  currentA: number
  currentB: number
  currentC: number
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
  bandAWarn: number
  bandAHigh: number
  bandBWarn: number
  bandBHigh: number
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

export const defaultSettings: Settings = {
  machineId: 'AC-TSA-01',
  machineName: 'Main Process Air Compressor',
  ratedPower: 90,
  ratedRpm: 2960,
  bandAWarn: 4.5,
  bandAHigh: 7.1,
  bandBWarn: 3.5,
  bandBHigh: 5.6,
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

export const csvHeaders = [
  'Machine_ID', 'Timestamp', 'Measurement_Point', 'Direction', 'RPM', 'Load_Percent',
  'Discharge_Pressure', 'Sensor_Status', ...featureHeaders,
]

export function avgCurrent(m: Measurement) {
  return (m.currentA + m.currentB + m.currentC) / 3
}

export function currentUnbalance(m: Measurement) {
  const average = avgCurrent(m)
  return Math.max(Math.abs(m.currentA - average), Math.abs(m.currentB - average), Math.abs(m.currentC - average)) / average * 100
}

export function vuf(m: Measurement) {
  const average = (m.voltageA + m.voltageB + m.voltageC) / 3
  return Math.max(Math.abs(m.voltageA - average), Math.abs(m.voltageB - average), Math.abs(m.voltageC - average)) / average * 100
}

export function statusFor(m: Measurement, s: Settings): Status {
  if (m.sensorStatus === 'Offline') return 'OFFLINE'
  if (m.temperature >= s.temperatureCritical || m.bandA >= s.bandAHigh || m.bandB >= s.bandBHigh) return 'CRITICAL'
  if (m.temperature >= s.temperatureWarning || m.bandA >= s.bandAWarn || m.bandB >= s.bandBWarn || vuf(m) >= s.vufWarning || currentUnbalance(m) >= s.currentUnbalanceWarning || m.anomalyScore >= s.anomalyThreshold) return 'WARNING'
  return 'NORMAL'
}

export function severityFor(m: Measurement, s: Settings): Severity {
  const status = statusFor(m, s)
  return status === 'CRITICAL' ? 'Critical' : status === 'WARNING' ? 'Warning' : 'Info'
}
