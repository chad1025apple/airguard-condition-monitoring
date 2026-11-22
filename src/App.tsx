import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import {
  Activity, AlertTriangle, BellRing, BrainCircuit, Check, ChevronDown, CircleHelp,
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
  avgCurrent, csvHeaders, currentUnbalance, defaultSettings, featureHeaders, statusFor, vuf,
} from './domain'
import { makeDemoData, recentAlerts, simulateMeasurement } from './demoData'

const navItems: { id: View; label: string; icon: typeof Gauge }[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'vibration', label: 'Vibration Monitoring', icon: Vibrate },
  { id: 'electrical', label: 'Electrical Monitoring', icon: Zap },
  { id: 'temperature', label: 'Temperature Monitoring', icon: Thermometer },
  { id: 'diagnosis', label: 'Automated Fault Diagnosis', icon: BrainCircuit },
  { id: 'ai', label: 'AI Anomaly Detection', icon: Activity },
  { id: 'dataset', label: 'Dataset Management', icon: Database },
  { id: 'alerts', label: 'Alert History', icon: BellRing },
  { id: 'settings', label: 'System Settings', icon: Settings2 },
]

const chartGrid = { stroke: '#26364d', strokeDasharray: '3 4' }
const axis = { stroke: '#8292aa', fontSize: 11 }
const statusClass: Record<Status, string> = {
  NORMAL: 'normal', WARNING: 'warning', 'HIGH ALERT': 'high', CRITICAL: 'critical', OFFLINE: 'offline', 'NOT CONFIGURED': 'offline',
}

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem('airguard-settings') ?? '{}') } as Settings
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
  const [alerts, setAlerts] = useState<AppAlert[]>(() => recentAlerts(makeDemoData(settings.machineId), settings))
  const [view, setView] = useState<View>('overview')
  const [navOpen, setNavOpen] = useState(false)
  const [range, setRange] = useState('24H')
  const [notice, setNotice] = useState('')

  const latest = measurements.at(-1)!
  const currentStatus = statusFor(latest, settings)
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
  const loadDemo = (scenario: 'normal' | 'warning' | 'anomaly' = 'normal') => {
    const data = makeDemoData(settings.machineId, scenario)
    updateData(data)
    showNotice(scenario === 'anomaly' ? 'Anomaly-like demo condition loaded across the dashboard.' : 'Demo data loaded.')
  }
  const simulate = (anomaly = false) => {
    const next = simulateMeasurement(latest, settings, anomaly)
    updateData([...measurements.slice(-143), next])
    showNotice(anomaly ? 'Anomaly measurement injected — diagnosis and alerts updated.' : 'New 10-second measurement simulated.')
  }
  const switchMachine = () => {
    const machineId = settings.machineId === 'AC-TSA-01' ? 'AC-TSA-02' : 'AC-TSA-01'
    const nextSettings = { ...settings, machineId, machineName: machineId === 'AC-TSA-01' ? 'Main Process Air Compressor' : 'Utilities Air Compressor' }
    setSettings(nextSettings)
    const data = makeDemoData(machineId, 'warning')
    updateData(data, nextSettings)
    showNotice(`Switched to ${machineId}.`)
  }
  const saveSettings = (next: Settings) => {
    setSettings(next)
    localStorage.setItem('airguard-settings', JSON.stringify(next))
    showNotice('System settings saved to local storage.')
  }

  const sharedProps = { data: measurements, latest, settings, range, setRange, goTo: setView }
  return <div className="app-shell">
    <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Waves size={21} /></div><div><strong>AirGuard</strong><span>CONDITION INTELLIGENCE</span></div><button className="mobile-close" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="machine-switcher"><span>ACTIVE ASSET</span><button onClick={switchMachine}><Factory size={15} /><b>{settings.machineId}</b><ChevronDown size={15} /></button></div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setNavOpen(false) }}><Icon size={18} /><span>{label}</span>{id === 'diagnosis' && currentStatus !== 'NORMAL' && <i className="nav-alert" />}</button>)}</nav>
      <div className="sidebar-foot"><DemoBadge /><small>Prototype v0.1 · 10 s window</small></div>
    </aside>
    {navOpen && <button className="backdrop" onClick={() => setNavOpen(false)} aria-label="Close navigation" />}
    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setNavOpen(true)} aria-label="Open navigation"><Menu /></button><div className="breadcrumb">Operations <span>/</span> <b>{navItems.find((item) => item.id === view)?.label}</b></div><div className="header-actions"><span className="update-time">Last update <b>{formatTime(latest.timestamp)}</b></span><button className="icon-button" title="Load normal demo data" onClick={() => loadDemo()}><RefreshCw size={17} /></button><button className="profile" title="Engineer session">ME</button></div></header>
      <div className="content">
        {notice && <div className="toast"><Check size={17} />{notice}</div>}
        {view === 'overview' && <Overview {...sharedProps} onSimulate={simulate} />}
        {view === 'vibration' && <Vibration {...sharedProps} />}
        {view === 'electrical' && <Electrical {...sharedProps} />}
        {view === 'temperature' && <Temperature {...sharedProps} />}
        {view === 'diagnosis' && <Diagnosis {...sharedProps} />}
        {view === 'ai' && <AiDetection {...sharedProps} />}
        {view === 'dataset' && <Dataset measurements={measurements} onImport={(next) => { updateData(next); showNotice(`${next.length} valid dataset rows imported for this session.`) }} />}
        {view === 'alerts' && <Alerts alerts={alerts} setAlerts={setAlerts} />}
        {view === 'settings' && <SettingsPage value={settings} onSave={saveSettings} />}
      </div>
      <footer className="app-footer"><span>AirGuard Condition Intelligence · Decision support only</span><span>Engineering rules, AI anomaly detection and diagnosis are displayed separately.</span></footer>
    </main>
  </div>
}

function Overview({ data, latest, settings, range, setRange, goTo, onSimulate }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void; goTo: (view: View) => void; onSimulate: (anomaly?: boolean) => void }) {
  const currentStatus = statusFor(latest, settings)
  const cause = currentStatus === 'NORMAL' ? 'All configured project thresholds are within the normal operating range.' : currentStatus === 'CRITICAL' ? 'Configured vibration or thermal critical limit is exceeded.' : 'One or more configured thresholds or the demo anomaly score need review.'
  const trend = data.slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true), current: avgCurrent(m), vuf: vuf(m) }))
  return <>
    <PageTitle eyebrow="LIVE ASSET OVERVIEW" title="Compressor condition at a glance"><div className="page-actions"><button className="outline-button" onClick={() => onSimulate()}><RefreshCw size={16} />Simulate measurement</button><button className="primary-button" onClick={() => onSimulate(true)}><AlertTriangle size={16} />Simulate anomaly</button></div></PageTitle>
    <div className="asset-strip"><div className="asset-icon"><Cpu /></div><div className="asset-main"><span>Machine</span><strong>{settings.machineName}</strong><small>{settings.machineId} · Oil-injected twin-screw compressor</small></div><div><span>Rated power</span><b>{settings.ratedPower} kW</b></div><div><span>Operating RPM</span><b>{latest.rpm.toLocaleString()} rpm</b></div><div><span>Load</span><b>{latest.load}%</b></div><div><span>Discharge pressure</span><b>{latest.pressure} bar</b></div><div className="asset-status"><span>Operating status</span><StatusBadge status={currentStatus} /></div></div>
    <div className="assessment-banner"><div className={`status-orb ${statusClass[currentStatus]}`}><Activity /></div><div><span>COMPOSITE MACHINE STATUS</span><h2>{currentStatus}</h2><p>{cause}</p></div><div className="assessment-source"><span>Evaluation source</span><b>Engineering rules + AI demo score</b><small>Not an automatic shutdown decision</small></div><button onClick={() => goTo('diagnosis')}>View diagnostic evidence <GitBranch size={15} /></button></div>
    <section className="section-title"><div><span>KEY PARAMETERS</span><h2>Current 10-second measurement window</h2></div><DemoBadge /></section>
    <div className="metric-grid four">
      <MetricCard label="Band A velocity RMS" value={latest.bandA} unit=" mm/s" detail={`P${latest.point.slice(1)} · baseline ${settings.baselineBandA} mm/s`} tone={latest.bandA >= settings.bandAWarn ? 'amber' : 'green'} icon={<Vibrate size={18} />} />
      <MetricCard label="Band B velocity RMS" value={latest.bandB} unit=" mm/s" detail={`P${latest.point.slice(1)} · baseline ${settings.baselineBandB} mm/s`} tone={latest.bandB >= settings.bandBWarn ? 'amber' : 'green'} icon={<Waves size={18} />} />
      <MetricCard label="Average 3-phase current" value={avgCurrent(latest).toFixed(1)} unit=" A" detail={`Unbalance ${currentUnbalance(latest).toFixed(2)}%`} tone="blue" icon={<Zap size={18} />} />
      <MetricCard label="Bearing housing temperature" value={latest.temperature} unit=" °C" detail={`Warning at ${settings.temperatureWarning} °C`} tone={latest.temperature >= settings.temperatureWarning ? 'amber' : 'green'} icon={<Thermometer size={18} />} />
      <MetricCard label="Acceleration RMS" value={latest.acceleration} unit=" g" detail={`Crest factor ${latest.crestFactor}`} tone="blue" icon={<Activity size={18} />} />
      <MetricCard label="Voltage unbalance factor" value={vuf(latest).toFixed(2)} unit=" %" detail={`Project warning at ${settings.vufWarning}%`} tone={vuf(latest) >= settings.vufWarning ? 'amber' : 'green'} icon={<Zap size={18} />} />
      <MetricCard label="Isolation Forest score" value={latest.anomalyScore.toFixed(2)} detail={`Threshold ${settings.anomalyThreshold} · ${latest.anomaly ? 'ANOMALY' : 'NORMAL'}`} tone={latest.anomaly ? 'amber' : 'purple'} icon={<BrainCircuit size={18} />} />
      <MetricCard label="Data quality" value="GOOD" detail="All selected sensors online" tone="green" icon={<ClipboardCheck size={18} />} />
    </div>
    <div className="section-title charts-title"><div><span>TREND ANALYSIS</span><h2>Condition trend</h2></div><RangeControl range={range} setRange={setRange} /></div>
    <div className="chart-grid two">
      <ChartPanel title="Vibration velocity trend" subtitle="Band A / Band B · mm/s RMS"><ResponsiveContainer width="100%" height={250}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} tickLine={false} /><YAxis {...axis} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="bandA" name="Band A" stroke="#28c9a3" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="bandB" name="Band B" stroke="#f3b450" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Electrical & thermal trend" subtitle="Current (A), VUF (%) and bearing housing (°C)"><ResponsiveContainer width="100%" height={250}><ComposedChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} tickLine={false} /><YAxis {...axis} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="current" name="Current" stroke="#54a8ff" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="temperature" name="Temperature" stroke="#ee7d5c" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="vuf" name="VUF" stroke="#ad8cff" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Anomaly score trend" subtitle="Isolation Forest demo output — not failure probability"><ResponsiveContainer width="100%" height={235}><AreaChart data={trend}><defs><linearGradient id="scoreGradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#9b7fff" stopOpacity={.45} /><stop offset="1" stopColor="#9b7fff" stopOpacity={0} /></linearGradient></defs><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} tickLine={false} /><YAxis domain={[0, 1]} {...axis} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="anomalyScore" name="Anomaly score" stroke="#aa8bff" fill="url(#scoreGradient)" strokeWidth={2} /></AreaChart></ResponsiveContainer></ChartPanel>
      <Card title="Active evaluation notes" subtitle="Clear separation of signals and assessment"><div className="note-list"><div><i className="green-dot" /><span>Engineering rules</span><b>{currentStatus === 'NORMAL' ? 'No configured threshold exceeded' : 'Review configured threshold exceedance'}</b></div><div><i className="purple-dot" /><span>AI anomaly detection</span><b>{latest.anomaly ? 'Anomaly detected — inspection required' : 'No anomaly above demo threshold'}</b></div><div><i className="blue-dot" /><span>Automated diagnosis</span><b>{currentStatus === 'NORMAL' ? 'Insufficient evidence for fault candidate' : 'Preliminary candidate(s) require verification'}</b></div></div><button className="text-button" onClick={() => goTo('ai')}>Open AI anomaly analysis →</button></Card>
    </div>
  </>
}

function Vibration({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const [point, setPoint] = useState<'ALL' | 'P1' | 'P2'>('ALL')
  const filtered = (point === 'ALL' ? data : data.filter((m) => m.point === point)).slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true) }))
  const p1 = data.filter((m) => m.point === 'P1').at(-1)!
  const p2 = data.filter((m) => m.point === 'P2').at(-1)!
  const spectrum = Array.from({ length: 34 }, (_, index) => ({ frequency: index * 12, amplitude: Number((0.12 + Math.abs(Math.sin(index * 0.46)) * .55 + (index === 8 ? .65 : 0) + (index === 16 ? .38 : 0)).toFixed(2)), envelope: Number((0.05 + Math.abs(Math.cos(index * .35)) * .2 + (index === 18 ? .42 : 0)).toFixed(2)) }))
  const features = [
    ['F01', 'Band A Velocity RMS', latest.bandA, 'mm/s RMS'], ['F02', 'Band B Velocity RMS', latest.bandB, 'mm/s RMS'], ['F03', 'Acceleration RMS', latest.acceleration, 'g'], ['F04', 'Acceleration Absolute Peak', latest.accelerationPeak, 'g'], ['F05', 'Crest Factor', latest.crestFactor, ''], ['F06', 'Pearson Kurtosis', latest.kurtosis, ''], ['F07', '1× Velocity RMS', latest.oneX, 'mm/s RMS'], ['F08', '2× Velocity RMS', latest.twoX, 'mm/s RMS'], ['F09', 'Envelope RMS', latest.envelopeRms, 'g'], ['F10', 'Envelope Spectral Peak', latest.envelopePeak, 'g'],
  ]
  return <>
    <PageTitle eyebrow="AIR END / VIBRATION" title="Vibration monitoring"><div className="page-actions"><RangeControl range={range} setRange={setRange} /></div></PageTitle>
    <div className="toolbar"><div className="segment"><span>Measurement point</span>{(['ALL', 'P1', 'P2'] as const).map((item) => <button key={item} onClick={() => setPoint(item)} className={point === item ? 'active' : ''}>{item === 'ALL' ? 'All points' : item}</button>)}</div><span className="info-copy">Velocity values are RMS. Trend data shown is simulated.</span></div>
    <div className="vibration-layout">
      <Card title="Screw airend measurement diagram" subtitle="Illustrative diagram — not to scale" className="airend-card"><AirendDiagram active={point} /><div className="diagram-key"><span><i className="point p1" />P1 Drive / input side</span><span><i className="point p2" />P2 Opposite side</span></div></Card>
      <Card title="Current vibration state" subtitle="Project-defined rules"><div className="point-readings"><div><span><i className="point p1" />P1 velocity</span><strong>{p1.bandA} <small>mm/s</small></strong><StatusBadge compact status={p1.bandA >= settings.bandAHigh ? 'CRITICAL' : p1.bandA >= settings.bandAWarn ? 'WARNING' : 'NORMAL'} /></div><div><span><i className="point p2" />P2 velocity</span><strong>{p2.bandA} <small>mm/s</small></strong><StatusBadge compact status={p2.bandA >= settings.bandAHigh ? 'CRITICAL' : p2.bandA >= settings.bandAWarn ? 'WARNING' : 'NORMAL'} /></div></div><div className="threshold-note"><ShieldAlert size={17} /><span>VDI 3836 zone values are <b>NOT CONFIGURED</b> until verified for this compressor and measurement arrangement.</span></div></Card>
    </div>
    <div className="chart-grid two"><ChartPanel title="Overall vibration trend" subtitle="Velocity RMS, selected measurement point"><ResponsiveContainer width="100%" height={250}><LineChart data={filtered}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="bandA" name="Band A" stroke="#29c9a3" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="bandB" name="Band B" stroke="#f3b450" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartPanel><ChartPanel title="P1 vs P2 comparison" subtitle="Most recent window"><ResponsiveContainer width="100%" height={250}><BarChart data={[{ point: 'P1', bandA: p1.bandA, bandB: p1.bandB }, { point: 'P2', bandA: p2.bandA, bandB: p2.bandB }]}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="point" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="bandA" name="Band A" fill="#27c8a1" radius={[4, 4, 0, 0]} /><Bar dataKey="bandB" name="Band B" fill="#f4b352" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="FFT spectrum — demo" subtitle="Velocity spectrum, Hz"><ResponsiveContainer width="100%" height={250}><BarChart data={spectrum}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="frequency" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="amplitude" name="Amplitude" fill="#51a8ff" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Envelope spectrum — demo" subtitle="For engineer review; not an automatic bearing diagnosis"><ResponsiveContainer width="100%" height={250}><BarChart data={spectrum}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="frequency" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="envelope" name="Envelope" fill="#b28cff" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel></div>
    <Card title="Feature extraction" subtitle="The ten vibration features supplied to the AI input vector"><div className="feature-grid">{features.map(([code, label, value, unit]) => <div key={String(code)}><span>{code}</span><p>{label}</p><strong>{value} <small>{unit}</small></strong></div>)}</div></Card>
    <Card title="Standard-based assessment" subtitle="VDI 3836 / ISO 17359 reference configuration"><div className="standard-table"><div className="standard-head"><span>Assessment item</span><span>Measured value</span><span>Standard threshold</span><span>Source</span><span>Result</span></div>{[['Band A / P1', p1.bandA], ['Band A / P2', p2.bandA], ['Band B / P1', p1.bandB], ['Band B / P2', p2.bandB]].map(([label, value]) => <div key={String(label)}><span>{label}</span><b>{value} mm/s RMS</b><span>NOT CONFIGURED</span><span>Verified standard required</span><StatusBadge compact status="NOT CONFIGURED" /></div>)}</div><p className="disclaimer">No VDI 3836 values are invented by this prototype. Set a verified, applicable standard configuration separately from project-defined alarm thresholds.</p></Card>
  </>
}

function AirendDiagram({ active }: { active: 'ALL' | 'P1' | 'P2' }) {
  return <svg className="airend-diagram" viewBox="0 0 520 190" role="img" aria-label="Illustrative twin screw airend diagram with P1 and P2 measurement points"><defs><linearGradient id="body" x1="0" x2="1"><stop stopColor="#263950" /><stop offset=".5" stopColor="#405973" /><stop offset="1" stopColor="#27394f" /></linearGradient></defs><rect x="78" y="56" width="365" height="80" rx="38" fill="url(#body)" stroke="#6f8baa" strokeWidth="2" /><rect x="137" y="68" width="230" height="56" rx="27" fill="#17283b" stroke="#7292b4" /><path d="M158 96c17-28 36 28 54 0s37-28 55 0 37 28 55 0 37-28 55 0" fill="none" stroke="#62c7dc" strokeWidth="7" strokeLinecap="round" /><path d="M158 106c17-28 36 28 54 0s37-28 55 0 37 28 55 0 37-28 55 0" fill="none" stroke="#d2a654" strokeWidth="7" strokeLinecap="round" /><circle cx="93" cy="96" r="33" fill="#17263a" stroke="#7795b3" strokeWidth="3" /><circle cx="428" cy="96" r="33" fill="#17263a" stroke="#7795b3" strokeWidth="3" /><rect x="38" y="78" width="28" height="36" rx="4" fill="#324a64" /><rect x="454" y="78" width="28" height="36" rx="4" fill="#324a64" /><line x1="96" y1="48" x2="96" y2="19" stroke="#34d6ae" strokeWidth="2" /><circle cx="96" cy="54" r="8" fill={active === 'P2' ? '#42536a' : '#34d6ae'} /><text x="72" y="16" fill="#d7e6f7" fontSize="14" fontWeight="700">P1</text><text x="36" y="170" fill="#8fa4bd" fontSize="12">Drive / input side</text><line x1="426" y1="48" x2="426" y2="19" stroke="#f5b454" strokeWidth="2" /><circle cx="426" cy="54" r="8" fill={active === 'P1' ? '#42536a' : '#f5b454'} /><text x="402" y="16" fill="#d7e6f7" fontSize="14" fontWeight="700">P2</text><text x="387" y="170" fill="#8fa4bd" fontSize="12">Opposite side</text></svg>
}

function Electrical({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const trend = data.slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true), vuf: vuf(m), currentUnbalance: currentUnbalance(m) }))
  const phaseData = ['A', 'B', 'C'].map((phase) => ({ phase: `Phase ${phase}`, Voltage: latest[`voltage${phase}` as keyof Measurement] as number, Current: latest[`current${phase}` as keyof Measurement] as number }))
  return <>
    <PageTitle eyebrow="DRIVE MOTOR / ELECTRICAL" title="Electrical monitoring"><RangeControl range={range} setRange={setRange} /></PageTitle>
    <div className="callout"><CircleHelp size={18} /><p>Voltage Unbalance Factor (VUF) uses the IEC sequence-component form: <b>VUF (%) = (|U₂| / |U₁|) × 100</b>. This dashboard treats configured values as review thresholds, not universal trip settings.</p></div>
    <div className="metric-grid four"><MetricCard label="Phase A voltage" value={latest.voltageA} unit=" V" detail="RMS" tone="blue" /><MetricCard label="Phase B voltage" value={latest.voltageB} unit=" V" detail="RMS" tone="blue" /><MetricCard label="Phase C voltage" value={latest.voltageC} unit=" V" detail="RMS" tone="blue" /><MetricCard label="Average 3-phase current" value={avgCurrent(latest).toFixed(1)} unit=" A" detail="RMS" tone="blue" /><MetricCard label="Phase A current" value={latest.currentA} unit=" A" detail="RMS" tone="blue" /><MetricCard label="Phase B current" value={latest.currentB} unit=" A" detail="RMS" tone="blue" /><MetricCard label="Phase C current" value={latest.currentC} unit=" A" detail="RMS" tone="blue" /><MetricCard label="Voltage unbalance factor" value={vuf(latest).toFixed(2)} unit=" %" detail={`Project review level: ${settings.vufWarning}%`} tone={vuf(latest) >= settings.vufWarning ? 'amber' : 'green'} /></div>
    <div className="chart-grid two"><ChartPanel title="Three-phase voltage" subtitle="Most recent 10-second window"><ResponsiveContainer width="100%" height={250}><BarChart data={phaseData}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="phase" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="Voltage" fill="#55a9ff" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Three-phase current" subtitle="Most recent 10-second window"><ResponsiveContainer width="100%" height={250}><BarChart data={phaseData}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="phase" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="Current" fill="#27c9a2" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel><ChartPanel title="Voltage unbalance trend" subtitle="Calculated VUF (%)"><ResponsiveContainer width="100%" height={250}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="vuf" name="VUF %" stroke="#ad8cff" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartPanel><ChartPanel title="Current unbalance trend" subtitle="Maximum deviation / average current"><ResponsiveContainer width="100%" height={250}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="currentUnbalance" name="Current unbalance %" stroke="#f4b352" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartPanel></div>
    <Card title="Engineering interpretation" subtitle="IEC 60034-26 context"><div className="interpret-grid"><div><span>Current VUF</span><strong>{vuf(latest).toFixed(2)}%</strong><p>{vuf(latest) >= settings.vufWarning ? 'Above project review threshold.' : 'Below project review threshold.'}</p></div><div><span>Current unbalance</span><strong>{currentUnbalance(latest).toFixed(2)}%</strong><p>{currentUnbalance(latest) >= settings.currentUnbalanceWarning ? 'Above project review threshold.' : 'Below project review threshold.'}</p></div><div><span>Scope note</span><strong>Review required</strong><p>IEC guidance helps evaluate motor impact; operational protection settings remain site-specific.</p></div></div></Card>
  </>
}

function Temperature({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const trend = data.slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true), warning: settings.temperatureWarning, critical: settings.temperatureCritical }))
  const status: Status = latest.temperature >= settings.temperatureCritical ? 'CRITICAL' : latest.temperature >= settings.temperatureWarning ? 'WARNING' : 'NORMAL'
  return <><PageTitle eyebrow="AIR END / THERMAL" title="Temperature monitoring"><RangeControl range={range} setRange={setRange} /></PageTitle><div className="temperature-hero"><div className="thermo-visual"><div className="thermo-tube"><i style={{ height: `${Math.min(90, latest.temperature / 105 * 100)}%` }} /></div><span>°C</span></div><div><span>MEASUREMENT POINT</span><h2>Housing temperature near bearing</h2><p>This is not motor winding temperature. Thresholds are project-configurable in System Settings.</p><div className="threshold-row"><div><span>Warning threshold</span><b>{settings.temperatureWarning} °C</b></div><div><span>Critical threshold</span><b>{settings.temperatureCritical} °C</b></div></div></div><div className="temperature-status"><span>Current temperature</span><strong>{latest.temperature}<small>°C</small></strong><StatusBadge status={status} /></div></div><div className="chart-grid two"><ChartPanel title="Bearing housing temperature trend" subtitle="10-second measurement window"><ResponsiveContainer width="100%" height={270}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="temperature" name="Housing temperature" stroke="#ed7e5d" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="warning" name="Warning" stroke="#f4b352" strokeDasharray="4 4" dot={false} /><Line type="monotone" dataKey="critical" name="Critical" stroke="#ef5c66" strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer></ChartPanel><Card title="Thermal evaluation" subtitle="Current measurement"><div className="evaluation-stack"><div><span>Configured warning</span><b>{settings.temperatureWarning} °C</b><StatusBadge compact status={latest.temperature >= settings.temperatureWarning ? 'WARNING' : 'NORMAL'} /></div><div><span>Configured critical</span><b>{settings.temperatureCritical} °C</b><StatusBadge compact status={latest.temperature >= settings.temperatureCritical ? 'CRITICAL' : 'NORMAL'} /></div><div><span>Current condition</span><b>{latest.temperature} °C</b><StatusBadge compact status={status} /></div></div><p className="disclaimer">Review trend, loading and ambient/cooling conditions before attributing a cause.</p></Card></div></>
}

function Diagnosis({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const abnormal = {
    bandA: latest.bandA >= settings.bandAWarn,
    bandB: latest.bandB >= settings.bandBWarn,
    envelope: latest.envelopeRms >= 0.7,
    heat: latest.temperature >= settings.temperatureWarning,
    electrical: vuf(latest) >= settings.vufWarning || currentUnbalance(latest) >= settings.currentUnbalanceWarning,
    anomaly: latest.anomalyScore >= settings.anomalyThreshold,
  }
  const evidenceCount = Object.values(abnormal).filter(Boolean).length
  const candidate = abnormal.bandB || abnormal.envelope || abnormal.heat ? 'Bearing-related abnormality' : abnormal.electrical ? 'Abnormal motor electrical condition' : abnormal.bandA ? 'Excessive vibration / mechanical looseness' : null
  const trend = data.slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true) }))
  return <><PageTitle eyebrow="DECISION SUPPORT" title="Automated fault diagnosis"><RangeControl range={range} setRange={setRange} /></PageTitle><div className="preliminary"><ShieldAlert /><div><strong>PRELIMINARY DIAGNOSIS — ENGINEER VERIFICATION REQUIRED</strong><span>Candidate ranking is based on engineering-rule evidence and signal context. Isolation Forest does not identify failure cause.</span></div></div><div className="workflow"><div><Cpu size={17} /><span>Sensor data</span></div><i /> <div><Waves size={17} /><span>Feature extraction</span></div><i /> <div><ClipboardCheck size={17} /><span>Engineering rules</span></div><i /> <div><BrainCircuit size={17} /><span>AI anomaly detection</span></div><i /> <div className="active"><GitBranch size={17} /><span>Engineer review</span></div></div>{evidenceCount < 2 ? <Card title="Insufficient evidence" subtitle="No fault candidate can be ranked"><div className="empty-evidence"><CircleHelp /><div><h2>INSUFFICIENT EVIDENCE</h2><p>There are not enough corroborating abnormal parameters to suggest a fault candidate. Continue monitoring and verify signal quality.</p></div></div></Card> : <div className="diagnosis-grid"><Card title="Leading possible fault candidate" subtitle="Rule-supported; not a confirmed cause" className="candidate-card"><span className="candidate-number">01</span><h2>{candidate}</h2><StatusBadge status={latest.temperature >= settings.temperatureCritical ? 'CRITICAL' : 'WARNING'} /><div className="confidence-block"><span>Priority</span><b>{latest.temperature >= settings.temperatureCritical ? 'HIGH' : 'MEDIUM'}</b><small>No confidence percentage is shown without a validated diagnosis model.</small></div><button className="outline-button"><ClipboardCheck size={16} />Mark engineer verification</button></Card><Card title="Detected abnormal parameters" subtitle="Live current-window evidence"><EvidenceItem active={abnormal.bandB} label="Band B vibration increased" detail={`${latest.bandB} mm/s RMS vs project warning ${settings.bandBWarn} mm/s`} /><EvidenceItem active={abnormal.envelope} label="Envelope RMS unusual" detail={`${latest.envelopeRms} g — review envelope spectrum`} /><EvidenceItem active={abnormal.heat} label="Bearing housing temperature increased" detail={`${latest.temperature} °C vs configured warning ${settings.temperatureWarning} °C`} /><EvidenceItem active={abnormal.electrical} label="Electrical unbalance condition" detail={`VUF ${vuf(latest).toFixed(2)}% · current unbalance ${currentUnbalance(latest).toFixed(2)}%`} /><EvidenceItem active={abnormal.anomaly} label="Anomaly score above demo threshold" detail={`${latest.anomalyScore.toFixed(2)} vs ${settings.anomalyThreshold}`} /></Card><Card title="Suggested inspection" subtitle="Recommended engineer actions"><ol className="inspection-list"><li>Recheck vibration at P1 and P2 with verified sensor mounting.</li><li>Review FFT and envelope spectrum together with trend history.</li><li>Inspect bearing condition, lubrication route and cooling performance.</li><li>Verify electrical measurement quality and phase balance.</li><li>Record findings and update maintenance history.</li></ol></Card><ChartPanel title="Supporting evidence trend" subtitle="Band B, envelope RMS and temperature"><ResponsiveContainer width="100%" height={275}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="bandB" name="Band B" stroke="#f4b352" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="envelopeRms" name="Envelope RMS" stroke="#ae8dff" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="temperature" name="Housing temperature" stroke="#ee7d5c" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartPanel></div>}</>
}

function EvidenceItem({ active, label, detail }: { active: boolean; label: string; detail: string }) {
  return <div className={`evidence-item ${active ? 'active' : ''}`}>{active ? <AlertTriangle size={17} /> : <Check size={17} />}<div><b>{label}</b><span>{detail}</span></div><em>{active ? 'ABNORMAL' : 'NOT DETECTED'}</em></div>
}

function AiDetection({ data, latest, settings, range, setRange }: { data: Measurement[]; latest: Measurement; settings: Settings; range: string; setRange: (r: string) => void }) {
  const trend = data.slice(-48).map((m) => ({ ...m, time: formatTime(m.timestamp, true), current: avgCurrent(m) }))
  const distribution = [{ name: 'Normal', value: data.filter((m) => !m.anomaly).length }, { name: 'Anomaly', value: data.filter((m) => m.anomaly).length }]
  const featureOverview = [{ name: 'F01', value: latest.bandA }, { name: 'F02', value: latest.bandB }, { name: 'F03', value: latest.acceleration }, { name: 'F09', value: latest.envelopeRms }, { name: 'F11', value: avgCurrent(latest) / 40 }, { name: 'F12', value: currentUnbalance(latest) }, { name: 'F13', value: vuf(latest) }, { name: 'F14', value: latest.temperature / 25 }]
  const recentAnomalies = data.filter((m) => m.anomaly).slice(-5).reverse()
  return <><PageTitle eyebrow="UNSUPERVISED ML / DEMO" title="AI anomaly detection"><RangeControl range={range} setRange={setRange} /></PageTitle><div className="ai-notice"><BrainCircuit /><div><b>DEMO MODE — Isolation Forest is not connected or trained in this prototype.</b><span>Scores are realistic mock values for interface testing. They are not failure probabilities, RUL estimates, or a direct cause diagnosis.</span></div><span className="model-chip">{settings.modelVersion}</span></div><div className="metric-grid three"><MetricCard label="Anomaly score" value={latest.anomalyScore.toFixed(2)} detail="Mock Isolation Forest output" tone="purple" icon={<Activity size={18} />} /><MetricCard label="Detection threshold" value={settings.anomalyThreshold.toFixed(2)} detail="Project-configurable demo threshold" tone="blue" icon={<SlidersHorizontal size={18} />} /><MetricCard label="Prediction result" value={latest.anomaly ? 'ANOMALY' : 'NORMAL'} detail={`Operating: ${latest.load}% load · ${latest.rpm} rpm`} tone={latest.anomaly ? 'amber' : 'green'} icon={<BrainCircuit size={18} />} /></div><div className="ai-workflow"><span>14 features</span><i>→</i><span>Isolation Trees</span><i>→</i><span>Anomaly score</span><i>→</i><span>Threshold comparison</span><i>→</i><b>{latest.anomaly ? 'ANOMALY' : 'NORMAL'}</b></div><div className="chart-grid two"><ChartPanel title="Anomaly score trend" subtitle="Threshold line is project-configured"><ResponsiveContainer width="100%" height={255}><LineChart data={trend}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="time" {...axis} /><YAxis domain={[0, 1]} {...axis} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="anomalyScore" name="Score" stroke="#aa8bff" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey={() => settings.anomalyThreshold} name="Threshold" stroke="#f4b352" strokeDasharray="4 4" dot={false} /></LineChart></ResponsiveContainer></ChartPanel><ChartPanel title="Normal / anomaly distribution" subtitle="Selected demo data"><ResponsiveContainer width="100%" height={255}><PieChart><Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4}>{distribution.map((entry) => <Cell key={entry.name} fill={entry.name === 'Normal' ? '#28c9a3' : '#ef6a6a'} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend /></PieChart></ResponsiveContainer></ChartPanel><ChartPanel title="F01 versus F11" subtitle="Band A velocity RMS vs average 3-phase current"><ResponsiveContainer width="100%" height={255}><ScatterChart><CartesianGrid {...chartGrid} /><XAxis type="number" dataKey="bandA" name="F01" {...axis} /><YAxis type="number" dataKey="current" name="F11" {...axis} /><Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} /><Scatter name="Measurement" data={trend} fill="#55a9ff" /></ScatterChart></ResponsiveContainer></ChartPanel><ChartPanel title="Feature overview" subtitle="Normalized display for current window"><ResponsiveContainer width="100%" height={255}><BarChart data={featureOverview}><CartesianGrid {...chartGrid} vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#a98aff" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></ChartPanel></div><Card title="Recent anomaly events" subtitle="Demo-score events requiring further inspection"><div className="mini-table"><div><span>Timestamp</span><span>Score</span><span>Operating condition</span><span>Result</span></div>{recentAnomalies.length ? recentAnomalies.map((item) => <div key={item.id}><span>{formatTime(item.timestamp)}</span><b>{item.anomalyScore.toFixed(2)}</b><span>{item.load}% load · {item.rpm} rpm</span><StatusBadge compact status="WARNING" /></div>) : <p>No demo anomaly events in the selected dataset.</p>}</div><p className="disclaimer">A healthy baseline dataset, train/validation/test split and false-alarm evaluation are required before a real model can be claimed.</p></Card></>
}

interface Validation { fileName: string; total: number; valid: number; invalid: number; issues: string[]; rows: Measurement[] }
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
      const missing = csvHeaders.filter((header) => !headers.includes(header))
      const issues: string[] = missing.length ? [`Missing required header(s): ${missing.join(', ')}`] : []
      const rows: Measurement[] = []
      let invalid = 0
      if (!missing.length) lines.forEach((line, index) => {
        const values = line.split(',').map((item) => item.trim())
        const get = (header: string) => values[headers.indexOf(header)] ?? ''
        const numeric = featureHeaders.every((header) => Number.isFinite(Number(get(header)))) && ['RPM', 'Load_Percent', 'Discharge_Pressure'].every((header) => Number.isFinite(Number(get(header))))
        if (!numeric || !get('Machine_ID') || !get('Timestamp') || !['P1', 'P2'].includes(get('Measurement_Point'))) { invalid += 1; return }
        rows.push({ id: `import-${index}`, timestamp: get('Timestamp'), machineId: get('Machine_ID'), point: get('Measurement_Point') as 'P1' | 'P2', rpm: Number(get('RPM')), load: Number(get('Load_Percent')), pressure: Number(get('Discharge_Pressure')), sensorStatus: get('Sensor_Status') === 'Offline' ? 'Offline' : 'Online', voltageA: 400, voltageB: 400, voltageC: 400, currentA: Number(get('F11_Average_3phase_Current_RMS')), currentB: Number(get('F11_Average_3phase_Current_RMS')), currentC: Number(get('F11_Average_3phase_Current_RMS')), bandA: Number(get('F01_Band_A_Velocity_RMS')), bandB: Number(get('F02_Band_B_Velocity_RMS')), acceleration: Number(get('F03_Acceleration_RMS')), accelerationPeak: Number(get('F04_Acceleration_Absolute_Peak')), crestFactor: Number(get('F05_Crest_Factor')), kurtosis: Number(get('F06_Pearson_Kurtosis')), oneX: Number(get('F07_1x_Velocity_RMS')), twoX: Number(get('F08_2x_Velocity_RMS')), envelopeRms: Number(get('F09_Envelope_RMS')), envelopePeak: Number(get('F10_Envelope_Spectral_Peak')), temperature: Number(get('F14_Housing_Temperature')), anomalyScore: 0, anomaly: false })
      })
      if (!lines.length) issues.push('Dataset contains no measurement rows.')
      if (invalid) issues.push(`${invalid} row(s) have missing or non-numeric required values.`)
      setValidation({ fileName: file.name, total: lines.length, valid: rows.length, invalid: invalid + (missing.length ? lines.length : 0), issues, rows })
    }
    reader.readAsText(file)
  }
  const downloadTemplate = () => {
    const blob = new Blob([`${csvHeaders.join(',')}\nAC-TSA-01,2026-11-22T08:00:00Z,P1,Radial,2960,72,7.1,Online,2.1,1.6,0.75,2.9,3.9,3.2,0.6,0.4,0.38,1.15,167.2,1.1,0.4,69.5\n`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'airguard-dataset-template.csv'; link.click(); URL.revokeObjectURL(url)
  }
  const display = measurements.filter((row) => row.machineId.toLowerCase().includes(query.toLowerCase()) || row.timestamp.toLowerCase().includes(query.toLowerCase())).slice((page - 1) * 8, page * 8)
  return <><PageTitle eyebrow="DATA PIPELINE" title="Dataset management"><div className="page-actions"><button className="outline-button" onClick={downloadTemplate}><Download size={16} />Download CSV template</button><button className="primary-button" onClick={() => fileRef.current?.click()}><Upload size={16} />Upload CSV</button><input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={parseFile} /></div></PageTitle><div className="dataset-rules"><FileUp /><div><b>Measurement window schema</b><span>One CSV row = one 10-second measurement window. Metadata identifies context and is never sent to Isolation Forest as a model feature.</span></div></div><div className="upload-zone" onClick={() => fileRef.current?.click()}><Upload size={28} /><h2>Upload condition-monitoring CSV</h2><p>Validate headers, data type and missing values before import.</p><button className="outline-button">Choose CSV file</button><small>Required: Machine_ID, Timestamp, P1/P2 and F01–F14</small></div>{validation && <Card title="Validation result" subtitle={validation.fileName}><div className="validation-summary"><div><span>Total rows</span><b>{validation.total}</b></div><div className="good"><span>Valid rows</span><b>{validation.valid}</b></div><div className="bad"><span>Invalid rows</span><b>{validation.invalid}</b></div><div><span>Header status</span><b>{validation.issues.some((issue) => issue.startsWith('Missing')) ? 'Invalid' : 'Checked'}</b></div></div>{validation.issues.length > 0 ? <ul className="issues">{validation.issues.map((issue) => <li key={issue}><AlertTriangle size={15} />{issue}</li>)}</ul> : <div className="success-line"><Check size={17} />Headers and required values passed validation.</div>}<div className="panel-actions"><button className="outline-button" onClick={() => setValidation(null)}>Discard</button><button className="primary-button" disabled={!validation.valid} onClick={() => onImport(validation.rows)}><Database size={16} />Import {validation.valid} valid row(s)</button></div></Card>}<Card title="Imported / demo data preview" subtitle={`${measurements.length} measurement windows available in this browser session`} action={<input className="table-search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search machine or timestamp" />}><div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>Machine</th><th>Point</th><th>RPM</th><th>Load</th><th>Band A</th><th>Band B</th><th>Temperature</th><th>Sensor</th></tr></thead><tbody>{display.map((row) => <tr key={row.id}><td>{formatTime(row.timestamp)}</td><td>{row.machineId}</td><td><span className="point-tag">{row.point}</span></td><td>{row.rpm}</td><td>{row.load}%</td><td>{row.bandA} mm/s</td><td>{row.bandB} mm/s</td><td>{row.temperature} °C</td><td><span className="online">● Online</span></td></tr>)}</tbody></table></div><div className="pagination"><span>Page {page}</span><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button disabled={page * 8 >= measurements.length} onClick={() => setPage((current) => current + 1)}>Next</button></div></Card></>
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
  return <><PageTitle eyebrow="CONFIGURATION" title="System settings"><div className="page-actions"><button className="outline-button" onClick={() => setDraft(defaultSettings)}><RotateCcw size={16} />Restore defaults</button><button className="primary-button" onClick={() => onSave(draft)}><Save size={16} />Save settings</button></div></PageTitle><div className="settings-grid"><Card title="Machine"><div className="settings-fields"><Input label="Machine ID" field="machineId" /><Input label="Machine name" field="machineName" /><Input label="Rated power" field="ratedPower" unit="kW" /><Input label="Rated RPM" field="ratedRpm" unit="rpm" /></div></Card><Card title="Vibration — project-defined"><div className="settings-fields"><Input label="Band A warning" field="bandAWarn" unit="mm/s RMS" /><Input label="Band A high" field="bandAHigh" unit="mm/s RMS" /><Input label="Band B warning" field="bandBWarn" unit="mm/s RMS" /><Input label="Band B high" field="bandBHigh" unit="mm/s RMS" /><Input label="Band A healthy baseline" field="baselineBandA" unit="mm/s RMS" /><Input label="Band B healthy baseline" field="baselineBandB" unit="mm/s RMS" /></div><p className="disclaimer">These are project-defined review thresholds. Verified VDI configuration is intentionally separate and remains unconfigured.</p></Card><Card title="Electrical"><div className="settings-fields"><Input label="VUF review threshold" field="vufWarning" unit="%" /><Input label="Current unbalance review threshold" field="currentUnbalanceWarning" unit="%" /></div></Card><Card title="Temperature"><div className="settings-fields"><Input label="Warning threshold" field="temperatureWarning" unit="°C" /><Input label="Critical threshold" field="temperatureCritical" unit="°C" /></div></Card><Card title="AI anomaly detection"><div className="settings-fields"><Input label="Model version" field="modelVersion" /><Input label="Detection threshold" field="anomalyThreshold" /><Input label="Measurement window" field="measurementWindow" unit="seconds" /><Input label="Refresh interval" field="refreshInterval" unit="seconds" /></div><label className="setting-input"><span>Model status</span><select value={draft.modelStatus} onChange={(event) => set('modelStatus', event.target.value as Settings['modelStatus'])}><option>DEMO MODE</option><option>Connected</option></select></label></Card><Card title="Data persistence"><div className="storage-note"><Database /><div><b>Browser local storage enabled</b><p>Settings are saved on this device. Dataset import and alerts are kept for the current browser session.</p></div></div></Card></div></>
}

const tooltipStyle = { background: '#111d2d', border: '1px solid #314763', borderRadius: 8, color: '#e9f2fc', fontSize: 12 }

export default App
