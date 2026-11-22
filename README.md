# AirGuard Condition Monitoring

Web application prototype for **AI-based condition monitoring and automated fault diagnosis** of an oil-injected twin-screw air compressor.

## Prototype scope

- Industrial SCADA-style dashboard with responsive navigation
- Vibration, electrical and bearing-housing temperature monitoring
- Project-configurable engineering-rule thresholds and healthy baselines
- Isolation Forest **demo-mode** anomaly score visualisation
- Evidence-led preliminary fault-candidate workflow requiring engineer verification
- Demo data simulation, alert workflow, local settings persistence and CSV validation

## Important limitations

This prototype uses simulated data and mock anomaly scores. It does not connect to real sensors, train or run a production Isolation Forest model, diagnose root cause automatically, predict remaining useful life, or command equipment shutdown.

VDI 3836 standard thresholds are deliberately displayed as `NOT CONFIGURED` until a verified configuration applicable to the machine and measurement arrangement is provided.

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
