import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { demoThermalLimits, vdiDemoLimits, type Measurement, type Settings } from './domain'
import { hourMs, makePdmDemo, pdmHistory, projectTrend, type PdmMetric } from './pdm'

const metrics = {
  bandA: { label: 'F01 · Band A velocity RMS', unit: 'mm/s' },
  bandB: { label: 'F02 · Band B velocity RMS', unit: 'mm/s' },
  temperature: { label: 'F14 · Bearing housing temperature', unit: '°C' },
} as const

const colors = { reading: '#36d4b0', projection: '#c2a6ff', warning: '#f5bc62', critical: '#ff8088' }
const dateTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const axis = { stroke: '#91a7bf', fontSize: 11, tickLine: false }
const tooltipStyle = { background: '#111d2d', border: '1px solid #314763', borderRadius: 8, color: '#e9f2fc' }

function duration(hours: number) {
  if (hours < 1) return `${Math.ceil(hours * 60)} min`
  if (hours < 48) return `${Math.round(hours)} h`
  return `${number.format(hours / 24)} days`
}

interface PdmTrendProps {
  data: Measurement[]
  latest: Measurement
  settings: Settings
}

export function PdmTrend({ data, latest, settings }: PdmTrendProps) {
  const [metric, setMetric] = useState<PdmMetric>('bandA')
  const [selectedPoint, setSelectedPoint] = useState<Measurement['point']>()
  const [showDemo, setShowDemo] = useState(false)
  const machineId = showDemo ? settings.machineId : latest.machineId
  const point = selectedPoint ?? latest.point
  const example = useMemo(() => showDemo ? makePdmDemo(settings, machineId) : null, [showDemo, settings, machineId])
  const { history, direction } = pdmHistory(example ?? data, machineId, point, metric)
  const recent = history.at(-1)
  const currentTime = recent?.[0]
  const current = recent?.[1]
  const value = current?.sensorStatus === 'Online' ? current[metric] : null
  const { unit } = metrics[metric]
  const isThermal = metric === 'temperature'
  const vdi = isThermal ? null : vdiDemoLimits(current, metric, settings)
  const thermal = isThermal ? demoThermalLimits(current, settings) : null
  const warning = (isThermal ? thermal?.warning : vdi?.alarm) ?? null
  const critical = (isThermal ? thermal?.critical : vdi?.zone2) ?? null
  const limits = [
    { label: isThermal ? 'Warning (project demo)' : 'VDI ALARM (demo baseline)', value: warning, color: colors.warning, className: 'pdm-warning' },
    { label: isThermal ? 'Critical (project demo)' : 'Zone II/III (critical review)', value: critical, color: colors.critical, className: 'pdm-critical' },
  ]
  const projection = projectTrend(history, metric)
  const outlook = critical !== null && value !== null && value < critical && 'slope' in projection ? projection : null
  const chartData: { time: number; reading: number | null; projected: number | null }[] = history.map(([time, row]) => ({
    time,
    reading: row.sensorStatus === 'Online' ? row[metric] : null,
    projected: outlook && time === currentTime ? value : null,
  }))

  const crossings = limits.map((limit) => {
    const reached = limit.value !== null && value !== null && value >= limit.value
    const hoursToLimit = outlook && value !== null && limit.value !== null ? (limit.value - value) / outlook.slope : 0
    const estimate = currentTime !== undefined && outlook && hoursToLimit > 0 && hoursToLimit <= outlook.horizonHours
      ? { hours: hoursToLimit, time: currentTime + hoursToLimit * hourMs }
      : null
    return { ...limit, reached, estimate }
  })

  if (outlook && value !== null && currentTime !== undefined) {
    chartData.push({
      time: currentTime + outlook.horizonHours * hourMs,
      reading: null,
      projected: value + outlook.slope * outlook.horizonHours,
    })
  }

  const firstTime = chartData[0]?.time ?? 0
  const lastTime = chartData.at(-1)?.time ?? firstTime
  const xDomain = firstTime === lastTime ? [firstTime - hourMs / 2, lastTime + hourMs / 2] : [firstTime, lastTime]
  const subtitle = showDemo ? 'Simulated degradation example' : current?.simulated ? 'Dashboard demo data' : current ? 'Imported CSV' : 'Dashboard data'
  const note = critical === null
    ? 'Thresholds unavailable for this data. The trend shows recorded values.'
    : outlook
      ? `Linear projection for up to ${duration(outlook.horizonHours)} if the recent trend continues.`
      : value !== null && value >= critical
        ? 'The latest reading has reached the highest review level.'
        : 'reason' in projection ? projection.reason : null

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
          <option value="P1">P1 · Drive side</option>
          <option value="P2">P2 · Opposite side</option>
        </select>
      </label>
    </div>
    <div className="pdm-readouts" aria-live="polite">
      <div>
        <span>Latest reading</span>
        <strong>{value === null ? 'Unavailable' : `${number.format(value)} ${unit}`}</strong>
        {currentTime !== undefined && <small>{dateTime.format(currentTime)}</small>}
      </div>
      {crossings.map(({ label, value: limit, color, reached, estimate }) => {
        const canCompare = limit !== null && value !== null
        const status = limit === null ? 'Not configured'
          : value === null ? 'Reading unavailable'
          : reached ? 'At or above threshold' : 'Below threshold'

        return <div key={label}>
          <span style={{ color }}>{label}{limit !== null && ` · ${number.format(limit)} ${unit}`}</span>
          <strong>{status}</strong>
          {canCompare && !reached && (
            estimate
              ? <small>Estimated in ~{duration(estimate.hours)} · {dateTime.format(estimate.time)}</small>
              : <small>{outlook ? 'Beyond the projection window' : 'No time estimate'}</small>
          )}
        </div>
      })}
    </div>
    {chartData.length ? <div className="pdm-chart">
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 3 }}>
          <CartesianGrid stroke="#26364d" strokeDasharray="3 4" vertical={false} />
          <XAxis {...axis} dataKey="time" type="number" scale="time" domain={xDomain} tickCount={5} minTickGap={30} tickFormatter={(time: number) => dateTime.format(time)} />
          <YAxis {...axis} domain={[0, 'auto']} width={38} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(time) => dateTime.format(Number(time))} formatter={(reading) => typeof reading === 'number' ? `${number.format(reading)} ${unit}` : reading} />
          {vdi && <ReferenceLine y={vdi.zone1} stroke="#72b3ef" strokeDasharray="4 4" ifOverflow="extendDomain" />}
          {limits.map((limit) => limit.value !== null && <ReferenceLine key={limit.label} y={limit.value} stroke={limit.color} strokeDasharray="4 4" ifOverflow="extendDomain" />)}
          <Line dataKey="reading" name="Recorded value" stroke={colors.reading} strokeWidth={2.5} dot={history.length === 1} isAnimationActive={false} />
          {outlook && <Line dataKey="projected" name="Projected trend" stroke={colors.projection} strokeWidth={2.5} strokeDasharray="8 5" dot={false} isAnimationActive={false} />}
          {crossings.map(({ label, estimate, value: limit, color }) => estimate && limit !== null && <ReferenceDot key={label} x={estimate.time} y={limit} r={4} fill={color} stroke="#101d2f" />)}
        </LineChart>
      </ResponsiveContainer>
      <div className="pdm-legend">
        <span className="pdm-reading">Recorded value ({unit})</span>
        {outlook && <span className="pdm-projection">Projected trend</span>}
        {vdi && <span className="pdm-zone">Zone I/II · {vdi.zone1} mm/s</span>}
        {limits.map(({ label, value: limit, className }) => limit !== null && <span key={label} className={className}>{label}</span>)}
      </div>
    </div> : <p className="pdm-empty">No readings for this measurement point.</p>}
    <div className="pdm-foot">
      {note && <p>{note}</p>}
      {vdi && <p>VDI 3836:2012 · Group 3, {vdi.mount} mounting assumed for the demo. Table 1 gives the zone boundaries. Section 5.1 uses the demo baseline of {vdi.baseline} mm/s at {point}. Zone II/III triggers project review. Switch-off settings require machine-specific verification.</p>}
      {!vdi && !isThermal && <p>VDI 3836 requires a verified machine group, installation, measurement bands and operating conditions for imported data.</p>}
      {isThermal && <p>Airend housing temperature limits are project demo settings. Machine-specific limits require manufacturer or site data.</p>}
      <p>Projected dates estimate threshold crossing. Failure date and remaining life are unavailable.</p>
    </div>
  </section>
}
