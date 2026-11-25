import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { demoThermalLimits, vdiDemoLimits, type Measurement, type Settings } from './domain'
import { hourMs, inspectionPlan, makePdmDemo, pdmHistory, projectTrend, thresholdOutlook, type PdmMetric } from './pdm'

const metrics = {
  bandA: { label: 'F01 · Band A velocity RMS', unit: 'mm/s' },
  bandB: { label: 'F02 · Band B velocity RMS', unit: 'mm/s' },
  temperature: { label: 'F14 · Bearing housing temperature', unit: '°C' },
} as const

const colors = { reading: '#60b8fa', projection: '#c6afff', warning: '#ffc271', critical: '#ff8590', baseline: '#61d4ae', zone: '#84a7ce' }
const dateTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateOnly = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })
const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const axis = { stroke: '#91a7bf', fontSize: 11, tickLine: false }
const tooltipStyle = { background: '#111d2d', border: '1px solid #314763', borderRadius: 8, color: '#e9f2fc' }

function duration(hours: number) {
  if (hours === 0) return 'now'
  if (hours < 1) return `${Math.ceil(hours * 60)} min`
  if (hours < 48) return `${Math.round(hours)} h`
  return `${number.format(hours / 24)} days`
}

interface PdmTrendProps {
  data: Measurement[]
  latest: Measurement
  settings: Settings
}

interface TrendRow {
  time: number
  reading: number | null
  forecast: number | null
  range: [number, number] | null
}

function crossingWindow(estimate: NonNullable<ReturnType<typeof thresholdOutlook>>, currentTime: number) {
  const start = dateTime.format(currentTime + estimate.earliest * hourMs)
  if (estimate.latest === null) return `Possible from ${start}. The later bound is outside the projection.`
  const end = dateTime.format(currentTime + estimate.latest * hourMs)
  return start === end ? `Estimated around ${start}` : `Planning range · ${start} to ${end}`
}

export function PdmTrend({ data, latest, settings }: PdmTrendProps) {
  const [metric, setMetric] = useState<PdmMetric>('bandA')
  const [selectedPoint, setSelectedPoint] = useState<Measurement['point']>()
  const [showDemo, setShowDemo] = useState(false)
  const [leadHours, setLeadHours] = useState(24)
  const machineId = showDemo ? settings.machineId : latest.machineId
  const point = selectedPoint ?? latest.point
  const example = useMemo(() => showDemo ? makePdmDemo(settings, machineId) : null, [showDemo, settings, machineId])
  const { history, direction } = pdmHistory(example ?? data, machineId, point, metric)
  const currentTime = history.at(-1)?.[0]
  const current = history.at(-1)?.[1]
  const value = current?.sensorStatus === 'Online' ? current[metric] : null
  const { unit } = metrics[metric]
  const isThermal = metric === 'temperature'
  const vdi = isThermal ? null : vdiDemoLimits(current, metric, settings)
  const thermal = isThermal ? demoThermalLimits(current, settings) : null
  const warning = (isThermal ? thermal?.warning : vdi?.alarm) ?? null
  const critical = (isThermal ? thermal?.critical : vdi?.zone2) ?? null
  const limits = [
    { label: isThermal ? 'Warning (demo)' : 'Warning · VDI ALARM', short: 'Warning', value: warning, color: colors.warning, className: 'pdm-warning' },
    { label: isThermal ? 'Critical (demo)' : 'Critical review · Zone II/III', short: 'Critical review', value: critical, color: colors.critical, className: 'pdm-critical' },
  ]
  const trend = projectTrend(history, metric)
  const outlook = critical !== null && value !== null && value < critical && 'slope' in trend ? trend : null
  const crossings = limits.map((limit) => ({
    ...limit,
    reached: limit.value !== null && value !== null && value >= limit.value,
    estimate: outlook && value !== null && limit.value !== null ? thresholdOutlook(outlook, value, limit.value) : null,
  }))
  const plan = inspectionPlan(warning, critical, value, crossings[0].estimate, leadHours)
  const inspectBy = currentTime !== undefined && plan?.state === 'planned' ? currentTime + plan.hours * hourMs : null
  const warningAt = currentTime !== undefined && crossings[0].estimate?.estimated != null
    ? currentTime + crossings[0].estimate.estimated * hourMs
    : null
  const chartData: TrendRow[] = history.map(([time, row]) => ({
    time,
    reading: row.sensorStatus === 'Online' ? row[metric] : null,
    forecast: null,
    range: null,
  }))

  if (outlook && value !== null && currentTime !== undefined) {
    const projectionSamples = Array.from({ length: 25 }, (_, index) => {
      const h = outlook.horizonHours * index / 24
      return {
        time: currentTime + h * hourMs,
        reading: index === 0 ? value : null,
        forecast: value + h * outlook.slope,
        range: [Math.max(0, value + h * outlook.slowerSlope - outlook.spread), value + h * outlook.fasterSlope + outlook.spread] as [number, number],
      }
    })
    chartData.splice(chartData.length - 1, 1, ...projectionSamples)
  }

  const firstTime = chartData[0]?.time ?? 0
  const lastTime = chartData.at(-1)?.time ?? firstTime
  const xDomain = firstTime === lastTime ? [firstTime - hourMs / 2, lastTime + hourMs / 2] : [firstTime, lastTime]
  const longView = lastTime - firstTime > 72 * hourMs
  const subtitle = showDemo ? 'Simulated degradation example' : current?.simulated ? 'Dashboard demo data' : current ? 'Imported CSV' : 'Dashboard data'
  const status = critical === null
    ? 'Thresholds need a verified configuration for these readings.'
    : outlook
      ? `The recent trend is projected up to ${duration(outlook.horizonHours)}. The shaded range reflects how much the recent fit varies.`
      : value !== null && value >= critical
        ? 'The latest reading reached the critical review level.'
        : 'reason' in trend ? trend.reason : null

  return <section className="panel pdm-panel" aria-labelledby="pdm-heading">
    <div className="pdm-header">
      <div>
        <h2 id="pdm-heading">Predictive maintenance trend</h2>
        <p>Airend · {machineId} · {point}{current && ` · ${direction}`} · {subtitle}</p>
      </div>
      <button type="button" className="outline-button" onClick={() => setShowDemo((active) => !active)}>
        {showDemo ? 'Use dashboard data' : 'Show degradation demo'}
      </button>
    </div>
    <div className="pdm-controls">
      <label>Indicator
        <select value={metric} onChange={(event) => setMetric(event.target.value as PdmMetric)}>
          {Object.entries(metrics).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label>Point
        <select value={point} onChange={(event) => setSelectedPoint(event.target.value as Measurement['point'])}>
          <option value="P1">P1 · DE (drive end)</option>
          <option value="P2">P2 · NDE (non-drive end)</option>
        </select>
      </label>
      <label>Inspection lead time
        <select value={leadHours} onChange={(event) => setLeadHours(Number(event.target.value))}>
          <option value={8}>8 hours</option>
          <option value={24}>24 hours</option>
          <option value={48}>48 hours</option>
        </select>
      </label>
    </div>
    <div className="pdm-readouts" aria-live="polite">
      <div>
        <span>Latest reading</span>
        <strong>{value === null ? 'Unavailable' : `${number.format(value)} ${unit}`}</strong>
        {currentTime !== undefined && <small>{dateTime.format(currentTime)} ICT</small>}
      </div>
      {crossings.map(({ label, value: limit, color, reached, estimate }) => <div key={label}>
        <span style={{ color }}>{label}{limit !== null && ` · ${number.format(limit)} ${unit}`}</span>
        <strong>{limit === null ? 'Not configured'
          : value === null ? 'Reading unavailable'
          : reached ? 'Threshold reached'
          : estimate?.estimated != null && currentTime !== undefined ? `~ ${dateTime.format(currentTime + estimate.estimated * hourMs)}`
          : estimate ? 'Possible crossing' : 'Below threshold'}</strong>
        {estimate && currentTime !== undefined && <small>{crossingWindow(estimate, currentTime)}</small>}
        {limit !== null && value !== null && !reached && !estimate && <small>{outlook ? 'Beyond the projection window' : 'No time estimate'}</small>}
      </div>)}
    </div>
    <div className="pdm-plan" data-state={plan?.state ?? 'unavailable'} aria-live="polite">
      <div>
        <span>Suggested inspection</span>
        <strong>{inspectBy !== null ? `By ${dateTime.format(inspectBy)} ICT`
          : plan?.state === 'urgent' ? 'Priority review now'
          : plan?.state === 'warning' || plan?.state === 'soon' ? 'Review now' : 'No inspection date estimated'}</strong>
      </div>
      <p>{inspectBy !== null ? `Allows ${duration(leadHours)} before the earliest estimated Warning. Confirm the schedule with maintenance.`
        : plan?.state === 'urgent' ? 'The critical review level is already reached. Verify the reading and follow the site procedure.'
        : plan?.state === 'warning' ? 'Warning is already reached. Verify the reading and coordinate an inspection.'
        : plan?.state === 'soon' ? `The earliest Warning falls within the selected ${duration(leadHours)} lead time. Review the trend with maintenance.`
        : 'The estimate appears when there is a configured Warning and a rising trend that may reach it within the forecast window.'}</p>
    </div>
    {chartData.length ? <div className="pdm-chart">
      <ResponsiveContainer width="100%" height={330}>
        <ComposedChart data={chartData} margin={{ top: 19, right: 17, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#31455e" strokeDasharray="4 4" />
          <XAxis {...axis} dataKey="time" type="number" scale="time" domain={xDomain} tickCount={6} minTickGap={32} tickFormatter={(time: number) => (longView ? dateOnly : dateTime).format(time)} />
          <YAxis {...axis} domain={[0, 'auto']} width={38} tickFormatter={(reading: number) => number.format(reading)} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(time) => `${dateTime.format(Number(time))} ICT`} formatter={(reading) =>
            Array.isArray(reading) ? `${reading.map((item) => number.format(Number(item))).join(' – ')} ${unit}`
              : typeof reading === 'number' ? `${number.format(reading)} ${unit}` : reading}
          />
          {outlook && currentTime !== undefined && <ReferenceArea x1={currentTime} x2={lastTime} fill="#a28ee5" fillOpacity={0.07} stroke="none" />}
          {vdi && vdi.baseline > 0 && vdi.baseline < (warning ?? vdi.zone1) && <ReferenceLine y={vdi.baseline} stroke={colors.baseline} strokeDasharray="3 4" ifOverflow="extendDomain" label={{ value: 'Healthy baseline', position: 'insideBottomLeft', fill: colors.baseline, fontSize: 11 }} />}
          {vdi && vdi.zone1 !== warning && <ReferenceLine y={vdi.zone1} stroke={colors.zone} strokeDasharray="3 4" ifOverflow="extendDomain" label={{ value: 'Zone I/II', position: 'insideTopRight', fill: colors.zone, fontSize: 11 }} />}
          {limits.map((limit) => limit.value !== null && <ReferenceLine key={limit.label} y={limit.value} stroke={limit.color} ifOverflow="extendDomain" label={{ value: `${limit.short} · ${number.format(limit.value)} ${unit}`, position: 'insideTopLeft', fill: limit.color, fontSize: 11 }} />)}
          {outlook && currentTime !== undefined && <ReferenceLine x={currentTime} stroke="#aeb9ca" strokeDasharray="3 4" label={{ value: 'Forecast starts', position: 'insideTopRight', fill: '#b3c2d7', fontSize: 11 }} />}
          {outlook && <Area type="linear" dataKey="range" name="Planning range" fill={colors.projection} fillOpacity={0.19} stroke="none" legendType="none" isAnimationActive={false} />}
          <Line type="linear" dataKey="reading" name="Recorded value" stroke={colors.reading} strokeWidth={2} dot={{ r: 2.7, fill: '#101d2f', strokeWidth: 1.5 }} isAnimationActive={false} />
          {outlook && <Line type="linear" dataKey="forecast" name="Projected trend" stroke={colors.projection} strokeWidth={2.5} strokeDasharray="7 5" dot={false} isAnimationActive={false} />}
          {inspectBy !== null && <ReferenceLine x={inspectBy} stroke={colors.baseline} strokeDasharray="3 4" label={{ value: 'Inspect by', position: 'insideBottomRight', fill: colors.baseline, fontSize: 11 }} />}
          {warningAt !== null && <ReferenceLine x={warningAt} stroke={colors.warning} strokeDasharray="3 4" />}
          {currentTime !== undefined && crossings.map(({ label, estimate, value: limit, color }) =>
            estimate?.estimated != null && limit !== null
              && <ReferenceDot key={label} x={currentTime + estimate.estimated * hourMs} y={limit} r={5} fill={color} stroke="#101d2f" />)}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="pdm-legend">
        <span className="pdm-reading">Recorded value ({unit})</span>
        {outlook && <><span className="pdm-projection">Projected trend</span><span className="pdm-range">Planning range</span></>}
        {limits.map(({ label, value: limit, className }) => limit !== null && <span key={label} className={className}>{label}</span>)}
        {inspectBy !== null && <span className="pdm-inspect">Suggested inspection</span>}
      </div>
    </div> : <p className="pdm-empty">No readings for this measurement point.</p>}
    <div className="pdm-foot">
      {status && <p>{status}</p>}
      {vdi && <p>VDI 3836:2012 · Group 3, {vdi.mount} mounting assumed for the demo. Warning is the operating ALARM from §5.1. Table 1 gives the zone boundaries used for review.</p>}
      {!vdi && !isThermal && <p>VDI 3836 requires a verified machine group, installation, measurement bands and operating conditions for imported data.</p>}
      {isThermal && <p>Airend housing temperature limits are project demo settings. Machine-specific limits require manufacturer or site data.</p>}
      <p>All times in ICT. Forecasts estimate threshold crossings for inspection planning.</p>
    </div>
  </section>
}
