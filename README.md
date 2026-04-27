# Dashboard Plus

Dashboard Plus is a static browser dashboard for correlating device datalog CSV trends with system-level debug and support logs.

It is based on the Device Datalog Dashboard and keeps the same no-build deployment model: open `index.html` through a local static server and load files from the browser.

## What It Loads

- Datalog CSV files with `Timestamp - UTC`
- `debugDeviceInformation.json`
- `allDatapoints.json`
- `data/log/event.log*`
- `data/log/jvm_agent.log`
- `data/log/bootSlotJournal`
- `data/log/watchdog.counter`

## Views

- Trend: selected datalog signals with status and operations overlays
- Operations: system events, errors, network recoveries, updates, and derived insights
- Config: UnifiedDataAccess changes grouped by source and datapoint path
- Runtime: JVM agent starts, full-GC events, and load outliers
- Security: support/security posture events
- Snapshot: device identity, power-up/watchdog/boot reliability checks, and prioritized all-datapoint troubleshooting findings
- AI Insights: optional OpenRouter-backed model analysis using a compact summary payload previewed in the browser
- Series, Dataset, Status, Enums, Preview: inherited datalog inspection tools

## Local Use

From this folder:

```powershell
python -m http.server 5178
```

Then open:

```text
http://127.0.0.1:5178/index.html
```

Drop one or more CSV files and/or support bundle files onto the upload area. The trend plot shares one time axis across datapoints and parsed operational events.

The AI Insights tab does not store an API key in the project. Enter an OpenRouter key in the browser, preview the compact payload, then run analysis when you want to send that summary to the model. The AI payload is ordered for troubleshooting: trend CSV operation first, event/JVM correlation second, and allDatapoints current-state context third. It also includes summarized local knowledge-base notes from the Belimo Energy Valve application guide, differential-pressure-control document, and EV 4 operating manual.
