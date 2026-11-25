# AirGuard Condition Monitoring

Condition monitoring and predictive maintenance prototype for the **airend of an oil-injected twin-screw air compressor**.

## Prototype scope

- Industrial SCADA-style dashboard with responsive navigation
- Vibration, electrical and bearing-housing temperature monitoring
- VDI 3836 vibration zone comparison and point-specific example ALARM calculation
- Overview PdM trends for Band A/B vibration and bearing housing temperature, with short-term time-to-threshold estimates
- Isolation Forest **demo-mode** anomaly score visualisation
- Engineering evidence and suggested inspections for fault diagnosis
- Repeatable Normal, Warning and Critical examples, alert history, local settings and CSV validation

## Presentation alignment · compressor slides 1–25

The application uses the machine from slides 5 and 16: **AC-01**, oil-injected twin-screw compressor airend, **55 kW** motor, **3,000 rpm** nominal, **10 bar(g)** operating pressure, and **9.3 m³/min** FAD. The old dashboard images on slides 19–21 show a 90 kW machine. The updated demo uses slide 5 for the machine specification and uses the screenshot vibration, temperature and score as illustrative case readings.

| Slides | Where to see the content |
| --- | --- |
| 1–11 | Overview identifies the airend case. Vibration shows P1 (DE) and P2 (NDE). Electrical covers P3 at the motor terminal box. F14 measures housing temperature near the bearing. |
| 12–13 | Vibration includes illustrative time waveform, FFT and envelope plots. Dataset and AI show the F01–F14 values with their original feature units. |
| 14–17 | AI shows the worked three-tree example and training/validation plan. Dataset shows the visible W01 and W02 features and a downloadable example of the two-part CSV schema. |
| 18 | Fault Diagnosis Support shows evidence, candidate signatures and human verification. |
| 19–21 | Select **Normal**, **Warning** or **Critical** in Overview. These give demo scores **0.19**, **0.82** and **0.77** at the default demo cut-off of **0.62**. Composite status also uses vibration and temperature. |
| 22–25 | Overview shows VDI/PdM and demo Isolation Forest separately. Fault Diagnosis Support covers verification, maintenance and a post-maintenance baseline comparison. References are listed below. |

The W02 worked example uses **F01 3.90 mm/s, F11 62 A, and F14 57.5 °C**. The F14 cells on slide 16 conflict with the stated temperature unit and worked example. The application leaves W01 temperature blank in that comparison and uses slide 15 for W02. The downloadable CSV contains a distinct simulated sample row with all 14 features.

The presentation CSV has **12 metadata columns and 14 feature columns**. The window ID, end time, sample rate and operating state complete the older eight metadata fields. Raw signal sample rate can be left blank when unavailable. F03, F04, F09 and F10 are in **m/s²**. Imports of the older eight-metadata format treat those four columns as **g** and convert them. Window metadata stays outside the 14-element feature vector.

## Important limitations

The built-in example uses simulated measurements and mock Isolation Forest scores. Real sensor integration, validated fault diagnosis, remaining life estimation and switch-off protection are outside the prototype scope.

In Overview, select **Show degradation demo** to see measured history, threshold lines, and a projected crossing. The projection fits a line to recent comparable readings from one measurement point and direction. Its horizon is limited to the observed fit duration (maximum seven days). The shaded planning range shows how the forecast changes with variation in the recent fit. It has no calibrated probability.

**Suggested inspection** subtracts the selected lead time (8, 24, or 48 hours) from the earliest estimated Warning. Once Warning is reached or falls within that lead time, the prototype suggests review now. The timing supports an inspection decision. Failure prediction, scheduling and work orders require separate validation and approval.

In Overview, select **Electrical unbalance · P3** to see a warning from the motor terminal box readings. The demo reaches approximately **3.00% VUF** and **8.06% current unbalance** against project settings of **2%** and **5%**. Electrical Monitoring shows the phase readings and both trends. Fault Diagnosis Support shows the two triggers and suggests comparing readings at P3 and upstream.

## VDI 3836 example

The 55 kW demo assumes a Group 3 screw airend without timing gears and radial housing readings during steady operation. System Settings can switch the example between rigid and resilient mounting. The two zone boundaries for each band come from **VDI 3836:2012 §4.1.2, Table 1**. For rigid mounting they are **8 / 12 mm/s RMS** for Band A and **3 / 4.5 mm/s RMS** for Band B.

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

The scope note on slide 9 needs an edition check. ISO 20816-3:2022 and :2026 list rotary compressors. VDI 3836 provides the screw-airend criteria for this case’s Band A/B comparison.

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
