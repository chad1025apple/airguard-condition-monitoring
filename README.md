# AirGuard Condition Monitoring

Condition monitoring and predictive maintenance prototype for the **airend of an oil-injected twin-screw air compressor**.

## Prototype scope

- Industrial SCADA-style dashboard with responsive navigation
- Vibration, electrical and bearing-housing temperature monitoring
- VDI 3836 vibration zone comparison and point-specific example ALARM calculation
- Overview PdM trends for Band A/B vibration and bearing housing temperature, with short-term time-to-threshold estimates
- Isolation Forest **demo-mode** anomaly score visualisation
- Engineering evidence and suggested inspections for fault diagnosis
- Demo data simulation, alert workflow, local settings persistence and CSV validation

## Important limitations

The built-in example uses simulated measurements and mock Isolation Forest scores. Real sensor integration, validated fault diagnosis, remaining life estimation and switch-off protection are outside the prototype scope.

The PdM projection estimates when a recent upward trend may reach the demo ALARM or the Zone II/III review boundary. It uses comparable readings from one measurement point and direction, up to the observed fit duration (maximum seven days). Use **Show degradation demo** in Overview to see an example.

## VDI 3836 example

The demo represents a 90 kW, Group 3 screw airend without timing gears, with radial housing readings during assumed steady operation. System Settings can switch the example between rigid and resilient mounting. The two zone boundaries for each band come from **VDI 3836:2012 §4.1.2, Table 1**. For rigid mounting they are **8 / 12 mm/s RMS** for Band A and **3 / 4.5 mm/s RMS** for Band B.

The operating **ALARM** follows §5.1. The prototype adds 25% of the Zone I upper boundary to the baseline for the selected point and band, subject to the 125% cap. Demo baselines must be positive and below the Zone I upper boundary. At P2 with rigid mounting, the default demo baselines of 2.1 and 1.6 mm/s give ALARMs of **4.10 mm/s (Band A)** and **2.35 mm/s (Band B)**. The prototype assigns critical review when a reading reaches the Zone II/III boundary. A machine-specific switch-off setting under §5.2 is unconfigured.

CSV readings are displayed without applying the built-in example limits. Real assessment requires the applicable compressor group, rated power, support type, measurement points and directions, verified Band A/B cutoffs and operating conditions, and a measured baseline per point and operating state. Airend housing temperature and electrical review limits in the demo are project settings.

## How the references apply

| Reference reviewed | Role in AirGuard |
| --- | --- |
| [VDI 3836:2012](https://www.vdi.de/fileadmin/pages/vdi_de/redakteure/richtlinien/inhaltsverzeichnisse/1866221.pdf), §§2, 4 and 5 | Airend housing vibration measurements, evaluation zones and operating limit guidance. |
| [ISO 17359:2018](https://www.iso.org/standard/71194.html), §§8.9, 8.10 and 9 | Condition monitoring program, initial alarms, stable baselines and trend comparison. |
| ISO 13373-1:2002, [ISO 13373-2:2016](https://www.iso.org/standard/68128.html) and [ISO 13373-3:2015](https://www.iso.org/standard/40840.html) | Measurement procedures, signal processing and evidence for vibration diagnostics. The FFT and envelope plots in AirGuard are illustrative. |
| ISO 13373-4:2021, -5:2020 and -7:2017 | Diagnostic guidance for specific equipment: turbines, fans/blowers and hydropower sets, respectively. Airend vibration zone values come from VDI 3836. |
| ISO 13373-9:2017, superseded by [ISO 13373-9:2026](https://www.iso.org/standard/86668.html) | Vibration diagnostics for the drive motor, a separate component from the airend. |
| IEC 60034-1:2010 and IEC 60034-26:2006 | Motor rating/performance and the effect of unbalanced supply voltage. The prototype computes demo VUF as the negative/positive sequence ratio from fundamental line-to-line RMS voltages assuming normal phase rotation (Part 26, §4 and Annex A). Imported F11–F13 retain their reported values. The current editions of [Part 1](https://webstore.iec.ch/en/publication/89961) and [Part 26](https://webstore.iec.ch/en/publication/95874) are from 2026. |
| ISO 13379:2003, supplied under a file name containing “13379 1” | Diagnostic interpretation and evidence. The current successor is [ISO 13379-1:2025](https://www.iso.org/standard/88027.html). |
| [ISO 1217:2009](https://www.iso.org/standard/44769.html), checked against the supplied Thai explainer | Acceptance and performance testing of displacement compressors. |
| ISO 20816-3:2022, superseded by [ISO 20816-3:2026](https://www.iso.org/standard/89922.html) | Broad-band vibration reference for covered industrial machinery, including rotary compressors. The demo’s two-band comparison uses VDI 3836. |

## Run locally

```powershell
pnpm install
pnpm dev
```

Open the local address printed by Vite, normally `http://localhost:5173`.

## Build

```powershell
pnpm build
```
