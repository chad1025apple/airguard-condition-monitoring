import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Activity, AlertTriangle, BellRing, BrainCircuit, Check, CircleHelp,
  ClipboardCheck, Cpu, Database, Download, Factory, FileUp, Gauge, GitBranch,
  Menu, RefreshCw, RotateCcw, Save, Settings2, ShieldAlert, SlidersHorizontal, Thermometer, Upload,
  Vibrate, Waves, X, Zap,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Cell, ComposedChart, Bar, BarChart, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  type AlertStatus, type AppAlert, type Measurement, type Settings, type Severity, type Status, type View,
  assessMeasurement, avgCurrent, csvHeaders, currentUnbalance, defaultSettings, demoThermalLimits, featureHeaders,
  legacyMetadataHeaders, measurementFeatures, presentationSpecs, standardGravity, windowMetadataHeaders,
  vdiDemoLimits, vibrationBaseline, vuf, type VibrationBand, type VdiMount,
} from './domain'
import { exportRow, makeDemoData, recentAlerts, simulateMeasurement, type PresentationScenario } from './demoData'
import { PdmTrend } from './PdmTrend'

const navItems: { id: View; label: string; icon: typeof Gauge }[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'vibration', label: 'Vibration Monitoring', icon: Vibrate },
  { id: 'electrical', label: 'Electrical Monitoring', icon: Zap },
  { id: 'temperature', label: 'Temperature Monitoring', icon: Thermometer },
  { id: 'diagnosis', label: 'Fault Diagnosis Support', icon: BrainCircuit },
  { id: 'ai', label: 'AI Anomaly Detection', icon: Activity },
  { id: 'dataset', label: 'Dataset Management', icon: Database },
  { id: 'alerts', label: 'Alert History', icon: BellRing },
  { id: 'settings', label: 'System Settings', icon: Settings2 },
]

const settingsKey = 'airguard-presentation-settings'
const presentationCases: { id: PresentationScenario; label: string; slide: number }[] = [
  { id: 'normal', label: 'Normal', slide: 19 },
  { id: 'warning', label: 'Warning', slide: 20 },
  { id: 'critical', label: 'Critical', slide: 21 },
]

const chartGrid = { stroke: '#26364d', strokeDasharray: '3 4' }
const axis = { stroke: '#8292aa', fontSize: 11 }
const statusClass: Record<Status, string> = {
  NORMAL: 'normal', WARNING: 'warning', 'HIGH ALERT': 'high', CRITICAL: 'critical', OFFLINE: 'offline', 'NOT CONFIGURED': 'offline',
}

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(settingsKey) ?? '{}') } as Settings
  } catch {
    return defaultSettings
  }
}

function formatTime(timestamp: string, compact = false) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', day: compact ? undefined : '2-digit', month: compact ? undefined : 'short',
  }).format(new Date(timestamp))
}

function severityClass(severity: Severity) {
  return severity.toLowerCase().replace(' ', '-')
}

function StatusBadge({ status, compact = false }: { status: Status; compact?: boolean }) {
  return <span className={`status-badge ${statusClass[status]} ${compact ? 'compact' : ''}`}><i />{status}</span>
}

function DemoBadge() {
  return <span className="demo-badge"><span />DEMO DATA</span>
}

function Card({ title, subtitle, action, children, className = '' }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>
    {(title || action) && <div className="panel-heading"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>}
    {children}
  </section>
}

function MetricCard({ label, value, unit, detail, tone = 'blue', icon }: { label: string; value: string | number; unit?: string; detail?: string; tone?: string; icon?: ReactNode }) {
  return <div className={`metric-card tone-${tone}`}>
    <div className="metric-top"><span>{label}</span>{icon}</div>
    <strong>{value}<small>{unit}</small></strong>
    {detail && <p>{detail}</p>}
  </div>
}

function ChartPanel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return <Card title={title} subtitle={subtitle} className={`chart-panel ${className}`}>{children}</Card>
}

function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="page-title"><div><span>{eyebrow}</span><h1>{title}</h1></div>{children}</div>
}

function RangeControl({ range, setRange }: { range: string; setRange: (range: string) => void }) {
  return <div className="range-control">{['1H', '24H', '7D'].map((item) => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>Last {item === '1H' ? '1 hour' : item === '24H' ? '24 hours' : '7 days'}</button>)}</div>
}

function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [measurements, setMeasurements] = useState<Measurement[]>(() => makeDemoData(settings.machineId))
  const [alerts, setAlerts] = useState<AppAlert[]>(() => recentAlerts(measurements, settings))
  const [view, setView] = useState<View>('overview')
  const [navOpen, setNavOpen] = useState(false)
  const [range, setRange] = useState('24H')
  const [notice, setNotice] = useState('')
  const [activeCase, setActiveCase] = useState<PresentationScenario | null>('normal')

  const latest = measurements.at(-1)!
  const assessment = assessMeasurement(latest, settings)
  const currentStatus = assessment.status
  const updateData = (data: Measurement[], nextSettings = settings) => {
    setMeasurements(data)
    setAlerts((old) => {
      const newAlerts = recentAlerts(data.slice(-48), nextSettings)
      const retained = old.filter((item) => !newAlerts.some((fresh) => fresh.id === item.id))
      return [...newAlerts, ...retained].slice(0, 40)
    })
  }
  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }
  const loadDemo = (scenario: PresentationScenario = 'normal') => {
    const data = makeDemoData(settings.machineId, scenario)
    setMeasurements(data)
    setAlerts(recentAlerts(data, settings))
    setActiveCase(scenario)
    const example = presentationCases.find(({ id }) => id === scenario)
    showNotice(`Slide ${example?.slide} · ${example?.label} demo loaded.`)
  }
  const simulate = (anomaly = false) => {
    if (!latest.vdiExample) return
    const next = simulateMeasurement(latest, settings, anomaly)
    updateData([...measurements.slice(-143), next])
    setActiveCase(null)
    showNotice(anomaly ? 'Anomaly measurement simulated.' : 'New 10-second measurement simulated.')
  }
  const saveSettings = (next: Settings) => {
    setSettings(next)
    localStorage.setItem(settingsKey, JSON.stringify(next))
    showNotice('System settings saved to local storage.')
  }

  const sharedProps = { data: measurements, latest, settings, range, setRange, goTo: setView }
  return <div className="app-shell">
    <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Waves size={21} /></div><div><strong>AirGuard</strong><span>CONDITION INTELLIGENCE</span></div><button className="mobile-close" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="machine-switcher"><span>ACTIVE ASSET</span><div className="machine-label"><Factory size={15} /><b>{latest.machineId}</b></div></div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setNavOpen(false) }}><Icon size={18} /><span>{label}</span>{id === 'diagnosis' && currentStatus !== 'NORMAL' && <i className="nav-alert" />}</button>)}</nav>
      <div className="sidebar-foot"><DemoBadge /><small>Prototype v0.1 · 10 s window</small></div>
    </aside>
    {navOpen && <button className="backdrop" onClick={() => setNavOpen(false)} aria-label="Close navigation" />}
    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setNavOpen(true)} aria-label="Open navigation"><Menu /></button><div className="breadcrumb">Operations <span>/</span> <b>{navItems.find((item) => item.id === view)?.label}</b></div><div className="header-actions"><span className="update-time">Last update <b>{formatTime(latest.timestamp)}</b></span><button className="icon-button" title="Load normal demo data" onClick={() => loadDemo()}><RefreshCw size={17} /></button><button className="profile" title="Engineer session">ME</button></div></header>
      <div className="content">
        {notice && <div className="toast"><Check size={17} />{notice}</div>}
        {view === 'overview' && <Overview {...sharedProps} assessment={assessment} activeCase={activeCase} onLoadCase={loadDemo} onSimulate={simulate} />}
        {view === 'vibration' && <Vibration {...sharedProps} />}
        {view === 'electrical' && <Electrical {...sharedProps} />}
        {view === 'temperature' && <Temperature {...sharedProps} />}
        {view === 'diagnosis' && <Diagnosis {...sharedProps} />}
        {view === 'ai' && <AiDetection {...sharedProps} />}
        {view === 'dataset' && <Dataset measurements={measurements} onImport={(next) => { setMeasurements(next); setAlerts([]); setActiveCase(null); showNotice(`${next.length} valid dataset rows imported for this session.`) }} />}
        {view === 'alerts' && <Alerts alerts={alerts} setAlerts={setAlerts} />}
        {view === 'settings' && <SettingsPage value={settings} onSave={saveSettings} />}
      </div>
      <footer className="app-footer"><span>AirGuard Condition Intelligence · Decision support only</span><span>Engineering rules, AI anomaly detection and diagnosis are displayed separately.</span></footer>
    </main>
  </div>
}

function Overview({ data, latest, settings, range, setRange, goTo, assessment, activeCase, onLoadCase, onSimulate }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void; goTo: (view: View) => void; assessment: ReturnType<typeof assessMeasurement>; activeCase: PresentationScenario | null; onLoadCase: (scenario: PresentationScenario) => void; onSimulate: (anomaly?: boolean) => void }) {
  const { status: currentStatus, findings } = assessment
  const voltageUnbalance = vuf(latest)
  const phaseCurrentUnbalance = currentUnbalance(latest)
  const thermal = demoThermalLimits(latest, settings)
  const demoAnomaly = latest.vdiExample && latest.anomalyScore >= settings.anomalyThreshold
  const trend = data.slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true), current: avgCurrent(m), vuf: vuf(m) }))
  return <>
    <PageTitle eyebrow="LIVE ASSET OVERVIEW" title="Screw Airend condition at a glance"><div className="page-actions"><button className="outline-button" disabled={!latest.vdiExample} onClick={() => onSimulate()}><RefreshCw size={16} />Simulate measurement</button><button className="primary-button" disabled={!latest.vdiExample} onClick={() => onSimulate(true)}><AlertTriangle size={16} />Simulate anomaly</button></div></PageTitle>
    <div className="presentation-cases">
      <div><strong>Presentation examples</strong><span>Slides 19–21 · fixed demo readings</span></div>
      <div className="segment" role="group" aria-label="Presentation examples">
        {presentationCases.map(({ id, label, slide }) => <button key={id} type="button" className={activeCase === id ? 'active' : ''} aria-pressed={activeCase === id} onClick={() => onLoadCase(id)}>{label} <small>· Slide {slide}</small></button>)}
      </div>
    </div>
    <div className="asset-strip"><div className="asset-icon"><Cpu /></div><div className="asset-main"><span>Machine</span><strong>{latest.vdiExample ? settings.machineName : latest.machineId}</strong><small>{latest.vdiExample ? `${settings.machineId} · Oil-injected twin-screw demo` : 'Imported dataset'}</small></div><div><span>Motor rating</span><b>{latest.vdiExample ? `${settings.ratedPower} kW` : 'Unverified'}</b></div><div><span>Operating RPM</span><b>{latest.rpm.toLocaleString()} rpm</b>{latest.vdiExample && <small>Nominal {settings.ratedRpm.toLocaleString()} rpm</small>}</div><div><span>Load</span><b>{latest.load}%</b></div><div><span>Discharge pressure</span><b>{latest.pressure} bar(g)</b>{latest.vdiExample && <small>FAD {presentationSpecs.freeAirDelivery} m³/min</small>}</div><div className="asset-status"><span>Operating status</span><StatusBadge status={currentStatus} /></div></div>
    <div className="assessment-banner">
      <div className={`status-orb ${statusClass[currentStatus]}`}><Activity /></div>
      <div className="assessment-result">
        <span>COMPOSITE MACHINE STATUS</span>
        <h2>{currentStatus}</h2>
        {currentStatus === 'NORMAL' && <p>All readings are below their configured thresholds.</p>}
        {currentStatus === 'OFFLINE' && <p>The latest measurement reports an offline sensor.</p>}
        {currentStatus === 'NOT CONFIGURED' && <p>{latest.vdiExample ? 'Check the demo profile, baselines and alarm settings.' : 'Imported readings require verified machine and alarm settings.'}</p>}
        {findings.length > 0 && <ul className="assessment-findings" aria-label="Active alarm triggers">
          {findings.map(({ label, value, unit, limit, level }) => <li key={label}>
            <b>{label}</b> {Number(value.toFixed(2))}{unit} · {label.startsWith('Band') ? (level === 'CRITICAL' ? 'Zone II/III boundary' : 'VDI demo ALARM') : level === 'CRITICAL' ? 'Critical' : 'Warning'} at {limit}{unit}
          </li>)}
        </ul>}
      </div>
      <div className="assessment-source"><span>Evaluation source</span><b>{latest.vdiExample ? 'VDI example + project demo rules' : 'Imported readings'}</b><small>Not an automatic shutdown decision</small></div>
      <button onClick={() => goTo('diagnosis')}>View diagnostic evidence <GitBranch size={15} /></button>
    </div>
    <section className="section-title"><div><span>KEY PARAMETERS</span><h2>{latest.vdiExample ? 'Current 10-second demo window' : 'Latest imported measurement'}</h2></div>{latest.vdiExample && <DemoBadge />}</section>
    <div className="metric-grid four">
      <MetricCard label="Band A velocity RMS" value={latest.bandA} unit=" mm/s" detail={latest.vdiExample ? `${latest.point} · demo baseline ${vibrationBaseline(latest.point, 'bandA', settings)} mm/s` : latest.point} tone={findings.some(({ key }) => key === 'bandA') ? 'amber' : 'green'} icon={<Vibrate size={18} />} />
      <MetricCard label="Band B velocity RMS" value={latest.bandB} unit=" mm/s" detail={latest.vdiExample ? `${latest.point} · demo baseline ${vibrationBaseline(latest.point, 'bandB', settings)} mm/s` : latest.point} tone={findings.some(({ key }) => key === 'bandB') ? 'amber' : 'green'} icon={<Waves size={18} />} />
      <MetricCard label="Average 3-phase current" value={avgCurrent(latest).toFixed(1)} unit=" A" detail={phaseCurrentUnbalance === null ? 'Unbalance unavailable' : `Unbalance ${phaseCurrentUnbalance.toFixed(2)}%`} tone="blue" icon={<Zap size={18} />} />
      <MetricCard label="Bearing housing temperature" value={latest.temperature} unit=" °C" detail={thermal ? `Demo warning at ${thermal.warning} °C` : 'Limits not configured'} tone={findings.some(({ key }) => key === 'temperature') ? 'amber' : 'green'} icon={<Thermometer size={18} />} />
      <MetricCard label="Acceleration RMS" value={latest.acceleration} unit=" m/s²" detail={`Crest factor ${latest.crestFactor}`} tone="blue" icon={<Activity size={18} />} />
      <MetricCard label="Voltage unbalance factor" value={voltageUnbalance?.toFixed(2) ?? 'Unavailable'} unit={voltageUnbalance === null ? undefined : ' %'} detail={latest.vdiExample ? `Project demo warning at ${settings.vufWarning}%` : 'Reported in CSV · method unverified'} tone={findings.some(({ key }) => key === 'vuf') ? 'amber' : 'green'} icon={<Zap size={18} />} />
      <MetricCard label="Isolation Forest score" value={latest.vdiExample ? latest.anomalyScore.toFixed(2) : 'Unavailable'} detail={latest.vdiExample ? `Demo threshold ${settings.anomalyThreshold} · ${demoAnomaly ? 'ANOMALY' : 'NORMAL'}` : 'No model run on imported data'} tone={demoAnomaly ? 'amber' : 'purple'} icon={<BrainCircuit size={18} />} />
      <MetricCard label="Data quality" value={latest.sensorStatus === 'Online' ? 'ONLINE' : 'OFFLINE'} detail={`${latest.point} sensor status`} tone="green" icon={<ClipboardCheck size={18} />} />
    </div>
    <PdmTrend data={data} latest={latest} settings={settings} />
    <div className="section-title charts-title"><div><span>TREND ANALYSIS</span><h2>Condition trend</h2></div><RangeControl range={range} setRange={setRange} /></div>
    <div className="chart-grid two">
      <ChartPanel title="Vibration velocity trend" subtitle="Band A / Band B · mm/s RMS"><ResponsiveContainer width="100%" height={250}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} tickLine={false} /><YAxis {...axis} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="bandA" name="Band A" stroke="#28c9a3" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="bandB" name="Band B" stroke="#f3b450" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Electrical & thermal trend" subtitle="Current (A), VUF (%) and bearing housing (°C)"><ResponsiveContainer width="100%" height={250}><ComposedChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} tickLine={false} /><YAxis {...axis} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="current" name="Current" stroke="#54a8ff" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="temperature" name="Temperature" stroke="#ee7d5c" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="vuf" name="VUF" stroke="#ad8cff" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></ChartPanel>
      {latest.vdiExample && <ChartPanel title="Anomaly score trend" subtitle="Isolation Forest demo output — not failure probability"><ResponsiveContainer width="100%" height={235}><AreaChart data={trend}><defs><linearGradient id="scoreGradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#9b7fff" stopOpacity={.45} /><stop offset="1" stopColor="#9b7fff" stopOpacity={0} /></linearGradient></defs><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} tickLine={false} /><YAxis domain={[0, 1]} {...axis} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="anomalyScore" name="Anomaly score" stroke="#aa8bff" fill="url(#scoreGradient)" strokeWidth={2} /></AreaChart></ResponsiveContainer></ChartPanel>}
      <Card title="Active evaluation notes" subtitle="Clear separation of signals and assessment"><div className="note-list"><div><i className="green-dot" /><span>Engineering rules</span><b>{findings.some(({ key }) => key !== 'anomaly') ? 'Review recorded threshold crossings' : latest.vdiExample ? 'No recorded engineering alarm' : 'Machine criteria not configured'}</b></div><div><i className="purple-dot" /><span>AI anomaly detection</span><b>{latest.vdiExample ? demoAnomaly ? 'Demo score above threshold' : 'Demo score below threshold' : 'No model run on imported data'}</b></div><div><i className="blue-dot" /><span>Diagnosis support</span><b>{findings.some(({ key }) => key !== 'anomaly') ? 'Review engineering evidence' : 'Insufficient engineering evidence'}</b></div></div><button className="text-button" onClick={() => goTo('ai')}>Open AI anomaly analysis →</button></Card>
    </div>
  </>
}

function Vibration({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const [point, setPoint] = useState<'ALL' | 'P1' | 'P2'>('ALL')
  const filtered = (point === 'ALL' ? data : data.filter((m) => m.point === point)).slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true) }))
  const p1 = data.filter((m) => m.machineId === latest.machineId && m.point === 'P1').at(-1)
  const p2 = data.filter((m) => m.machineId === latest.machineId && m.point === 'P2').at(-1)
  const spectrum = Array.from({ length: 34 }, (_, index) => ({ frequency: index * 12, amplitude: Number((0.12 + Math.abs(Math.sin(index * 0.46)) * .55 + (index === 8 ? .65 : 0) + (index === 16 ? .38 : 0)).toFixed(2)), envelope: Number((0.05 + Math.abs(Math.cos(index * .35)) * .2 + (index === 18 ? .42 : 0)).toFixed(2)) }))
  const features = measurementFeatures(latest).slice(0, 10)
  const waveform = Array.from({ length: 64 }, (_, index) => {
    const t = index * 2
    const acceleration = latest.acceleration * (0.85 * Math.sin(t / 4) + 0.28 * Math.sin(t / 1.9))
    return { t, acceleration: Number(acceleration.toFixed(2)) }
  })
  return <>
    <PageTitle eyebrow="AIR END / VIBRATION" title="Vibration monitoring"><div className="page-actions"><RangeControl range={range} setRange={setRange} /></div></PageTitle>
    <div className="toolbar"><div className="segment"><span>Measurement point</span>{(['ALL', 'P1', 'P2'] as const).map((item) => <button key={item} onClick={() => setPoint(item)} className={point === item ? 'active' : ''}>{item === 'ALL' ? 'All points' : item}</button>)}</div><span className="info-copy">Velocity values are RMS. Trend data shown is simulated.</span></div>
    <div className="vibration-layout">
      <Card title="Screw airend measurement points" subtitle="Slides 10–11 · piezoelectric accelerometers on the bearing housings" className="airend-card"><AirendDiagram active={point} /><div className="diagram-key"><span><i className="point p1" />P1 · DE (drive end)</span><span><i className="point p2" />P2 · NDE (non-drive end)</span></div></Card>
      <Card title="VDI 3836 demonstration" subtitle="Group 3 · screw airend without timing gears">
        <p className="disclaimer">{latest.vdiExample ? `The example assumes ${settings.vdiMount} mounting, radial housing readings and steady operation.` : 'Imported features are shown as recorded. Applicability of VDI 3836 is unverified.'}</p>
        <p className="disclaimer">Band A must capture at least the third harmonic of the discharge frequency with an upper cutoff of at least 1 kHz. For this screw compressor, Band B spans 10 Hz to 2.2× rotor speed in Hz. See VDI 3836 §2.1.</p>
      </Card>
    </div>
    <div className="chart-grid two"><ChartPanel title="Overall vibration trend" subtitle="Velocity RMS, selected measurement point"><ResponsiveContainer width="100%" height={250}><LineChart data={filtered}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="bandA" name="Band A" stroke="#29c9a3" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="bandB" name="Band B" stroke="#f3b450" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartPanel><ChartPanel title="P1 vs P2 comparison" subtitle="Most recent window"><ResponsiveContainer width="100%" height={250}><BarChart data={[{ point: 'P1', bandA: p1?.bandA, bandB: p1?.bandB }, { point: 'P2', bandA: p2?.bandA, bandB: p2?.bandB }]}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="point" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="bandA" name="Band A" fill="#27c8a1" radius={[4, 4, 0, 0]} /><Bar dataKey="bandB" name="Band B" fill="#f4b352" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel>{latest.vdiExample && <><ChartPanel title="Acceleration waveform" subtitle="Illustrative time waveform · m/s²"><ResponsiveContainer width="100%" height={250}><LineChart data={waveform}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="t" {...axis} unit=" ms" /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="acceleration" name="Acceleration (m/s²)" stroke="#55a9ff" dot={false} /></LineChart></ResponsiveContainer></ChartPanel><ChartPanel title="FFT spectrum — demo" subtitle="Illustrative spectrum · separate from demo band values"><ResponsiveContainer width="100%" height={250}><BarChart data={spectrum}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="frequency" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="amplitude" name="Amplitude" fill="#51a8ff" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Envelope spectrum — demo" subtitle="For engineer review; not an automatic bearing diagnosis"><ResponsiveContainer width="100%" height={250}><BarChart data={spectrum}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="frequency" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="envelope" name="Envelope" fill="#b28cff" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel></>}</div>
    <Card title="Vibration features F01–F10" subtitle="Slides 12–13 · model input units"><FeatureValues features={features} /></Card>
    <VdiAssessment readings={[p1, p2]} settings={settings} />
  </>
}

function VdiAssessment({ readings, settings }: { readings: (Measurement | undefined)[]; settings: Settings }) {
  const rows = readings.flatMap((measurement, index) =>
    (['bandA', 'bandB'] as const).map((band: VibrationBand) => {
      const limits = vdiDemoLimits(measurement, band, settings)
      const value = measurement?.sensorStatus === 'Online' ? measurement[band] : undefined
      const zone = limits && value !== undefined
        ? value >= limits.zone2 ? 'Zone III' : value >= limits.zone1 ? 'Zone II' : 'Zone I'
        : 'Not evaluated'
      return { id: `P${index + 1} · ${band === 'bandA' ? 'Band A' : 'Band B'}`, value, limits, zone }
    }),
  )
  return <Card title="VDI 3836 vibration assessment" subtitle="Table 1 zone boundaries and §5.1 operating ALARM · mm/s RMS">
    <div className="table-wrap">
      <table>
        <thead><tr><th scope="col">Point and band</th><th scope="col">Reading</th><th scope="col">Demo baseline</th><th scope="col">Zone I/II</th><th scope="col">Zone II/III</th><th scope="col">ALARM</th><th scope="col">Zone</th></tr></thead>
        <tbody>{rows.map(({ id, value, limits, zone }) => <tr key={id}>
          <th scope="row">{id}</th><td>{value ?? '—'}</td><td>{limits?.baseline ?? '—'}</td>
          <td>{limits?.zone1 ?? '—'}</td><td>{limits?.zone2 ?? '—'}</td>
          <td>{limits?.alarm?.toFixed(2) ?? '—'}</td><td>{zone}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="disclaimer">ALARM uses the demo baseline at each point plus 25% of the Zone I upper boundary, capped at 125% of that boundary. The demo requires a healthy baseline below the Zone I boundary. Zone III triggers critical review in this project. Switch-off remains unconfigured under §5.2.</p>
  </Card>
}

function AirendDiagram({ active }: { active: 'ALL' | 'P1' | 'P2' }) {
  return <svg className="airend-diagram" viewBox="0 0 520 190" role="img" aria-label="Illustrative twin screw airend diagram with P1 and P2 measurement points"><defs><linearGradient id="body" x1="0" x2="1"><stop stopColor="#263950" /><stop offset=".5" stopColor="#405973" /><stop offset="1" stopColor="#27394f" /></linearGradient></defs><rect x="78" y="56" width="365" height="80" rx="38" fill="url(#body)" stroke="#6f8baa" strokeWidth="2" /><rect x="137" y="68" width="230" height="56" rx="27" fill="#17283b" stroke="#7292b4" /><path d="M158 96c17-28 36 28 54 0s37-28 55 0 37 28 55 0 37-28 55 0" fill="none" stroke="#62c7dc" strokeWidth="7" strokeLinecap="round" /><path d="M158 106c17-28 36 28 54 0s37-28 55 0 37 28 55 0 37-28 55 0" fill="none" stroke="#d2a654" strokeWidth="7" strokeLinecap="round" /><circle cx="93" cy="96" r="33" fill="#17263a" stroke="#7795b3" strokeWidth="3" /><circle cx="428" cy="96" r="33" fill="#17263a" stroke="#7795b3" strokeWidth="3" /><rect x="38" y="78" width="28" height="36" rx="4" fill="#324a64" /><rect x="454" y="78" width="28" height="36" rx="4" fill="#324a64" /><line x1="96" y1="48" x2="96" y2="19" stroke="#34d6ae" strokeWidth="2" /><circle cx="96" cy="54" r="8" fill={active === 'P2' ? '#42536a' : '#34d6ae'} /><text x="72" y="16" fill="#d7e6f7" fontSize="14" fontWeight="700">P1</text><text x="36" y="170" fill="#8fa4bd" fontSize="12">Drive / input side</text><line x1="426" y1="48" x2="426" y2="19" stroke="#f5b454" strokeWidth="2" /><circle cx="426" cy="54" r="8" fill={active === 'P1' ? '#42536a' : '#f5b454'} /><text x="402" y="16" fill="#d7e6f7" fontSize="14" fontWeight="700">P2</text><text x="387" y="170" fill="#8fa4bd" fontSize="12">Opposite side</text></svg>
}

function FeatureValues({ features }: { features: ReturnType<typeof measurementFeatures> }) {
  return <div className="feature-grid">{features.map(({ code, label, value, unit }) => <div key={code}>
    <span>{code}</span><p>{label}</p>
    <strong>{value === null ? '—' : value.toFixed(2)} {value !== null && <small>{unit}</small>}</strong>
  </div>)}</div>
}

function formatPercent(value: number | null) {
  return value === null ? 'Unavailable' : `${value.toFixed(2)}%`
}

function Electrical({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const trend = data.filter((m) => m.machineId === latest.machineId).slice(-48)
    .map((m) => ({ time: formatTime(m.timestamp, true), vuf: vuf(m), currentUnbalance: currentUnbalance(m) }))
  const voltage = vuf(latest)
  const current = currentUnbalance(latest)
  const phaseData = [
    { phase: 'AB / A', Voltage: latest.voltageA, Current: latest.currentA },
    { phase: 'BC / B', Voltage: latest.voltageB, Current: latest.currentB },
    { phase: 'CA / C', Voltage: latest.voltageC, Current: latest.currentC },
  ]

  return <>
    <PageTitle eyebrow="DRIVE MOTOR / ELECTRICAL" title="P3 · Motor terminal box"><RangeControl range={range} setRange={setRange} /></PageTitle>
    <div className="callout"><CircleHelp size={18} /><p>
      {latest.csvElectrical
        ? 'F11–F13 come from the imported CSV. Per-phase readings and the VUF calculation method are unavailable.'
        : 'P3 monitors the motor supply using CTs and voltage transducers. Demo VUF is the negative-to-positive sequence ratio from line-to-line RMS voltages (IEC 60034-26:2006 §4 and Annex A).'}
    </p></div>
    <div className="metric-grid three">
      <MetricCard label="Average 3-phase current" value={avgCurrent(latest).toFixed(1)} unit=" A" detail="RMS" tone="blue" />
      <MetricCard label="Voltage unbalance factor" value={formatPercent(voltage)} detail={latest.vdiExample ? `Project demo review at ${settings.vufWarning}%` : 'CSV value · method unverified'} tone="blue" />
      <MetricCard label="Current unbalance" value={formatPercent(current)} detail={latest.vdiExample ? `Project demo review at ${settings.currentUnbalanceWarning}%` : 'CSV value · method unverified'} tone="blue" />
    </div>
    <div className="chart-grid two sensor-chart-grid">
      {latest.vdiExample && <>
        <ChartPanel title="Line-to-line voltage" subtitle="AB / BC / CA · V RMS">
          <ResponsiveContainer width="100%" height={250}><BarChart data={phaseData}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="phase" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="Voltage" fill="#55a9ff" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Phase current" subtitle="A / B / C · A RMS">
          <ResponsiveContainer width="100%" height={250}><BarChart data={phaseData}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="phase" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="Current" fill="#27c9a2" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartPanel>
      </>}
      <ChartPanel title="Voltage unbalance trend" subtitle={latest.csvElectrical ? 'VUF as reported in CSV' : 'Sequence voltage ratio (%)'}>
        <ResponsiveContainer width="100%" height={250}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="vuf" name="VUF %" stroke="#ad8cff" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Current unbalance trend" subtitle={latest.csvElectrical ? 'Current unbalance as reported in CSV' : 'Maximum phase deviation / average current (%)'}>
        <ResponsiveContainer width="100%" height={250}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="currentUnbalance" name="Current unbalance %" stroke="#f4b352" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </ChartPanel>
    </div>
    <p className="disclaimer">IEC 60034-26 describes the effect of unbalanced supply voltage on the motor. IEC 60034-1 addresses motor rating and performance. The project demo limits are review settings for this interface.</p>
  </>
}

function Temperature({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const limits = demoThermalLimits(latest, settings)
  const trend = data.filter((m) => m.machineId === latest.machineId && m.point === latest.point).slice(-48)
    .map((m) => ({ time: formatTime(m.timestamp, true), temperature: m.sensorStatus === 'Online' ? m.temperature : null, warning: limits?.warning, critical: limits?.critical }))
  const status: Status = latest.sensorStatus === 'Offline' ? 'OFFLINE'
    : !limits ? 'NOT CONFIGURED'
    : latest.temperature >= limits.critical ? 'CRITICAL'
    : latest.temperature >= limits.warning ? 'WARNING' : 'NORMAL'

  return <>
    <PageTitle eyebrow="AIR END / THERMAL" title="Temperature monitoring"><RangeControl range={range} setRange={setRange} /></PageTitle>
    <div className="temperature-hero">
      <div className="thermo-visual"><div className="thermo-tube"><i style={{ height: `${Math.min(90, Math.max(0, latest.temperature / 105 * 100))}%` }} /></div><span>°C</span></div>
      <div>
        <span>AIREND HOUSING · {latest.point}</span><h2>Housing temperature near bearing</h2>
        <p>F14 is measured on the airend housing near the bearing. The slide illustration shows the sensor near P2 (NDE). Temperature limits need machine-specific confirmation.</p>
        {limits && <div className="threshold-row"><div><span>Project demo warning</span><b>{limits.warning} °C</b></div><div><span>Project demo critical</span><b>{limits.critical} °C</b></div></div>}
      </div>
      <div className="temperature-status"><span>Current temperature</span><strong>{latest.sensorStatus === 'Online' ? latest.temperature : '—'}<small>°C</small></strong><StatusBadge status={status} /></div>
    </div>
    <ChartPanel title="Bearing housing temperature trend" subtitle={limits ? 'Project demo limits · °C' : 'Recorded readings · limits not configured'}>
      <ResponsiveContainer width="100%" height={270}><LineChart data={trend}>
        <CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend />
        <Line dataKey="temperature" name="Housing temperature" stroke="#ed7e5d" strokeWidth={2.5} dot={false} />
        {limits && <Line dataKey="warning" name="Warning (demo)" stroke="#f4b352" strokeDasharray="4 4" dot={false} />}
        {limits && <Line dataKey="critical" name="Critical (demo)" stroke="#ef5c66" strokeDasharray="4 4" dot={false} />}
      </LineChart></ResponsiveContainer>
    </ChartPanel>
  </>
}

function Diagnosis({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const { findings } = assessMeasurement(latest, settings)
  const engineering = findings.filter(({ key }) => key !== 'anomaly')
  const anomaly = findings.find(({ key }) => key === 'anomaly')
  const trend = data.filter((m) => m.machineId === latest.machineId && m.point === latest.point).slice(-48)
    .map((m) => ({ ...m, time: formatTime(m.timestamp, true) }))
  const hasVibration = engineering.some(({ key }) => key === 'bandA' || key === 'bandB')
  const hasHeat = engineering.some(({ key }) => key === 'temperature')
  const hasElectrical = engineering.some(({ key }) => key === 'vuf' || key === 'currentUnbalance')

  return <>
    <PageTitle eyebrow="DECISION SUPPORT" title="Fault diagnosis support"><RangeControl range={range} setRange={setRange} /></PageTitle>
    <div className="preliminary"><ShieldAlert /><div><strong>ENGINEER VERIFICATION REQUIRED</strong><span>Use the measured signals, operating conditions and inspection history to check possible causes. ISO 13373-3 and ISO 13379-1 provide diagnostic guidance.</span></div></div>
    <div className="diagnosis-sequence" aria-label="Diagnosis workflow">
      <span>Validate anomaly</span><span>Fault candidates</span><span>Evidence report</span><span>Human verification</span>
    </div>
    <div className="diagnosis-grid">
      <Card title="Engineering evidence" subtitle={latest.vdiExample ? 'Latest demo window' : 'Machine criteria not configured'}>
        {engineering.length ? engineering.map(({ key, label, value, limit, unit, level }) => <div key={key} className="evidence-item active">
          <AlertTriangle size={17} /><div><b>{label}</b><span>{Number(value.toFixed(2))}{unit} · review threshold {limit}{unit}</span></div><em>{level}</em>
        </div>) : <p className="disclaimer">{latest.vdiExample ? 'No configured engineering limit was reached.' : 'Verify the machine configuration and measurements before evaluating alarm evidence.'}</p>}
        {anomaly && <p className="disclaimer">Demo anomaly score {anomaly.value.toFixed(2)} exceeded {anomaly.limit}. Use it to flag a window for review.</p>}
      </Card>
      <Card title="Suggested inspection">
        <ul className="inspection-list">
          {hasVibration && <li>Repeat P1/P2 measurements at comparable speed and load, and check frequency components and sensor mounting.</li>}
          {hasHeat && <li>Check ambient temperature, cooling and lubrication against the equipment manual.</li>}
          {hasElectrical && <li>Verify supply voltages and phase currents before inspecting the motor.</li>}
          {engineering.length === 0 && <li>Continue trending and collect more evidence before assigning a fault cause.</li>}
          {engineering.length > 0 && <li>Record the engineering findings and confirm any fault with a targeted inspection.</li>}
        </ul>
      </Card>
      <ChartPanel title="Band B vibration" subtitle="Selected point · mm/s RMS">
        <ResponsiveContainer width="100%" height={240}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="bandB" name="Band B" stroke="#f4b352" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </ChartPanel>
      <ChartPanel title="Envelope RMS" subtitle="Supporting feature · m/s²">
        <ResponsiveContainer width="100%" height={240}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="envelopeRms" name="Envelope RMS" stroke="#ae8dff" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
      </ChartPanel>
    </div>
    <Card title="Candidate signatures to verify" subtitle="Slide 18 · compare signatures and inspect before assigning a cause" className="sensor-chart-grid">
      <div className="table-wrap"><table>
        <thead><tr><th>Evidence pattern</th><th>Possible candidate</th><th>Verification</th></tr></thead>
        <tbody>
          <tr><td>Dominant FFT 1×</td><td>Unbalance</td><td>Phase, direction, load and rotor</td></tr>
          <tr><td>FFT 1× / 2× with axial response</td><td>Misalignment</td><td>Alignment and coupling</td></tr>
          <tr><td>Multiple harmonics</td><td>Looseness</td><td>Mounting bolts, base and clearance</td></tr>
          <tr><td>Envelope peaks at bearing frequencies</td><td>Bearing defect</td><td>RPM, bearing geometry, harmonics and repeat measurements</td></tr>
        </tbody>
      </table></div>
    </Card>
    <p className="disclaimer">CBM uses changes from baseline to decide when to inspect. PdM uses consistent trends and evidence to plan work. After maintenance, measure again and record the result against the baseline.</p>
  </>
}

function AiDetection({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  if (!latest.vdiExample) return <><PageTitle eyebrow="UNSUPERVISED ML / DEMO" title="AI anomaly detection" /><Card title="Model unavailable for imported data"><p className="disclaimer">This prototype displays simulated Isolation Forest scores for the built-in demo. A trained and validated model is required for CSV readings.</p></Card></>
  const trend = data.slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true), current: avgCurrent(m) }))
  const distribution = [{ name: 'Normal', value: data.filter((m) => m.anomalyScore < settings.anomalyThreshold).length }, { name: 'Anomaly', value: data.filter((m) => m.anomalyScore >= settings.anomalyThreshold).length }]
  const recentAnomalies = data.filter((m) => m.anomalyScore >= settings.anomalyThreshold).slice(-5).reverse()
  return <><PageTitle eyebrow="UNSUPERVISED ML / DEMO" title="AI anomaly detection"><RangeControl range={range} setRange={setRange} /></PageTitle><div className="ai-notice"><BrainCircuit /><div><b>DEMO MODE — Isolation Forest is not connected or trained in this prototype.</b><span>Scores are realistic mock values for interface testing. They are not failure probabilities, RUL estimates, or a direct cause diagnosis.</span></div><span className="model-chip">{settings.modelVersion}</span></div><div className="metric-grid three"><MetricCard label="Anomaly score" value={latest.anomalyScore.toFixed(2)} detail="Mock Isolation Forest output" tone="purple" icon={<Activity size={18} />} /><MetricCard label="Detection threshold" value={settings.anomalyThreshold.toFixed(2)} detail="Project-configurable demo threshold" tone="blue" icon={<SlidersHorizontal size={18} />} /><MetricCard label="Demo classification" value={latest.anomalyScore >= settings.anomalyThreshold ? 'ANOMALY' : 'NORMAL'} detail={`Operating: ${latest.load}% load · ${latest.rpm} rpm`} tone={latest.anomalyScore >= settings.anomalyThreshold ? 'amber' : 'green'} icon={<BrainCircuit size={18} />} /></div><div className="ai-workflow"><span>14 features</span><i>→</i><span>Isolation Trees</span><i>→</i><span>Anomaly score</span><i>→</i><span>Threshold comparison</span><i>→</i><b>{latest.anomalyScore >= settings.anomalyThreshold ? 'ANOMALY' : 'NORMAL'}</b></div><div className="chart-grid two"><ChartPanel title="Anomaly score trend" subtitle="Threshold line is project-configured"><ResponsiveContainer width="100%" height={255}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis domain={[0, 1]} {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="anomalyScore" name="Score" stroke="#aa8bff" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey={() => settings.anomalyThreshold} name="Threshold" stroke="#f4b352" strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer></ChartPanel><ChartPanel title="Normal / anomaly distribution" subtitle="Selected demo data"><ResponsiveContainer width="100%" height={255}><PieChart><Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>{distribution.map((entry) => <Cell key={entry.name} fill={entry.name === 'Normal' ? '#28c9a3' : '#ef6a6a'} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend /></PieChart></ResponsiveContainer></ChartPanel><ChartPanel title="F01 versus F11" subtitle="Band A velocity RMS vs average 3-phase current"><ResponsiveContainer width="100%" height={255}><ScatterChart><CartesianGrid {...chartGrid} /><XAxis type="number" dataKey="bandA" name="F01" {...axis} /><YAxis type="number" dataKey="current" name="F11" {...axis} /><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} /><Legend /><Scatter name="Demo normal" data={trend.filter((m) => m.anomalyScore < settings.anomalyThreshold)} fill="#36d4b0" /><Scatter name="Demo anomaly" data={trend.filter((m) => m.anomalyScore >= settings.anomalyThreshold)} fill="#ff8088" /></ScatterChart></ResponsiveContainer></ChartPanel><Card title="Model input · F01–F14" subtitle="One row per window · 1 × 14"><FeatureValues features={measurementFeatures(latest)} /></Card></div><Card title="Recent anomaly events" subtitle="Demo-score events requiring further inspection"><div className="mini-table"><div><span>Timestamp</span><span>Score</span><span>Operating condition</span><span>Result</span></div>{recentAnomalies.length ? recentAnomalies.map((item) => <div key={item.id}><span>{formatTime(item.timestamp)}</span><b>{item.anomalyScore.toFixed(2)}</b><span>{item.load}% load · {item.rpm} rpm</span><StatusBadge compact status="WARNING" /></div>) : <p>No demo anomaly events in the selected dataset.</p>}</div><p className="disclaimer">A healthy baseline dataset, train/validation/test split and false-alarm evaluation are required before a real model can be claimed.</p></Card>
    <div className="chart-grid two sensor-chart-grid">
      <Card title="Isolation Forest example" subtitle="Slide 15 · example input">
        <p className="disclaimer">F11 = 62 A · F01 = 3.90 mm/s · F14 = 57.5 °C</p>
        <ol className="inspection-list">
          <li>Tree 1 · Band A &gt; 3.0 · 1 split</li>
          <li>Tree 2 · Current ≤ 65 A, Band A &gt; 2.8 · 2 splits</li>
          <li>Tree 3 · Temperature ≤ 70 °C, current ≤ 66 A, Band A &gt; 3.0 · 3 splits</li>
        </ol>
        <p className="disclaimer">These example splits illustrate path length. The dashboard scores are fixed demo outputs.</p>
      </Card>
      <Card title="Training and validation plan" subtitle="Slide 17 · proposed model workflow">
        <ol className="inspection-list">
          <li>Confirm healthy operation across RPM and load.</li>
          <li>Split by time before forming windows to prevent leakage.</li>
          <li>Train on healthy data, set the threshold on validation data, then freeze it before testing.</li>
          <li>Measure false alerts and detection against verified events.</li>
        </ol>
      </Card>
    </div>
  </>
}

interface Validation { fileName: string; total: number; valid: number; invalid: number; issues: string[]; rows: Measurement[]; legacyUnits: boolean }
function Dataset({ measurements, onImport }: { measurements: Measurement[]; onImport: (next: Measurement[]) => void }) {
  const [validation, setValidation] = useState<Validation | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const fileRef = useRef<HTMLInputElement>(null)
  const parseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '').replace(/^\uFEFF/, '').trim()
      const [head, ...lines] = text.split(/\r?\n/).filter(Boolean)
      const headers = head.split(',').map((item) => item.trim())
      const extraCount = windowMetadataHeaders.filter((header) => headers.includes(header)).length
      const presentationFormat = extraCount === windowMetadataHeaders.length
      const missing = [...legacyMetadataHeaders, ...featureHeaders].filter((header) => !headers.includes(header))
      if (extraCount > 0 && !presentationFormat) missing.push(...windowMetadataHeaders.filter((header) => !headers.includes(header)))
      const accelerationScale = presentationFormat ? 1 : standardGravity
      const issues: string[] = missing.length ? [`Missing required header(s): ${missing.join(', ')}`] : []
      const rows: Measurement[] = []
      let invalid = 0
      if (!missing.length) lines.forEach((line, index) => {
        const values = line.split(',').map((item) => item.trim())
        const get = (header: string) => values[headers.indexOf(header)] ?? ''
        const numeric = [...featureHeaders, 'RPM', 'Load_Percent', 'Discharge_Pressure'].every((header) => get(header) !== '' && Number.isFinite(Number(get(header))))
        if (!numeric || !get('Machine_ID') || !Number.isFinite(Date.parse(get('Timestamp'))) || !['P1', 'P2'].includes(get('Measurement_Point'))) { invalid += 1; return }
        const windowEnd = get('Window_End')
        const sampleRate = get('Sample_Rate_Hz')
        if ((windowEnd && !(Date.parse(windowEnd) > Date.parse(get('Timestamp')))) ||
            (sampleRate && !(Number.isFinite(Number(sampleRate)) && Number(sampleRate) > 0))) { invalid += 1; return }
        rows.push({
          id: `import-${index}`,
          windowId: get('Window_ID') || undefined,
          timestamp: get('Timestamp'),
          windowEnd: windowEnd || undefined,
          sampleRateHz: sampleRate ? Number(sampleRate) : undefined,
          operatingState: get('Operating_State') || undefined,
          machineId: get('Machine_ID'),
          point: get('Measurement_Point') as Measurement['point'],
          direction: get('Direction'),
          rpm: Number(get('RPM')),
          load: Number(get('Load_Percent')),
          pressure: Number(get('Discharge_Pressure')),
          sensorStatus: get('Sensor_Status') === 'Offline' ? 'Offline' : 'Online',
          csvElectrical: {
            averageCurrent: Number(get('F11_Average_3phase_Current_RMS')),
            currentUnbalance: Number(get('F12_Current_Unbalance_Index')),
            vuf: Number(get('F13_Voltage_Unbalance_Factor')),
          },
          bandA: Number(get('F01_Band_A_Velocity_RMS')),
          bandB: Number(get('F02_Band_B_Velocity_RMS')),
          acceleration: Number(get('F03_Acceleration_RMS')) * accelerationScale,
          accelerationPeak: Number(get('F04_Acceleration_Absolute_Peak')) * accelerationScale,
          crestFactor: Number(get('F05_Crest_Factor')),
          kurtosis: Number(get('F06_Pearson_Kurtosis')),
          oneX: Number(get('F07_1x_Velocity_RMS')),
          twoX: Number(get('F08_2x_Velocity_RMS')),
          envelopeRms: Number(get('F09_Envelope_RMS')) * accelerationScale,
          envelopePeak: Number(get('F10_Envelope_Spectral_Peak')) * accelerationScale,
          temperature: Number(get('F14_Housing_Temperature')),
          anomalyScore: 0,
          anomaly: false,
        })
      })
      if (!lines.length) issues.push('Dataset contains no measurement rows.')
      if (invalid) issues.push(`${invalid} row(s) have missing or invalid required values, including timestamps.`)
      rows.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
      setValidation({ fileName: file.name, total: lines.length, valid: rows.length, invalid: invalid + (missing.length ? lines.length : 0), issues, rows, legacyUnits: !presentationFormat })
    }
    reader.readAsText(file)
  }
  const downloadTemplate = () => {
    const sample = makeDemoData(presentationSpecs.machineId).at(-1)!
    const row = exportRow({ ...sample, windowId: 'T01', operatingState: 'Simulated template row' })
    const blob = new Blob([`${csvHeaders.join(',')}\n${row.join(',')}\n`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'airguard-dataset-template.csv'; link.click(); URL.revokeObjectURL(url)
  }
  const display = measurements.filter((row) => row.machineId.toLowerCase().includes(query.toLowerCase()) || row.timestamp.toLowerCase().includes(query.toLowerCase())).slice((page - 1) * 8, page * 8)
  return <><PageTitle eyebrow="DATA PIPELINE" title="Dataset management"><div className="page-actions"><button className="outline-button" onClick={downloadTemplate}><Download size={16} />Download CSV template</button><button className="primary-button" onClick={() => fileRef.current?.click()}><Upload size={16} />Upload CSV</button><input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={parseFile} /></div></PageTitle><div className="dataset-rules"><FileUp /><div><b>Measurement window schema</b><span>Slide 16 · a 10-second window has 12 metadata fields and 14 model features. The new template uses m/s². Legacy files with eight metadata columns use g for F03, F04, F09 and F10 and are converted on import.</span></div></div><DatasetSlideExample /><div className="upload-zone" onClick={() => fileRef.current?.click()}><Upload size={28} /><h2>Upload condition-monitoring CSV</h2><p>Validate headers, data type and missing values before import.</p><button className="outline-button">Choose CSV file</button><small>Required: Machine_ID, Timestamp, P1/P2 and F01–F14</small></div>{validation && <Card title="Validation result" subtitle={validation.fileName}><div className="validation-summary"><div><span>Total rows</span><b>{validation.total}</b></div><div className="good"><span>Valid rows</span><b>{validation.valid}</b></div><div className="bad"><span>Invalid rows</span><b>{validation.invalid}</b></div><div><span>Header status</span><b>{validation.issues.some((issue) => issue.startsWith('Missing')) ? 'Invalid' : 'Checked'}</b></div></div>{validation.issues.length > 0 ? <ul className="issues">{validation.issues.map((issue) => <li key={issue}><AlertTriangle size={15} />{issue}</li>)}</ul> : <div className="success-line"><Check size={17} />Headers and required values passed validation.</div>}{validation.valid > 0 && <p className="disclaimer">{validation.legacyUnits ? 'Legacy CSV · converted the four acceleration features from g to m/s².' : 'Presentation CSV · acceleration features interpreted as m/s².'}</p>}<div className="panel-actions"><button className="outline-button" onClick={() => setValidation(null)}>Discard</button><button className="primary-button" disabled={!validation.valid} onClick={() => onImport(validation.rows)}><Database size={16} />Import {validation.valid} valid row(s)</button></div></Card>}<Card title="Imported / demo data preview" subtitle={`${measurements.length} measurement windows available in this browser session`} action={<input className="table-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search machine or timestamp" />}><div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>Machine</th><th>Point</th><th>RPM</th><th>Load</th><th>Band A</th><th>Band B</th><th>Temperature</th><th>Sensor</th></tr></thead><tbody>{display.map((row) => <tr key={row.id}><td>{formatTime(row.timestamp)}</td><td>{row.machineId}</td><td><span className="point-tag">{row.point}</span></td><td>{row.rpm}</td><td>{row.load}%</td><td>{row.bandA} mm/s</td><td>{row.bandB} mm/s</td><td>{row.temperature} °C</td><td><span className={row.sensorStatus === "Online" ? "online" : ""}>● {row.sensorStatus}</span></td></tr>)}</tbody></table></div><div className="pagination"><span>Page {page}</span><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button disabled={page * 8 >= measurements.length} onClick={() => setPage((current) => current + 1)}>Next</button></div></Card><Card title="Latest feature row" subtitle="F01–F14 in the units used by the presentation" className="sensor-chart-grid"><FeatureValues features={measurementFeatures(measurements.at(-1)!)} /></Card></>
}

function DatasetSlideExample() {
  return <Card title="Dataset example from the slides" subtitle="AC-01 · P1 (DE) · radial H · slides 15–16" className="dataset-example">
    <div className="table-wrap"><table>
      <thead><tr><th>Window</th><th>Time</th><th>F01 · mm/s</th><th>F02 · mm/s</th><th>F03 · m/s²</th><th>F11 · A</th><th>F14 · °C</th></tr></thead>
      <tbody>
        <tr><th scope="row">W01</th><td>10:00:00–10:00:10</td><td>2.00</td><td>1.25</td><td>1.50</td><td>—</td><td>—</td></tr>
        <tr><th scope="row">W02</th><td>10:00:10–10:00:20</td><td>3.90</td><td>1.80</td><td>1.80</td><td>62</td><td>57.5</td></tr>
      </tbody>
    </table></div>
    <p className="disclaimer">W02 current and temperature follow the worked example on slide 15. Slide 16 shows conflicting F14 entries. This comparison displays the known values as examples and leaves the unverified W01 values blank.</p>
  </Card>
}

function Alerts({ alerts, setAlerts }: { alerts: AppAlert[]; setAlerts: (alerts: AppAlert[]) => void }) {
  const [filter, setFilter] = useState<'All' | AlertStatus>('All')
  const [editing, setEditing] = useState<string | null>(null)
  const list = alerts.filter((item) => filter === 'All' || item.status === filter)
  const update = (id: string, patch: Partial<AppAlert>) => setAlerts(alerts.map((item) => item.id === id ? { ...item, ...patch } : item))
  return <><PageTitle eyebrow="EVENT MANAGEMENT" title="Alert history"><div className="page-actions"><button className="outline-button" onClick={() => { const csv = ['Event ID,Timestamp,Machine,Parameter,Value,Threshold,Severity,Status', ...alerts.map((item) => [item.id, item.timestamp, item.machineId, item.parameter, item.measured, item.threshold, item.severity, item.status].join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'airguard-alert-history.csv'; link.click(); URL.revokeObjectURL(url) }}><Download size={16} />Export CSV</button></div></PageTitle><div className="filter-row"><span>Filter status</span>{(['All', 'New', 'Acknowledged', 'Under Inspection', 'Resolved'] as const).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><Card title={`${list.length} alert event${list.length === 1 ? '' : 's'}`} subtitle="Status and maintenance notes are editable in this prototype"><div className="alerts-list">{list.length ? list.map((alert) => <article className={`alert-row ${severityClass(alert.severity)}`} key={alert.id}><div className="alert-severity"><AlertTriangle size={18} /><b>{alert.severity}</b></div><div className="alert-main"><div><span>{alert.id} · {formatTime(alert.timestamp)}</span><h3>{alert.parameter}</h3></div><p>{alert.description}</p><small>Measured <b>{alert.measured}</b> · Threshold <b>{alert.threshold}</b> · Source: {alert.source}</small>{editing === alert.id && <textarea autoFocus value={alert.note} onChange={(event) => update(alert.id, { note: event.target.value })} placeholder="Add maintenance note…" />}{alert.note && editing !== alert.id && <div className="saved-note">Note: {alert.note}</div>}</div><div className="alert-actions"><select value={alert.status} onChange={(event) => update(alert.id, { status: event.target.value as AlertStatus })}>{(['New', 'Acknowledged', 'Under Inspection', 'Resolved'] as AlertStatus[]).map((status) => <option key={status}>{status}</option>)}</select><button className="text-button" onClick={() => setEditing(editing === alert.id ? null : alert.id)}>{editing === alert.id ? 'Done' : 'Add note'}</button></div></article>) : <div className="empty-state"><BellRing /><p>No alerts match this filter.</p></div>}</div></Card></>
}

function SettingsPage({ value, onSave }: { value: Settings; onSave: (settings: Settings) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const set = <K extends keyof Settings>(key: K, next: Settings[K]) => setDraft((current) => ({ ...current, [key]: next }))
  const Input = ({ label, field, unit }: { label: string; field: keyof Settings; unit?: string }) => <label className="setting-input"><span>{label}</span><div><input type={typeof draft[field] === 'number' ? 'number' : 'text'} value={String(draft[field])} onChange={(event) => set(field, typeof value[field] === 'number' ? Number(event.target.value) : event.target.value)} />{unit && <em>{unit}</em>}</div></label>
  return <><PageTitle eyebrow="CONFIGURATION" title="System settings"><div className="page-actions"><button className="outline-button" onClick={() => setDraft(defaultSettings)}><RotateCcw size={16} />Restore defaults</button><button className="primary-button" onClick={() => onSave(draft)}><Save size={16} />Save settings</button></div></PageTitle><div className="settings-grid"><Card title="Machine"><div className="settings-fields"><Input label="Machine ID" field="machineId" /><Input label="Machine name" field="machineName" /><Input label="Rated power" field="ratedPower" unit="kW" /><Input label="Rated RPM" field="ratedRpm" unit="rpm" /></div></Card><Card title="VDI 3836 example · Group 3">
    <div className="settings-fields">
      <label className="setting-input"><span>Example mounting</span><select value={draft.vdiMount} onChange={(event) => set('vdiMount', event.target.value as VdiMount)}><option value="rigid">Rigid</option><option value="resilient">Resilient</option></select></label>
      <Input label="P1 Band A demo baseline" field="baselineP1BandA" unit="mm/s RMS" />
      <Input label="P1 Band B demo baseline" field="baselineP1BandB" unit="mm/s RMS" />
      <Input label="P2 Band A demo baseline" field="baselineBandA" unit="mm/s RMS" />
      <Input label="P2 Band B demo baseline" field="baselineBandB" unit="mm/s RMS" />
    </div>
    <p className="disclaimer">Comparison uses the Group 3 row from Table 1 and demo baselines for §5.1. The example profile requires at least 55 kW and applies to built-in data.</p>
  </Card><Card title="Electrical · project demo limits"><div className="settings-fields"><Input label="VUF review threshold" field="vufWarning" unit="%" /><Input label="Current unbalance review threshold" field="currentUnbalanceWarning" unit="%" /></div></Card><Card title="Temperature · project demo limits"><div className="settings-fields"><Input label="Warning threshold" field="temperatureWarning" unit="°C" /><Input label="Critical threshold" field="temperatureCritical" unit="°C" /></div></Card><Card title="AI anomaly detection"><div className="settings-fields"><Input label="Model version" field="modelVersion" /><Input label="Detection threshold" field="anomalyThreshold" /><Input label="Measurement window" field="measurementWindow" unit="seconds" /><Input label="Refresh interval" field="refreshInterval" unit="seconds" /></div><label className="setting-input"><span>Model status</span><select value={draft.modelStatus} onChange={(event) => set('modelStatus', event.target.value as Settings['modelStatus'])}><option>DEMO MODE</option><option>Connected</option></select></label></Card><Card title="Data persistence"><div className="storage-note"><Database /><div><b>Browser local storage enabled</b><p>Settings are saved on this device. Dataset import and alerts are kept for the current browser session.</p></div></div></Card></div></>
}

const tooltipStyle = { background: '#111d2d', border: '1px solid #314763', borderRadius: 8, color: '#e9f2fc', fontSize: 12 }

export default App
