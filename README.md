# Device Datalog Dashboard

Local static prototype for loading a device datalog CSV, plotting selected columns, applying unit conversions, and decoding enum/bitfield columns from the encoded headers.

## Run

The local server is currently running at:

```text
http://127.0.0.1:5177/index.html
```

If it is not running, start it from this folder:

```powershell
python -m http.server 5177 --bind 127.0.0.1
```

Then open the URL above.

## Current Features

- Drag/drop or file-picker CSV loading.
- Workspace sample loading from `sample-datalog.csv`.
- Automatic detection of the metadata rows and header row.
- Time-series plotting with `Timestamp - UTC` as the default X axis.
- Selectable numeric/state columns.
- Unit conversions for temperature, flow, power, energy, volume, and pressure.
- Raw, delta-from-first-sample, and rate-per-hour transforms.
- Enumeration decoding from headers like `Medium_0_Water_1_PropyleneGlycol`.
- Bitfield decoding for `MasterDeviceErrorStatus`.
- Dataset summary, selected-series stats, enum summary, status-bit summary, and preview table.

## Good Next Steps

- Add zoom and pan on the plot.
- Add CSV/XLSX support with SheetJS if Excel workbooks need to load directly.
- Move inferred column metadata into an editable JSON schema.
- Add separate state/event timeline views for bitfields and enums.
- Add export of plots and decoded data.
