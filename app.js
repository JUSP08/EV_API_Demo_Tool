const SAMPLE_PATH = "./sample-datalog.csv";

const COLORS = ["#35c2a6", "#5ea1d8", "#e0a04b", "#b09ade", "#df7fa2", "#a0b96d", "#d0825d"];
const OPERATION_COLORS = {
  error: "#ec6b62",
  security: "#c3a6ff",
  update: "#e0a04b",
  network: "#5ea1d8",
  runtime: "#78c7d7",
  config: "#35c2a6",
  control: "#a0b96d",
  boot: "#b09ade",
  system: "#91a29c",
};
const GAP_THRESHOLD_SECONDS = 40;
const CONTROL_MODE_COLUMN_INDEX = 17;
const CONTROL_MODE_LABELS = new Map([
  [0, "Position"],
  [1, "Flow"],
  [2, "Power"],
  [3, "DiffPress"],
  [99, "No Control"],
]);
const OPERATIONAL_KNOWLEDGE_BASE = [
  {
    source: "Belimo Energy Valve Application Guide",
    focus: "Application and hydronic interpretation",
    notes: [
      "Energy Valve combines characterized valve, actuator, flow measurement, water temperature sensing, power calculation, and application logic.",
      "Key troubleshooting context is hydronic behavior: oversupply, low delta T, coil saturation, insufficient authority, incorrect sizing, or control-mode mismatch can produce poor operation without a pure device fault.",
      "Common applications include air handling units, heat exchangers, fan coils, chilled beams, radiant heating/cooling, and district energy interfaces.",
      "Pressure-independent control and electronic optimization should be interpreted against the selected control mode and the commanded setpoint source.",
    ],
  },
  {
    source: "Differential Pressure Control with Belimo Energy Valve",
    focus: "Differential-pressure mode",
    notes: [
      "Differential pressure control requires a suitable water differential pressure sensor and correct installation of pulse lines/sensor range.",
      "The device can control differential pressure while still measuring flow and water temperatures, enabling correlation between pressure, flow, power, and energy.",
      "Relevant diagnostics include differential-pressure sensor type/range, setpoint, flow limitation, minimum flow behavior, sensor drift compensation, and shut-off function.",
      "When troubleshooting differential-pressure control, check whether flow falls below the minimum operating range and whether the behavior is start-up, limitation, sensor, or true hydronic demand.",
    ],
  },
  {
    source: "Belimo Energy Valve 4 Operating Manual",
    focus: "Operation, configuration, communication, and troubleshooting",
    notes: [
      "Energy Valve 4 supports flow control, power control, differential pressure control, position control, and Delta T Manager options.",
      "The built-in web server can expose overview, data, status, settings, version information, data logging, user administration, maintenance, and communication settings.",
      "Communication settings can include BACnet/IP, BACnet MS/TP, Modbus TCP, Modbus RTU, MP-secondary, cloud, IP, date/time, and certificates.",
      "Useful troubleshooting correlations include LED/power state, selected control mode, setpoint source, flow tolerance, feedback values, bus protocol changes, user/admin activity, and downloaded data logging.",
      "The device can provide up to 13 months of downloadable data, so trend CSV context should be treated as the primary operational record when available.",
    ],
  },
];
const UNIT_OPTIONS = {
  K: [
    ["K", (v) => v],
    ["C", (v) => v - 273.15],
    ["F", (v) => (v - 273.15) * 9 / 5 + 32],
  ],
  W: [
    ["W", (v) => v],
    ["kW", (v) => v / 1000],
    ["BTU/hr", (v) => v * 3.412142],
  ],
  Joule: [
    ["J", (v) => v],
    ["kWh", (v) => v / 3600000],
    ["MJ", (v) => v / 1000000],
    ["BTU", (v) => v / 1055.056],
  ],
  "m3/sec": [
    ["m3/s", (v) => v],
    ["L/s", (v) => v * 1000],
    ["L/min", (v) => v * 60000],
    ["GPM", (v) => v * 15850.323141],
  ],
  m3: [
    ["m3", (v) => v],
    ["L", (v) => v * 1000],
    ["gal", (v) => v * 264.172052],
  ],
  Pa: [
    ["Pa", (v) => v],
    ["kPa", (v) => v / 1000],
    ["psi", (v) => v / 6894.757293],
    ["inH2O", (v) => v / 249.08891],
  ],
  "%": [["%", (v) => v]],
};
const DEFAULT_DISPLAY_UNITS = {
  K: "F",
  "m3/sec": "GPM",
  m3: "gal",
  Pa: "psi",
};

const state = {
  metadata: [],
  files: [],
  headers: [],
  rows: [],
  columns: [],
  selected: new Set(),
  units: new Map(),
  zoom: null,
  plotSearch: "",
  hitPoints: [],
  hitStatusEvents: [],
  hitOperationEvents: [],
  plotBounds: null,
  dragZoom: null,
  debug: emptyDebugState(),
};

const els = {
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  sampleButton: document.getElementById("sampleButton"),
  clearDataButton: document.getElementById("clearDataButton"),
  resetZoomButton: document.getElementById("resetZoomButton"),
  datasetStats: document.getElementById("datasetStats"),
  statusOverlayToggle: document.getElementById("statusOverlayToggle"),
  operationsOverlayToggle: document.getElementById("operationsOverlayToggle"),
  plotColumnList: document.getElementById("plotColumnList"),
  plotColumnSearch: document.getElementById("plotColumnSearch"),
  selectedPlotCount: document.getElementById("selectedPlotCount"),
  recommendedPlotButton: document.getElementById("recommendedPlotButton"),
  clearPlotButton: document.getElementById("clearPlotButton"),
  tabButtons: document.querySelectorAll(".tab-button"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  canvas: document.getElementById("plotCanvas"),
  plotTooltip: document.getElementById("plotTooltip"),
  emptyState: document.getElementById("emptyState"),
  seriesTable: document.querySelector("#seriesTable tbody"),
  bitSummary: document.getElementById("bitSummary"),
  gapSummary: document.getElementById("gapSummary"),
  enumSummary: document.getElementById("enumSummary"),
  previewTable: document.getElementById("previewTable"),
  subtitle: document.getElementById("subtitle"),
  operationsStats: document.getElementById("operationsStats"),
  insightSummary: document.getElementById("insightSummary"),
  eventSummary: document.getElementById("eventSummary"),
  sourceSummary: document.getElementById("sourceSummary"),
  configSummary: document.getElementById("configSummary"),
  runtimeStats: document.getElementById("runtimeStats"),
  runtimeSummary: document.getElementById("runtimeSummary"),
  securitySummary: document.getElementById("securitySummary"),
  deviceSummary: document.getElementById("deviceSummary"),
  snapshotSummary: document.getElementById("snapshotSummary"),
  reliabilitySummary: document.getElementById("reliabilitySummary"),
  troubleshootingSummary: document.getElementById("troubleshootingSummary"),
  prioritySummary: document.getElementById("prioritySummary"),
  openRouterKey: document.getElementById("openRouterKey"),
  openRouterModel: document.getElementById("openRouterModel"),
  aiQuestion: document.getElementById("aiQuestion"),
  buildAiPayloadButton: document.getElementById("buildAiPayloadButton"),
  runAiAnalysisButton: document.getElementById("runAiAnalysisButton"),
  aiKnowledgeSummary: document.getElementById("aiKnowledgeSummary"),
  aiPayloadPreview: document.getElementById("aiPayloadPreview"),
  aiResult: document.getElementById("aiResult"),
};

const ctx = els.canvas.getContext("2d");

els.fileInput.addEventListener("change", (event) => {
  const files = [...event.target.files];
  if (files.length) readFiles(files, state.rows.length > 0);
  event.target.value = "";
});

els.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropZone.classList.add("dragging");
});

els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("dragging"));
els.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropZone.classList.remove("dragging");
  const files = [...event.dataTransfer.files];
  if (files.length) readFiles(files, state.rows.length > 0);
});

els.sampleButton.addEventListener("click", async () => {
  try {
    const response = await fetch(SAMPLE_PATH);
    if (!response.ok) throw new Error("Sample file could not be loaded from the browser.");
    loadCsv(await response.text(), "Workspace sample", false);
  } catch (error) {
    alert("Use the file picker to load a CSV, or run the app through the local server URL.");
  }
});

els.clearDataButton.addEventListener("click", () => {
  resetDataset();
  renderAll();
});

els.resetZoomButton.addEventListener("click", () => {
  state.zoom = null;
  drawPlot();
});

els.statusOverlayToggle.addEventListener("change", drawPlot);
els.operationsOverlayToggle.addEventListener("change", drawPlot);

els.plotColumnSearch.addEventListener("input", () => {
  state.plotSearch = els.plotColumnSearch.value.trim().toLowerCase();
  renderColumnList();
});

els.recommendedPlotButton.addEventListener("click", () => {
  state.selected = new Set(defaultSelectedColumns(state.columns));
  renderColumnList();
  drawPlot();
  renderSeriesTable();
});

els.buildAiPayloadButton.addEventListener("click", () => {
  renderAiPayloadPreview();
});

els.runAiAnalysisButton.addEventListener("click", runAiAnalysis);

els.clearPlotButton.addEventListener("click", () => {
  state.selected.clear();
  renderColumnList();
  drawPlot();
  renderSeriesTable();
});

els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    els.tabButtons.forEach((item) => item.classList.toggle("active", item === button));
    els.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
    if (tab === "trend") requestAnimationFrame(drawPlot);
  });
});

window.addEventListener("resize", drawPlot);
window.addEventListener("mouseup", endZoomDrag);
els.canvas.addEventListener("mousemove", handlePlotHover);
els.canvas.addEventListener("mouseleave", () => {
  if (!state.dragZoom) hidePlotTooltip();
});
els.canvas.addEventListener("mousedown", startZoomDrag);
els.canvas.addEventListener("mouseup", endZoomDrag);
els.canvas.addEventListener("wheel", handlePlotWheel, { passive: false });

function readFiles(files, append) {
  let remaining = files.length;
  const loaded = [];

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      loaded.push({ name: file.name, text: String(reader.result) });
      remaining -= 1;
      if (remaining === 0) {
        const csvFiles = loaded.filter((item) => isCsvLikeFile(item));
        const debugFiles = loaded.filter((item) => !isCsvLikeFile(item));
        csvFiles.forEach((item, index) => loadCsv(item.text, item.name, append || index > 0));
        if (debugFiles.length) loadDebugFiles(debugFiles);
      }
    };
    reader.readAsText(file);
  });
}

function isCsvLikeFile(file) {
  return /\.(csv|txt)$/i.test(file.name) && file.text.includes("Timestamp - UTC");
}

function loadCsv(text, filename, append = false) {
  const parsed = parseDatalogCsv(text);
  const previousSelected = new Set(state.selected);
  const previousUnits = new Map(state.units);

  if (append && state.rows.length) {
    const sameHeaders = parsed.headers.length === state.headers.length
      && parsed.headers.every((header, index) => header === state.headers[index]);
    if (!sameHeaders) {
      alert(`${filename} was not added because its columns do not match the loaded dataset.`);
      return;
    }

    state.rows = sortRowsByTime([...state.rows, ...parsed.rows]);
    state.files.push(filename);
  } else {
    state.metadata = parsed.metadata;
    state.headers = parsed.headers;
    state.rows = sortRowsByTime(parsed.rows);
    state.files = [filename];
  }

  state.columns = state.headers.map((header) => inferColumn(header, state.rows));
  state.selected = append && previousSelected.size
    ? new Set([...previousSelected].filter((header) => state.headers.includes(header)))
    : new Set(defaultSelectedColumns(state.columns));
  state.units = new Map();
  state.columns.forEach((column) => {
    state.units.set(column.header, previousUnits.get(column.header) ?? defaultUnit(column));
  });
  state.zoom = null;

  updateSubtitle();
  renderAll();
}

function loadDebugFiles(files) {
  files.forEach((file) => {
    const name = file.name.split(/[\\/]/).pop();
    const lower = name.toLowerCase();
    state.debug.files.push(name);

    try {
      if (lower === "debugdeviceinformation.json") {
        state.debug.deviceInfo = JSON.parse(file.text);
      } else if (lower === "alldatapoints.json") {
        state.debug.datapoints = JSON.parse(file.text);
      } else if (lower.startsWith("event.log")) {
        const parsed = parseEventLog(file.text, name);
        state.debug.events.push(...parsed.events);
        state.debug.configChanges.push(...parsed.configChanges);
      } else if (lower === "jvm_agent.log") {
        state.debug.jvmEvents.push(...parseJvmLog(file.text, name));
      } else if (lower === "bootslotjournal") {
        state.debug.bootSlot = parseBootSlotJournal(file.text);
      } else if (lower === "watchdog.counter") {
        state.debug.watchdogCounter = Number(file.text.trim());
      }
    } catch (error) {
      console.warn(`Could not parse ${name}`, error);
    }
  });

  state.debug.events.sort((a, b) => a.time - b.time);
  state.debug.configChanges.sort((a, b) => a.time - b.time);
  state.debug.jvmEvents.sort((a, b) => a.time - b.time);
  state.zoom = null;
  updateSubtitle();
  renderAll();
}

function parseEventLog(text, filename) {
  const records = parseCsv(text).filter((row) => row.length >= 5);
  const events = [];
  const configChanges = [];

  records.forEach((record) => {
    const time = Number(record[0]);
    if (!Number.isFinite(time)) return;
    const severity = record[1] || "System";
    const component = record[2] || "";
    const subcomponent = record[3] || "";
    const message = record.slice(4).join(",").trim();
    const category = categorizeEvent(severity, component, message);
    const event = { time, severity, component, subcomponent, message, category, file: filename };
    events.push(event);

    const change = parseConfigChange(event);
    if (change) configChanges.push(change);
  });

  return { events, configChanges };
}

function categorizeEvent(severity, component, message) {
  const text = `${severity} ${component} ${message}`.toLowerCase();
  if (severity === "Security") return "security";
  if (component.includes("NetworkInterfaceWatchdog")) return "network";
  if (/update|rauc|ipkg|firmware/.test(text)) return "update";
  if (/boot|modelexecutor|systemservice/.test(text)) return "boot";
  if (severity === "Error") return "error";
  if (component === "UnifiedDataAccess") return "config";
  return "system";
}

function parseConfigChange(event) {
  if (event.component !== "UnifiedDataAccess") return null;
  const match = event.message.match(/New value: '([^']+)'='([^']*)'\. Source: (.*)$/);
  if (!match) return null;
  return {
    time: event.time,
    path: match[1],
    value: match[2],
    source: match[3],
    event,
  };
}

function parseJvmLog(text, filename) {
  const events = [];
  text.split(/\r?\n/).forEach((line) => {
    const start = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) Starting agent version ([\d.]+)/);
    if (start) {
      events.push({
        time: parseLocalTimestamp(start[1]),
        category: "runtime",
        type: "start",
        label: `Agent ${start[2]} started`,
        version: start[2],
        message: line,
        file: filename,
      });
      return;
    }

    const gc = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) Full GC: (\d+) millis, Load (\d+) millis in (\d+) secs/);
    if (gc) {
      events.push({
        time: parseLocalTimestamp(gc[1]),
        category: "runtime",
        type: "gc",
        label: `Full GC ${gc[2]} ms, load ${gc[3]} ms`,
        gcMillis: Number(gc[2]),
        loadMillis: Number(gc[3]),
        windowSeconds: Number(gc[4]),
        message: line,
        file: filename,
      });
    }
  });
  return events.filter((event) => Number.isFinite(event.time));
}

function parseBootSlotJournal(text) {
  const values = {};
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^=#]+)=([^#]+)$/);
    if (match) values[match[1].trim()] = match[2].trim();
  });
  return values;
}

function parseLocalTimestamp(value) {
  return new Date(value.replace(" ", "T")).getTime();
}

function updateSubtitle() {
  const parts = [];
  if (state.files.length) parts.push(`${state.files.length} datalog file${state.files.length === 1 ? "" : "s"}`);
  if (state.debug.files.length) parts.push(`${state.debug.files.length} debug/support file${state.debug.files.length === 1 ? "" : "s"}`);
  els.subtitle.textContent = parts.length ? `${parts.join(" + ")} loaded` : "Load datalog CSVs and debug/support logs to correlate trends with system operations.";
}

function parseDatalogCsv(text) {
  const records = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ""));
  const headerIndex = detectHeaderIndex(records);
  const headers = records[headerIndex].map((h) => h.trim());
  const rows = records.slice(headerIndex + 1).map((record) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = record[index] ?? "";
    });
    return row;
  });
  return { metadata: records.slice(0, headerIndex), headers, rows };
}

function sortRowsByTime(rows) {
  if (!state.headers.includes("Timestamp - UTC") && !rows.some((row) => row["Timestamp - UTC"])) return rows;
  return [...rows].sort((a, b) => parseTimestamp(a["Timestamp - UTC"]) - parseTimestamp(b["Timestamp - UTC"]));
}

function resetDataset() {
  state.metadata = [];
  state.files = [];
  state.headers = [];
  state.rows = [];
  state.columns = [];
  state.selected = new Set();
  state.units = new Map();
  state.zoom = null;
  state.plotSearch = "";
  state.hitPoints = [];
  state.hitStatusEvents = [];
  state.hitOperationEvents = [];
  state.plotBounds = null;
  state.dragZoom = null;
  state.debug = emptyDebugState();
  els.plotColumnSearch.value = "";
  els.subtitle.textContent = "Load datalog CSVs and debug/support logs to correlate trends with system operations.";
}

function emptyDebugState() {
  return {
    files: [],
    deviceInfo: null,
    datapoints: null,
    events: [],
    configChanges: [],
    jvmEvents: [],
    bootSlot: null,
    watchdogCounter: null,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function detectHeaderIndex(records) {
  const timestampIndex = records.findIndex((row) => row.some((cell) => cell.trim() === "Timestamp - UTC"));
  if (timestampIndex >= 0) return timestampIndex;
  let best = 0;
  records.forEach((row, index) => {
    if (row.length > records[best].length) best = index;
  });
  return best;
}

function inferColumn(header, rows) {
  const values = rows.map((row) => row[header]).filter((value) => value !== "");
  const numericValues = values.map(Number).filter(Number.isFinite);
  const unique = [...new Set(numericValues.map((value) => String(value)))];
  const unit = parseUnit(header);
  const enumMap = parseEnum(header);
  const bitMap = parseBits(header);
  const registerId = header.includes(":") ? header.split(":")[0].trim() : "";
  const label = cleanLabel(header);
  const kind = header === "Timestamp - UTC"
    ? "timestamp"
    : bitMap.length
      ? "bitfield"
      : enumMap.size
        ? "enum"
        : numericValues.length === values.length
          ? unique.length <= 12 ? "state" : "numeric"
          : "text";

  return {
    header,
    registerId,
    label,
    unit,
    enumMap,
    bitMap,
    kind,
    uniqueCount: unique.length,
    numericValues,
  };
}

function parseUnit(header) {
  const name = header.includes(":") ? header.split(":").slice(1).join(":").trim() : header;
  if (name.endsWith("%") || name.endsWith("_%")) return "%";
  const match = name.match(/_([A-Za-z0-9/]+)$/);
  if (!match) return "";
  const candidate = match[1];
  if (["K", "W", "Pa", "Joule", "m3", "m3/sec"].includes(candidate)) return candidate;
  return "";
}

function parseEnum(header) {
  const map = new Map();
  const body = header.includes(":") ? header.split(":").slice(1).join(":") : header;
  const tokens = body.split("_").filter(Boolean);
  const isEnumStart = (token) => {
    const colon = token.match(/^(\d+):(.+)$/);
    if (colon) return Number(colon[1]) <= 255;
    return /^\d+$/.test(token) && Number(token) <= 255;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!isEnumStart(token)) continue;

    const colon = token.match(/^(\d+):(.+)$/);
    const code = Number(colon ? colon[1] : token);
    const labelParts = colon ? [colon[2]] : [];

    let cursor = index + 1;
    while (cursor < tokens.length && !isEnumStart(tokens[cursor])) {
      labelParts.push(tokens[cursor]);
      cursor += 1;
    }

    const label = labelParts.join(" ").replace(/\s+/g, " ").trim();
    if (label) map.set(code, label);
    index = cursor - 1;
  }
  return map;
}

function parseBits(header) {
  return [...header.matchAll(/Bit(\d+)_([^]*?)(?=_Bit\d+|$)/g)].map((match) => ({
    bit: Number(match[1]),
    label: match[2].replaceAll("_", " ").trim(),
  }));
}

function cleanLabel(header) {
  let label = header.includes(":") ? header.split(":").slice(1).join(":").trim() : header;
  label = label.replace(/_Bit\d+_.+$/, "");
  label = label.replace(/_(?:\d+:?[^_]+)+$/g, "");
  label = label.replace(/_[A-Za-z0-9/]+$/, (suffix) => {
    const raw = suffix.slice(1);
    return ["K", "W", "Pa", "Joule", "m3", "m3/sec"].includes(raw) ? "" : suffix;
  });
  return label.replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function defaultUnit(column) {
  const options = UNIT_OPTIONS[column.unit];
  if (!options) return column.unit;
  const preferred = DEFAULT_DISPLAY_UNITS[column.unit];
  return options.some(([unit]) => unit === preferred) ? preferred : options[0][0];
}

function defaultSelectedColumns(columns) {
  const preferred = [
    "12: RelativePosition_%",
    "2303: AbsoluteWaterFlow_m3/sec",
    "2304: AbsolutePower_W",
    "4313: SetAbsoluteDifferentialWaterPressureSetpoint_Pa",
    "4320: AbsoluteDifferentialWaterPressure_Pa",
    "2001: RelativeSetpoint_%",
  ];
  const selected = preferred.filter((header) => columns.some((column) => column.header === header));
  if (selected.length) return selected;
  return columns.filter(isPlottableColumn).slice(0, 3).map((column) => column.header);
}

function renderAll() {
  renderStats();
  renderOperations();
  renderConfig();
  renderRuntime();
  renderSecurity();
  renderSnapshot();
  renderAiKnowledgeSummary();
  renderColumnList();
  renderSeriesTable();
  renderBitSummary();
  renderGapSummary();
  renderEnumSummary();
  renderPreview();
  drawPlot();
}

function renderStats() {
  if (!state.rows.length) {
    els.datasetStats.innerHTML = statLine("Status", "Waiting for file");
    return;
  }
  const timestamps = state.rows.map((row) => row["Timestamp - UTC"]).filter(Boolean);
  const metadata = Object.fromEntries(state.metadata.map((row) => [row[0], row.slice(1).join(", ")]));
  els.datasetStats.innerHTML = [
    statLine("Files", state.files.length.toLocaleString()),
    statLine("Rows", state.rows.length.toLocaleString()),
    statLine("Columns", state.headers.length.toLocaleString()),
    statLine("Start", timestamps[0] ?? "n/a"),
    statLine("End", timestamps[timestamps.length - 1] ?? "n/a"),
    statLine("Serial", metadata["Serial Number"] ?? "n/a"),
  ].join("");
}

function statLine(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

function renderOperations() {
  const events = state.debug.events;
  const categories = countBy(events, (event) => event.category);
  const first = events[0]?.time;
  const last = events[events.length - 1]?.time;

  els.operationsStats.innerHTML = events.length ? [
    statLine("Debug files", state.debug.files.length.toLocaleString()),
    statLine("Events", events.length.toLocaleString()),
    statLine("Errors", events.filter((event) => event.severity === "Error").length.toLocaleString()),
    statLine("Security", events.filter((event) => event.severity === "Security").length.toLocaleString()),
    statLine("Network recoveries", (categories.network ?? 0).toLocaleString()),
    statLine("Range", `${formatShortDate(first)} to ${formatShortDate(last)}`),
  ].join("") : statLine("Status", "Waiting for debug files");

  const insights = buildInsights();
  els.insightSummary.className = insights.length ? "insight-list" : "insight-list muted";
  els.insightSummary.innerHTML = insights.length
    ? insights.map((line) => `<div class="insight-line"><strong>${escapeHtml(line.title)}</strong><span>${escapeHtml(line.detail)}</span></div>`).join("")
    : "No debug bundle loaded yet.";

  const latest = [...events].sort((a, b) => b.time - a.time).slice(0, 80);
  els.eventSummary.className = latest.length ? "event-list" : "event-list muted";
  els.eventSummary.innerHTML = latest.length
    ? latest.map(renderEventLine).join("")
    : "Load event logs to see system, error, and update events.";
}

function renderConfig() {
  const changes = state.debug.configChanges;
  const sources = countBy(changes, (change) => change.source);
  const paths = countBy(changes, (change) => change.path);

  els.sourceSummary.className = changes.length ? "summary-list" : "summary-list muted";
  els.sourceSummary.innerHTML = changes.length
    ? topEntries(sources, 12).map(([name, count]) => renderSummaryLine(name, `${count.toLocaleString()} changes`)).join("")
    : "No configuration changes loaded yet.";

  els.configSummary.className = changes.length ? "summary-list" : "summary-list muted";
  els.configSummary.innerHTML = changes.length
    ? topEntries(paths, 16).map(([name, count]) => renderSummaryLine(shortenPath(name), `${count.toLocaleString()} changes`)).join("")
    : "No UDA configuration changes found yet.";
}

function renderRuntime() {
  const runtime = state.debug.jvmEvents;
  const starts = runtime.filter((event) => event.type === "start");
  const gcs = runtime.filter((event) => event.type === "gc");
  const maxGc = Math.max(...gcs.map((event) => event.gcMillis), NaN);
  const maxLoad = Math.max(...gcs.map((event) => event.loadMillis), NaN);
  const versions = countBy(starts, (event) => event.version);

  els.runtimeStats.innerHTML = runtime.length ? [
    statLine("Agent starts", starts.length.toLocaleString()),
    statLine("Full GC events", gcs.length.toLocaleString()),
    statLine("Max GC", Number.isFinite(maxGc) ? `${maxGc.toLocaleString()} ms` : "n/a"),
    statLine("Max load", Number.isFinite(maxLoad) ? `${maxLoad.toLocaleString()} ms` : "n/a"),
    statLine("Versions", Object.keys(versions).join(", ") || "n/a"),
  ].join("") : statLine("Status", "Waiting for JVM log");

  const outliers = [...gcs].sort((a, b) => b.loadMillis - a.loadMillis).slice(0, 8);
  els.runtimeSummary.className = outliers.length ? "summary-list" : "summary-list muted";
  els.runtimeSummary.innerHTML = outliers.length
    ? outliers.map((event) => renderSummaryLine(formatFullX(event.time), `GC ${event.gcMillis} ms, load ${event.loadMillis} ms in ${event.windowSeconds} sec`)).join("")
    : "No JVM events loaded yet.";
}

function renderSecurity() {
  const securityEvents = state.debug.events.filter((event) => event.severity === "Security");
  const counts = countBy(securityEvents, (event) => event.message);
  els.securitySummary.className = securityEvents.length ? "summary-list" : "summary-list muted";
  els.securitySummary.innerHTML = securityEvents.length
    ? topEntries(counts, 20).map(([message, count]) => renderSummaryLine(message, `${count.toLocaleString()} occurrences`)).join("")
    : "No security events loaded yet.";
}

function renderSnapshot() {
  const info = state.debug.deviceInfo;
  if (!info) {
    els.deviceSummary.innerHTML = statLine("Status", "Waiting for debugDeviceInformation.json");
  } else {
    els.deviceSummary.innerHTML = [
      statLine("Serial", info.hardware?.["Serial number"] ?? "n/a"),
      statLine("Platform", info.hardware?.Platform ?? "n/a"),
      statLine("Active slot", info.software?.["Active Boot Slot"] ?? "n/a"),
      statLine("CSP", info.software?.["Csp Version"] ?? "n/a"),
      statLine("BSP", info.software?.["Bsp version"] ?? "n/a"),
      statLine("Dataprofile", `${info.deviceDataprofileStatus?.["Dataprofile ID"] ?? "n/a"} ${info.deviceDataprofileStatus?.["Dataprofile Version"] ?? ""}`.trim()),
      statLine("Export time", info.dateAndTime ?? "n/a"),
    ].join("");
  }

  const notable = noteworthyDatapoints();
  els.snapshotSummary.className = notable.length ? "summary-list" : "summary-list muted";
  els.snapshotSummary.innerHTML = notable.length
    ? notable.map(([name, value]) => renderSummaryLine(name, String(value))).join("")
    : "No allDatapoints.json loaded yet.";

  const reliability = buildReliabilitySummary();
  els.reliabilitySummary.className = reliability.length ? "summary-list" : "summary-list muted";
  els.reliabilitySummary.innerHTML = reliability.length
    ? reliability.map((item) => renderFindingLine(item)).join("")
    : "No allDatapoints.json loaded yet.";

  const troubleshooting = buildTroubleshootingSummary();
  els.troubleshootingSummary.className = troubleshooting.length ? "summary-list" : "summary-list muted";
  els.troubleshootingSummary.innerHTML = troubleshooting.length
    ? troubleshooting.map((item) => renderFindingLine(item)).join("")
    : "No allDatapoints.json loaded yet.";

  const priorities = buildPrioritizedFindings();
  els.prioritySummary.className = priorities.length ? "summary-list" : "summary-list muted";
  els.prioritySummary.innerHTML = priorities.length
    ? priorities.map((item) => renderFindingLine(item)).join("")
    : "No allDatapoints.json loaded yet.";
}

function renderAiKnowledgeSummary() {
  els.aiKnowledgeSummary.innerHTML = OPERATIONAL_KNOWLEDGE_BASE.map((entry) => `
    <div class="status-line">
      <strong>${escapeHtml(entry.source)}</strong>
      <span>${escapeHtml(entry.focus)} - ${entry.notes.length} summarized guidance points included in AI payload.</span>
    </div>
  `).join("");
}

function buildInsights() {
  const insights = [];
  const network = state.debug.events.filter((event) => event.category === "network");
  const updateErrors = state.debug.events.filter((event) => event.category === "update" && event.severity === "Error");
  const securityEvents = state.debug.events.filter((event) => event.severity === "Security");
  const starts = state.debug.jvmEvents.filter((event) => event.type === "start");
  const datapoints = state.debug.datapoints ?? {};

  if (network.length) insights.push({
    title: "Network recovery loop detected",
    detail: `${network.length.toLocaleString()} network watchdog recovery events were found.`,
  });
  if (updateErrors.length) insights.push({
    title: "Update failures present",
    detail: `${updateErrors.length.toLocaleString()} update-related errors can be overlaid with datalog trends.`,
  });
  if (securityEvents.length) insights.push({
    title: "Security exposure markers present",
    detail: `${securityEvents.length.toLocaleString()} security events report enabled privileged/support features.`,
  });
  if (starts.length) insights.push({
    title: "Runtime restart history available",
    detail: `${starts.length.toLocaleString()} JVM agent starts were parsed from the support log.`,
  });
  if (state.debug.watchdogCounter !== null) insights.push({
    title: "Watchdog counter parsed",
    detail: `Current watchdog counter value is ${state.debug.watchdogCounter}.`,
  });
  if (datapoints.collective_error === "true" || datapoints.collective_error === true) insights.push({
    title: "Current snapshot reports collective error",
    detail: "Use the Snapshot tab to inspect active flags and non-zero counters at export time.",
  });
  return insights;
}

function noteworthyDatapoints() {
  const datapoints = state.debug.datapoints;
  if (!datapoints) return [];
  return Object.entries(datapoints)
    .filter(([name, value]) => {
      const text = String(value);
      if (/^-?12345(?:\.0)?$/.test(text)) return false;
      if (/^(false|0|0\.0|null|)$/i.test(text)) return false;
      return /(err|error|not_ok|not_reached|watchdog|comm|alarm|warning|fault|collective|security|enabled|hours|days|-hrs|-days)/i.test(name);
    })
    .slice(0, 80);
}

function buildReliabilitySummary() {
  const dp = state.debug.datapoints;
  if (!dp) return [];
  const items = [];
  const add = (title, detail, severity = "system") => items.push({ title, detail, severity });
  const powerUps = numberFromDatapoint("OcPowerUpCounter");
  const uptime = numberFromDatapoint("OcUptime");
  const watchdogReboots = numberFromDatapoint("OcWatchdogRebootCounter");
  const watchdogFile = state.debug.watchdogCounter;
  const busTriggers = [
    ["Bus", "BusWatchdogTriggered"],
    ["BACnet/IP", "BacnetIpBusWatchdogTriggered"],
    ["BACnet MS/TP", "BacnetMstpBusWatchdogTriggered"],
    ["Modbus RTU", "ModbusRtuBusWatchdogTriggered"],
    ["Modbus TCP", "ModbusTcpBusWatchdogTriggered"],
    ["MP slave", "MpSlaveBusWatchdogTriggered"],
  ].map(([label, key]) => ({ label, key, value: numberFromDatapoint(key) })).filter((item) => Number.isFinite(item.value));

  if (Number.isFinite(powerUps)) add("Power-up counter", `${powerUps.toLocaleString()} recorded power-ups`, powerUps > 1 ? "update" : "system");
  if (Number.isFinite(uptime)) add("OC uptime", formatDuration(uptime), uptime < 3600 && powerUps > 1 ? "update" : "system");
  add("Active boot slot", stringFromDatapoint("OcActiveBootSlot") || state.debug.bootSlot?.["bootjournal.lastboot.slot"] || "n/a");
  add("Last successful boot slot", state.debug.bootSlot?.["bootjournal.lastsuccessfulboot.slot"] || "n/a");
  add("Power supply status", stringFromDatapoint("PowerSupplyStatus") || "n/a");
  add("Watchdog support", stringFromDatapoint("WatchdogSupported") || "n/a");
  if (Number.isFinite(watchdogReboots)) add("OC watchdog reboot counter", watchdogReboots.toLocaleString(), watchdogReboots ? "error" : "system");
  add("Last reboot by watchdog", stringFromDatapoint("OcLastRebootByWatchdog") || "n/a", stringFromDatapoint("OcLastRebootByWatchdog") === "true" ? "error" : "system");
  add("Last watchdog cause", stringFromDatapoint("OcLastWatchdogCause") || "None reported");
  if (watchdogFile !== null) add("watchdog.counter file", String(watchdogFile), watchdogFile ? "error" : "system");
  add("Watchdog timeouts", [
    `BACnet ${stringFromDatapoint("SetBacnetWatchdogTimeout") || "n/a"}s`,
    `Modbus ${stringFromDatapoint("SetModbusWatchdogTimeout") || "n/a"}s`,
    `MP ${stringFromDatapoint("SetMpSlaveWatchdogTimeout") || "n/a"}s`,
    `Any comm ${stringFromDatapoint("anyCommunicationWatchdogTimeout") || "n/a"}s`,
  ].join(", "));
  busTriggers.forEach((item) => {
    add(`${item.label} watchdog triggers`, item.value.toLocaleString(), item.value > 0 ? "error" : "system");
  });
  return items;
}

function buildTroubleshootingSummary() {
  const dp = state.debug.datapoints;
  if (!dp) return [];
  const items = [];
  const importantKeys = [
    "collective_error",
    "sensor_any_error_sl",
    "flow_sensor_not_ok",
    "flow_measurement_error_sl",
    "power_not_ok",
    "power_ok",
    "CollectiveMasterDeviceErrorStatus",
    "MasterDeviceErrorStatus",
    "MasterDeviceErrorStatusExtended",
    "CollectiveWaterFlowSensorDeviceErrorStatus",
    "NonPersistentWaterFlowSensorDeviceErrorStatus",
    "PersistentWaterFlowSensorDeviceErrorStatus",
    "OcErrorCounter",
    "OcWarnCounter",
    "CummulatedErrorCounter-TotalOccurences",
    "OcThreadCounter",
    "AliveCounter",
    "log-AliveCounter",
    "OcFlashWriteThresholdExceededCounter",
    "NfcEepromWriteThresholdExceededCounter",
    "statistics",
  ];
  importantKeys.forEach((key) => {
    const value = stringFromDatapoint(key);
    if (value !== "") items.push({ title: key, detail: value, severity: severityForDatapoint(key, value) });
  });

  const counters = Object.entries(dp)
    .filter(([key, value]) => /(?:ErrOccurance|Occur(?:a|e)nces|-hrs|-days)$/i.test(key) && isMeaningfulDatapointValue(value))
    .map(([key, value]) => ({ title: key, detail: String(value), severity: severityForDatapoint(key, value) }));
  return [...items, ...counters].slice(0, 120);
}

function buildPrioritizedFindings() {
  if (!state.debug.datapoints) return [];
  const findings = [];
  const add = (title, detail, severity = "system") => findings.push({ title, detail, severity });
  const powerUps = numberFromDatapoint("OcPowerUpCounter");
  const uptime = numberFromDatapoint("OcUptime");
  const watchdogReboots = numberFromDatapoint("OcWatchdogRebootCounter");
  const bacnetWatchdog = numberFromDatapoint("BacnetIpBusWatchdogTriggered");
  const networkRecoveries = state.debug.events.filter((event) => event.category === "network").length;
  const updateErrors = state.debug.events.filter((event) => event.category === "update" && event.severity === "Error").length;

  if (Number.isFinite(powerUps) && powerUps > 1 && Number.isFinite(uptime) && uptime < 3600) {
    add("Recent reboot after multiple power-ups", `Power-up counter is ${powerUps}, while uptime is only ${formatDuration(uptime)}. This suggests the export was taken soon after a restart/power cycle.`, "update");
  }
  if (watchdogReboots === 0 && stringFromDatapoint("OcLastRebootByWatchdog") === "false" && state.debug.watchdogCounter === 0) {
    add("No OC watchdog reboot evidence", "OC watchdog reboot counter, last-watchdog flag, and watchdog.counter file are all zero/false in this bundle.", "system");
  } else if ((watchdogReboots || 0) > 0 || state.debug.watchdogCounter > 0) {
    add("Watchdog reboot evidence found", `OC watchdog reboots: ${watchdogReboots}; watchdog.counter: ${state.debug.watchdogCounter}.`, "error");
  }
  if ((bacnetWatchdog || 0) > 0) {
    add("BACnet/IP bus watchdog triggered", `${bacnetWatchdog} BACnet/IP bus watchdog trigger(s) are reported even though OC watchdog reboots are not. Check bus supervision separately from system resets.`, "error");
  }
  if (networkRecoveries) {
    add("Network recovery loop in event log", `${networkRecoveries} network interface recovery events were parsed. Correlate these with bus watchdog triggers and communication gaps.`, "error");
  }
  if (stringFromDatapoint("collective_error") === "true") {
    add("Collective error active", `Master status ${stringFromDatapoint("MasterDeviceErrorStatus")} / extended ${stringFromDatapoint("MasterDeviceErrorStatusExtended")} with collective_error=true.`, "error");
  }
  if (stringFromDatapoint("flow_sensor_not_ok") === "true" || stringFromDatapoint("flow_measurement_error_sl") === "true") {
    add("Flow sensor / measurement fault path", `flow_sensor_not_ok=${stringFromDatapoint("flow_sensor_not_ok")}, flow_measurement_error_sl=${stringFromDatapoint("flow_measurement_error_sl")}, FlowMeasureError occurrences=${stringFromDatapoint("FlowMeasureError-ErrOccurance") || "0"}.`, "error");
  }
  if (numberFromDatapoint("NoComm2Actuator-ErrOccurance") > 0 || numberFromDatapoint("NoComm2Actuator-hrs") > 0) {
    add("Actuator communication issue recorded", `NoComm2Actuator occurrence=${stringFromDatapoint("NoComm2Actuator-ErrOccurance") || "0"}, hours=${stringFromDatapoint("NoComm2Actuator-hrs") || "0"}.`, "error");
  }
  if (stringFromDatapoint("power_not_ok") === "true") {
    add("Power status not OK", `power_not_ok=true while PowerControlStatus=${stringFromDatapoint("PowerControlStatus") || "n/a"} and RelativePower=${stringFromDatapoint("RelativePower") || "n/a"}.`, "update");
  }
  if (updateErrors) {
    add("Update failures exist in event log", `${updateErrors} update-related error events are available in the Operations tab.`, "update");
  }
  return findings;
}

function renderFindingLine(item) {
  return `
    <div class="status-line">
      <strong><span class="badge ${escapeAttr(item.severity || "system")}">${escapeHtml(item.severity || "system")}</span> ${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.detail)}</span>
    </div>
  `;
}

function stringFromDatapoint(key) {
  const value = state.debug.datapoints?.[key];
  return value === undefined || value === null ? "" : String(value);
}

function numberFromDatapoint(key) {
  const value = Number(stringFromDatapoint(key));
  return Number.isFinite(value) ? value : NaN;
}

function isMeaningfulDatapointValue(value) {
  const text = String(value);
  if (/^-?12345(?:\.0)?$/.test(text)) return false;
  if (/^(false|0|0\.0|null|)$/i.test(text)) return false;
  return true;
}

function severityForDatapoint(key, value) {
  const text = String(value).toLowerCase();
  if (/watchdog|error|err|not_ok|not_reached|fault|collective|comm|sensor/i.test(key) && isMeaningfulDatapointValue(value)) return "error";
  if (/warn|powerup|boot|uptime|power/i.test(key) && isMeaningfulDatapointValue(value)) return "update";
  if (text === "true" && /enabled|security|privileged|ssh|ipkg/i.test(key)) return "security";
  return "system";
}

function buildAiPayload() {
  const eventCounts = countBy(state.debug.events, (event) => event.category);
  const sourceCounts = countBy(state.debug.configChanges, (change) => change.source);

  return {
    schema: "dashboard-plus-ai-insights-v2",
    question: els.aiQuestion.value.trim(),
    analysisWorkflow: [
      "1. Treat trend CSV data as the primary operational timeline when present: check selected series statistics, gaps, status bit transitions, and trend/event alignment.",
      "2. Correlate event.log entries and jvm_agent.log runtime markers against the trend time axis: network recovery, update attempts, configuration changes, security state, JVM starts, and GC/load outliers.",
      "3. Use allDatapoints.json only after the timeline correlation as a current-state/export snapshot: power-up count, watchdog evidence, active flags, counters, and configuration state.",
      "4. Compare findings against the embedded Belimo Energy Valve operational knowledge base and separate device faults from hydronic/application behavior.",
      "5. Return prioritized insights with evidence, uncertainty, and next tests.",
    ],
    operationalKnowledgeBase: OPERATIONAL_KNOWLEDGE_BASE,
    trendFirstContext: buildTrendContextForAi(),
    eventAndRuntimeContext: {
      files: state.debug.files.filter((name) => /event\.log|jvm_agent/i.test(name)),
      eventCounts,
      topConfigSources: topEntries(sourceCounts, 10),
      networkRecoveryEvents: state.debug.events.filter((event) => event.category === "network").slice(-40).map(compactEvent),
      updateEvents: state.debug.events.filter((event) => event.category === "update").slice(-40).map(compactEvent),
      securityEvents: state.debug.events.filter((event) => event.category === "security").slice(-30).map(compactEvent),
      latestEvents: state.debug.events.slice(-60).map(compactEvent),
      jvm: summarizeJvmForPayload(),
    },
    snapshotContext: buildSnapshotContextForAi(),
  };
}

function buildTrendContextForAi() {
  const series = selectedSeries().map((item) => {
    const stats = summarize(item.points.map((point) => point.y));
    return {
      signal: item.column.label,
      unit: item.unit,
      min: formatForPayload(stats.min),
      max: formatForPayload(stats.max),
      mean: formatForPayload(stats.mean),
      first: formatForPayload(item.points[0]?.y),
      last: formatForPayload(item.points[item.points.length - 1]?.y),
      points: item.points.length,
      timeStart: item.points[0] ? formatFullX(item.points[0].x) : "",
      timeEnd: item.points[item.points.length - 1] ? formatFullX(item.points[item.points.length - 1].x) : "",
    };
  });

  return {
    files: state.files,
    rows: state.rows.length,
    columns: state.headers.length,
    selectedSeries: series,
    timestampGaps: getTimestampGaps().slice(0, 20).map((gap) => ({
      start: formatFullX(gap.start),
      end: formatFullX(gap.end),
      seconds: formatForPayload(gap.seconds),
    })),
    controlMode: {
      sourceColumn: getControlModeHeader(),
      legend: Object.fromEntries([...CONTROL_MODE_LABELS.entries()]),
      transitions: getControlModeEventsFromCsv().slice(0, 80).map((event) => ({
        time: formatFullX(event.time),
        value: event.modeValue,
        label: event.modeLabel,
      })),
    },
    statusEvents: getStatusEvents().slice(0, 60).map((event) => ({
      time: formatFullX(event.time),
      added: event.added,
      cleared: event.cleared,
      mask: event.mask,
    })),
  };
}

function buildSnapshotContextForAi() {
  return {
    device: {
      serial: state.debug.deviceInfo?.hardware?.["Serial number"] ?? "",
      platform: state.debug.deviceInfo?.hardware?.Platform ?? "",
      csp: state.debug.deviceInfo?.software?.["Csp Version"] ?? "",
      bsp: state.debug.deviceInfo?.software?.["Bsp version"] ?? "",
      activeBootSlot: state.debug.deviceInfo?.software?.["Active Boot Slot"] ?? stringFromDatapoint("OcActiveBootSlot"),
      dataprofile: state.debug.deviceInfo?.deviceDataprofileStatus ?? null,
      exportTime: state.debug.deviceInfo?.dateAndTime ?? "",
    },
    powerBootWatchdog: buildReliabilitySummary(),
    prioritizedFindings: buildPrioritizedFindings(),
    troubleshootingCounters: buildTroubleshootingSummary().slice(0, 100),
    notableDatapoints: noteworthyDatapoints().slice(0, 80).map(([name, value]) => ({ name, value })),
  };
}

function renderAiPayloadPreview() {
  const payload = buildAiPayload();
  els.aiPayloadPreview.textContent = JSON.stringify(payload, null, 2);
}

async function runAiAnalysis() {
  const apiKey = els.openRouterKey.value.trim();
  if (!apiKey) {
    els.aiResult.className = "ai-result";
    els.aiResult.textContent = "Enter an OpenRouter API key before running analysis.";
    return;
  }
  const payload = buildAiPayload();
  els.aiPayloadPreview.textContent = JSON.stringify(payload, null, 2);
  els.aiResult.className = "ai-result";
  els.aiResult.textContent = "Analyzing with OpenRouter...";
  els.runAiAnalysisButton.disabled = true;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Dashboard Plus",
      },
      body: JSON.stringify({
        model: els.openRouterModel.value.trim() || "openai/gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1600,
        messages: [
          {
            role: "system",
            content: "You are a senior embedded device support engineer for Belimo Energy Valve troubleshooting. Follow the provided analysisWorkflow exactly: trend CSV operation first, event.log and jvm_agent correlation second, allDatapoints snapshot third, then operational knowledge-base comparison. Be evidence-driven, mention uncertainty, separate hydronic/application behavior from device faults, and prioritize likely root causes and next tests.",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error?.message || `OpenRouter returned HTTP ${response.status}`);
    }
    els.aiResult.textContent = result.choices?.[0]?.message?.content || "No model content returned.";
  } catch (error) {
    els.aiResult.textContent = `AI analysis failed: ${error.message}`;
  } finally {
    els.runAiAnalysisButton.disabled = false;
  }
}

function compactEvent(event) {
  return {
    time: formatFullX(event.time),
    severity: event.severity,
    component: event.component,
    category: event.category,
    message: shorten(event.message, 220),
  };
}

function summarizeJvmForPayload() {
  const gcs = state.debug.jvmEvents.filter((event) => event.type === "gc");
  const starts = state.debug.jvmEvents.filter((event) => event.type === "start");
  return {
    starts: starts.length,
    versions: countBy(starts, (event) => event.version),
    fullGcEvents: gcs.length,
    maxGcMillis: Math.max(...gcs.map((event) => event.gcMillis), 0),
    maxLoadMillis: Math.max(...gcs.map((event) => event.loadMillis), 0),
    topLoadEvents: [...gcs].sort((a, b) => b.loadMillis - a.loadMillis).slice(0, 8).map((event) => ({
      time: formatFullX(event.time),
      gcMillis: event.gcMillis,
      loadMillis: event.loadMillis,
      windowSeconds: event.windowSeconds,
    })),
  };
}

function formatForPayload(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toPrecision(6));
}

function renderEventLine(event) {
  return `
    <div class="event-line">
      <strong>${escapeHtml(formatFullX(event.time))}</strong>
      <span class="badge ${escapeAttr(event.category)}">${escapeHtml(event.severity)} / ${escapeHtml(event.component || event.category)}</span>
      <span>${escapeHtml(shorten(event.message, 180))}</span>
    </div>
  `;
}

function renderSummaryLine(title, detail) {
  return `<div class="status-line"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
}

function renderColumnList() {
  const candidates = state.columns.filter(isPlottableColumn).filter(matchesPlotSearch);
  const groups = groupPlotColumns(candidates);
  els.selectedPlotCount.textContent = `${state.selected.size.toLocaleString()} selected`;
  els.plotColumnList.innerHTML = groups.map((group) => {
    if (!group.columns.length) return "";
    return `
      <section class="column-group">
        <div class="column-group-title">${escapeHtml(group.label)} <span>${group.columns.length.toLocaleString()}</span></div>
        <div class="column-group-items">
          ${group.columns.map((column) => renderColumnOption(column)).join("")}
        </div>
      </section>
    `;
  }).join("") || `<div class="muted">No matching signals.</div>`;

  els.plotColumnList.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.selected.add(input.dataset.column);
      else state.selected.delete(input.dataset.column);
      drawPlot();
      renderSeriesTable();
    });
  });

  els.plotColumnList.querySelectorAll(".unit-select").forEach((select) => {
    select.addEventListener("change", () => {
      state.units.set(select.dataset.column, select.value);
      drawPlot();
      renderSeriesTable();
    });
  });
}

function renderColumnOption(column) {
    const checked = state.selected.has(column.header) ? "checked" : "";
    const unitSelect = renderUnitSelect(column);
    return `
      <label class="column-row ${checked ? "selected" : ""}">
        <input type="checkbox" data-column="${escapeAttr(column.header)}" ${checked} />
        <span>
          <strong>${escapeHtml(column.label)}</strong>
          <span class="column-meta">
            ${column.registerId ? `<span class="column-chip">Reg ${escapeHtml(column.registerId)}</span>` : ""}
            <span class="column-chip">${escapeHtml(column.kind)}</span>
            ${column.unit ? `<span class="column-chip">${escapeHtml(column.unit)}</span>` : ""}
          </span>
          ${unitSelect}
        </span>
      </label>
    `;
}

function isPlottableColumn(column) {
  if (!["numeric", "state"].includes(column.kind)) return false;
  if (column.header === getControlModeHeader()) return false;
  const text = `${column.header} ${column.label}`.toLowerCase();
  return !/objectname|visible|button|override|password|certificate|audience|token|hash|serial/.test(text);
}

function matchesPlotSearch(column) {
  if (!state.plotSearch) return true;
  const haystack = `${column.header} ${column.label} ${column.registerId} ${column.unit} ${column.kind}`.toLowerCase();
  return state.plotSearch.split(/\s+/).every((term) => haystack.includes(term));
}

function groupPlotColumns(columns) {
  const selectedHeaders = new Set([
    "12: RelativePosition_%",
    "2303: AbsoluteWaterFlow_m3/sec",
    "2001: RelativeSetpoint_%",
    "2304: AbsolutePower_W",
    "4320: AbsoluteDifferentialWaterPressure_Pa",
    "4313: SetAbsoluteDifferentialWaterPressureSetpoint_Pa",
  ]);
  const groups = [
    { id: "recommended", label: "Recommended", columns: [] },
    { id: "hydronic", label: "Flow & Valve", columns: [] },
    { id: "power", label: "Power & Energy", columns: [] },
    { id: "temperature", label: "Temperature & Delta T", columns: [] },
    { id: "pressure", label: "Pressure", columns: [] },
    { id: "control", label: "Setpoints & Control", columns: [] },
    { id: "diagnostics", label: "Diagnostics", columns: [] },
    { id: "other", label: "Other Signals", columns: [] },
  ];
  const byId = Object.fromEntries(groups.map((group) => [group.id, group]));

  columns.forEach((column) => {
    if (selectedHeaders.has(column.header)) {
      byId.recommended.columns.push(column);
      return;
    }

    const text = `${column.header} ${column.label}`.toLowerCase();
    if (/error|fault|alarm|warning|watchdog|comm|not ok|not reached|status|counter/.test(text)) {
      byId.diagnostics.columns.push(column);
    } else if (/setpoint|control|maximum|minimum|forced|source|mode|range|analog|feedback/.test(text) || column.kind === "state") {
      byId.control.columns.push(column);
    } else if (/pressure|dp\b|differential/.test(text)) {
      byId.pressure.columns.push(column);
    } else if (/temperature|delta\s*t|deltat|\bdt\b|glycol|freeze/.test(text)) {
      byId.temperature.columns.push(column);
    } else if (/power|energy|load/.test(text)) {
      byId.power.columns.push(column);
    } else if (/flow|position|volume|actuator|valve/.test(text)) {
      byId.hydronic.columns.push(column);
    } else {
      byId.other.columns.push(column);
    }
  });

  groups.forEach((group) => {
    group.columns.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  });
  byId.recommended.columns.sort((a, b) => [...selectedHeaders].indexOf(a.header) - [...selectedHeaders].indexOf(b.header));
  return groups.filter((group) => group.columns.length);
}

function renderUnitSelect(column) {
  const options = UNIT_OPTIONS[column.unit];
  if (!options || options.length <= 1) return "";
  const current = state.units.get(column.header) ?? options[0][0];
  return `
    <select class="unit-select" data-column="${escapeAttr(column.header)}">
      ${options.map(([unit]) => `<option value="${escapeAttr(unit)}" ${unit === current ? "selected" : ""}>${escapeHtml(unit)}</option>`).join("")}
    </select>
  `;
}

function renderSeriesTable() {
  const series = selectedSeries();
  els.seriesTable.innerHTML = series.map((item) => {
    const stats = summarize(item.points.map((point) => point.y));
    return `
      <tr>
        <td>${escapeHtml(item.column.label)}</td>
        <td>${escapeHtml(item.unit || "")}</td>
        <td>${formatNumber(stats.min)}</td>
        <td>${formatNumber(stats.max)}</td>
        <td>${formatNumber(stats.mean)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="5" class="muted">Select one or more numeric columns.</td></tr>`;
}

function renderBitSummary() {
  const bitfields = state.columns.filter((column) => column.kind === "bitfield");
  if (!bitfields.length) {
    els.bitSummary.className = "bit-summary muted";
    els.bitSummary.textContent = "No bitfield found.";
    return;
  }

  const lines = [];
  bitfields.forEach((column) => {
    column.bitMap.forEach((bit) => {
      const count = state.rows.filter((row) => (Number(row[column.header]) & (1 << bit.bit)) !== 0).length;
      if (count > 0) {
        lines.push({ name: bit.label, bit: bit.bit, count, pct: count / state.rows.length * 100 });
      }
    });
  });

  els.bitSummary.className = "bit-summary";
  els.bitSummary.innerHTML = lines
    .sort((a, b) => b.count - a.count)
    .map((line) => `
      <div class="status-line">
        <strong>Bit ${line.bit}: ${escapeHtml(line.name)}</strong>
        <span>${line.count.toLocaleString()} rows - ${line.pct.toFixed(2)}%</span>
      </div>
    `).join("") || `<div class="muted">No active bits in this file.</div>`;
}

function renderGapSummary() {
  const timestamps = state.rows.map((row, index) => ({
    index,
    value: row["Timestamp - UTC"],
    time: parseTimestamp(row["Timestamp - UTC"]),
  })).filter((item) => Number.isFinite(item.time));

  if (timestamps.length < 2) {
    els.gapSummary.className = "gap-summary muted";
    els.gapSummary.textContent = "No timestamp data loaded yet.";
    return;
  }

  const intervals = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = timestamps[index - 1];
    const current = timestamps[index];
    const seconds = (current.time - previous.time) / 1000;
    if (seconds > GAP_THRESHOLD_SECONDS) {
      intervals.push({
        from: previous.value,
        to: current.value,
        seconds,
        missing: Math.max(0, Math.round(seconds / 30) - 1),
      });
    }
  }

  els.gapSummary.className = "gap-summary";
  if (!intervals.length) {
    els.gapSummary.innerHTML = `
      <div class="status-line">
        <strong>No gaps over ${GAP_THRESHOLD_SECONDS} seconds</strong>
        <span>${(timestamps.length - 1).toLocaleString()} timestamp intervals checked.</span>
      </div>
    `;
    return;
  }

  const largest = [...intervals].sort((a, b) => b.seconds - a.seconds).slice(0, 6);
  els.gapSummary.innerHTML = `
    <div class="status-line">
      <strong>${intervals.length.toLocaleString()} gaps over ${GAP_THRESHOLD_SECONDS} seconds</strong>
      <span>Estimated missing samples: ${intervals.reduce((sum, item) => sum + item.missing, 0).toLocaleString()}</span>
    </div>
    ${largest.map((gap) => `
      <div class="status-line">
        <strong>${formatDuration(gap.seconds)}</strong>
        <span>${escapeHtml(gap.from)} to ${escapeHtml(gap.to)} - ~${gap.missing} missing</span>
      </div>
    `).join("")}
  `;
}

function renderEnumSummary() {
  const enums = state.columns.filter((column) => column.kind === "enum");
  if (!enums.length) {
    els.enumSummary.className = "enum-summary muted";
    els.enumSummary.textContent = "No enumerations found.";
    return;
  }

  els.enumSummary.className = "enum-summary";
  els.enumSummary.innerHTML = enums.slice(0, 8).map((column) => {
    const seen = [...new Set(state.rows.map((row) => Number(row[column.header])))];
    const labels = seen.map((value) => `${value}: ${column.enumMap.get(value) ?? "Unknown"}`).join(", ");
    return `
      <div class="status-line">
        <strong>${escapeHtml(column.label)}</strong>
        <span>${escapeHtml(labels)}</span>
      </div>
    `;
  }).join("");
}

function renderPreview() {
  const rows = state.rows.slice(0, 20);
  const headers = state.headers.slice(0, 12);
  els.previewTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(shorten(header, 28))}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(shorten(row[header] ?? "", 32))}</td>`).join("")}</tr>`).join("")}
    </tbody>
  `;
}

function selectedSeries() {
  return [...state.selected].map((header, index) => {
    const column = state.columns.find((item) => item.header === header);
    if (!column) return null;
    const unit = state.units.get(header) ?? defaultUnit(column);
    const converter = converterFor(column, unit);
    const points = state.rows.map((row, rowIndex) => {
      const xValue = parseX(row["Timestamp - UTC"], rowIndex);
      const raw = Number(row[header]);
      return Number.isFinite(raw) ? { x: xValue, y: converter(raw), raw } : null;
    }).filter(Boolean);
    return {
      column,
      unit,
      color: COLORS[index % COLORS.length],
      points,
    };
  }).filter(Boolean);
}

function converterFor(column, unit) {
  const options = UNIT_OPTIONS[column.unit] ?? [[column.unit, (v) => v]];
  return options.find(([name]) => name === unit)?.[1] ?? ((v) => v);
}

function parseX(value, index) {
  const time = parseTimestamp(value);
  if (Number.isFinite(time)) return time;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : index;
}

function parseTimestamp(value) {
  return Date.parse(String(value).replace(" ", "T") + "Z");
}

function drawPlot() {
  fitCanvas();
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  state.hitPoints = [];
  state.hitStatusEvents = [];
  state.hitOperationEvents = [];
  hidePlotTooltip();
  const series = selectedSeries().filter((item) => item.points.length > 1);
  const operationLanes = els.operationsOverlayToggle.checked ? getOperationLanes() : [];
  const timelinePoints = operationLanes.flatMap((lane) => lane.events.map((event) => event.time));
  const allSeriesPoints = series.flatMap((item) => item.points);
  const xValues = [...allSeriesPoints.map((point) => point.x), ...timelinePoints].filter(Number.isFinite);
  els.emptyState.style.display = xValues.length ? "none" : "grid";
  if (!xValues.length) return;

  const statusLanes = els.statusOverlayToggle.checked ? getStatusLanes() : [];
  const statusHeight = statusLanes.length ? 36 + statusLanes.length * 22 : 0;
  const operationHeight = operationLanes.length ? 36 + operationLanes.length * 24 : 0;
  const margin = { top: 26, right: 22, bottom: 58 + statusHeight + operationHeight, left: 90 };
  const width = els.canvas.width - margin.left - margin.right;
  const height = Math.max(180, els.canvas.height - margin.top - margin.bottom);
  const fullXExtent = extent(xValues);
  padTimeExtent(fullXExtent);
  const xExtent = state.zoom ?? fullXExtent;
  const visibleSeries = series.map((item) => ({
    ...item,
    points: item.points.filter((point) => point.x >= xExtent[0] && point.x <= xExtent[1]),
  })).filter((item) => item.points.length > 1);
  const visiblePoints = visibleSeries.flatMap((item) => item.points);
  const visibleOperationEvents = operationLanes.flatMap((lane) => lane.events).filter((event) => event.time >= xExtent[0] && event.time <= xExtent[1]);
  if (!visiblePoints.length && !visibleOperationEvents.length) {
    state.zoom = null;
    drawPlot();
    return;
  }
  const yExtent = visiblePoints.length ? extent(visiblePoints.map((point) => point.y)) : [0, 1];
  padExtent(yExtent);
  state.plotBounds = { margin, width, height, xExtent, yExtent, fullXExtent };

  drawGapBands(margin, width, height, xExtent);
  drawGrid(margin, width, height, xExtent, yExtent);

  visibleSeries.forEach((item) => {
    ctx.beginPath();
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    item.points.forEach((point, index) => {
      const x = margin.left + (point.x - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
      const y = margin.top + height - (point.y - yExtent[0]) / (yExtent[1] - yExtent[0]) * height;
      state.hitPoints.push({ x, y, point, series: item });
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  drawStatusTimeline(statusLanes, margin, width, height, xExtent);
  drawOperationTimeline(operationLanes, margin, width, height, xExtent, statusLanes.length);
  drawZoomSelection();
  drawLegend(visibleSeries, margin);
}

function handlePlotHover(event) {
  if (state.dragZoom) {
    updateZoomDrag(event);
    return;
  }
  if (!state.hitPoints.length && !state.hitStatusEvents.length && !state.hitOperationEvents.length) return hidePlotTooltip();

  const rect = els.canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  const nearestStatus = nearestStatusEvent(mouseX, mouseY);
  if (nearestStatus) {
    drawPlot();
    drawStatusHoverMarker(nearestStatus);
    showStatusTooltip(nearestStatus, rect);
    return;
  }
  const nearestOperation = nearestOperationEvent(mouseX, mouseY);
  if (nearestOperation) {
    drawPlot();
    drawOperationHoverMarker(nearestOperation);
    showOperationTooltip(nearestOperation, rect);
    return;
  }

  let nearest = null;
  let nearestDistance = Infinity;

  state.hitPoints.forEach((hit) => {
    const dx = hit.x - mouseX;
    const dy = hit.y - mouseY;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearest = hit;
      nearestDistance = distance;
    }
  });

  if (!nearest || nearestDistance > 18) {
    hidePlotTooltip();
    drawPlot();
    return;
  }

  drawPlot();
  ctx.save();
  ctx.beginPath();
  ctx.arc(nearest.x, nearest.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = cssVar("--panel");
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = nearest.series.color;
  ctx.stroke();
  ctx.restore();

  const value = `${formatNumber(nearest.point.y)}${nearest.series.unit ? ` ${nearest.series.unit}` : ""}`;
  els.plotTooltip.innerHTML = `
    <strong>${escapeHtml(nearest.series.column.label)}</strong>
    <span>${escapeHtml(formatFullX(nearest.point.x))}</span>
    <span>${escapeHtml(value)}</span>
  `;

  const tooltipWidth = 230;
  const left = Math.min(rect.width - tooltipWidth - 10, Math.max(10, nearest.x + 12));
  const top = Math.max(10, nearest.y - 58);
  els.plotTooltip.style.left = `${left}px`;
  els.plotTooltip.style.top = `${top}px`;
  els.plotTooltip.style.display = "block";
}

function hidePlotTooltip() {
  els.plotTooltip.style.display = "none";
}

function startZoomDrag(event) {
  if (!state.plotBounds) return;
  const rect = els.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  if (!isInsidePlot(x, y)) return;
  state.dragZoom = { startX: x, currentX: x };
  hidePlotTooltip();
}

function updateZoomDrag(event) {
  if (!state.dragZoom) return;
  const rect = els.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  state.dragZoom.currentX = clamp(x, state.plotBounds.margin.left, state.plotBounds.margin.left + state.plotBounds.width);
  drawPlot();
}

function endZoomDrag(event) {
  if (!state.dragZoom || !state.plotBounds) return;
  updateZoomDrag(event);
  const { startX, currentX } = state.dragZoom;
  const distance = Math.abs(currentX - startX);
  state.dragZoom = null;
  if (distance < 12) {
    drawPlot();
    return;
  }

  const x1 = Math.min(startX, currentX);
  const x2 = Math.max(startX, currentX);
  const minTime = canvasXToTime(x1);
  const maxTime = canvasXToTime(x2);
  if (Number.isFinite(minTime) && Number.isFinite(maxTime) && maxTime > minTime) {
    state.zoom = [minTime, maxTime];
  }
  drawPlot();
}

function handlePlotWheel(event) {
  if (!state.plotBounds) return;
  const rect = els.canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;
  if (!isInsidePlot(mouseX, mouseY)) return;

  event.preventDefault();
  const { xExtent, fullXExtent } = state.plotBounds;
  const anchor = canvasXToTime(mouseX);
  const currentSpan = xExtent[1] - xExtent[0];
  const fullSpan = fullXExtent[1] - fullXExtent[0];
  const zoomFactor = event.deltaY < 0 ? 0.82 : 1.22;
  const nextSpan = clamp(currentSpan * zoomFactor, 60 * 1000, fullSpan);
  const anchorRatio = (anchor - xExtent[0]) / currentSpan;
  let nextMin = anchor - nextSpan * anchorRatio;
  let nextMax = nextMin + nextSpan;

  if (nextMin < fullXExtent[0]) {
    nextMin = fullXExtent[0];
    nextMax = nextMin + nextSpan;
  }
  if (nextMax > fullXExtent[1]) {
    nextMax = fullXExtent[1];
    nextMin = nextMax - nextSpan;
  }

  state.zoom = nextSpan >= fullSpan * 0.995 ? null : [nextMin, nextMax];
  drawPlot();
}

function isInsidePlot(x, y) {
  const { margin, width, height } = state.plotBounds;
  return x >= margin.left && x <= margin.left + width && y >= margin.top && y <= margin.top + height;
}

function canvasXToTime(x) {
  const { margin, width, xExtent } = state.plotBounds;
  return xExtent[0] + (x - margin.left) / width * (xExtent[1] - xExtent[0]);
}

function drawZoomSelection() {
  if (!state.dragZoom || !state.plotBounds) return;
  const { margin, height } = state.plotBounds;
  const x1 = Math.min(state.dragZoom.startX, state.dragZoom.currentX);
  const x2 = Math.max(state.dragZoom.startX, state.dragZoom.currentX);
  ctx.save();
  ctx.fillStyle = "rgba(94, 161, 216, 0.18)";
  ctx.strokeStyle = "rgba(94, 161, 216, 0.72)";
  ctx.lineWidth = 1;
  ctx.fillRect(x1, margin.top, x2 - x1, height);
  ctx.strokeRect(x1, margin.top, x2 - x1, height);
  ctx.restore();
}

function nearestStatusEvent(mouseX, mouseY) {
  let nearest = null;
  state.hitStatusEvents.forEach((hit) => {
    const insideX = mouseX >= hit.x1 && mouseX <= hit.x2;
    const insideY = mouseY >= hit.y1 && mouseY <= hit.y2;
    if (insideX && insideY) {
      nearest = hit;
    }
  });
  return nearest;
}

function nearestOperationEvent(mouseX, mouseY) {
  let nearest = null;
  state.hitOperationEvents.forEach((hit) => {
    const insideX = mouseX >= hit.x1 && mouseX <= hit.x2;
    const insideY = mouseY >= hit.y1 && mouseY <= hit.y2;
    if (insideX && insideY) nearest = hit;
  });
  return nearest;
}

function showStatusTooltip(hit, rect) {
  const title = hit.lane.id === "controlMode"
    ? `Control mode: ${hit.segment.label} (${hit.segment.value})`
    : `Bit ${hit.lane.bit}: ${hit.lane.label}`;
  els.plotTooltip.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(formatFullX(hit.segment.start))} to ${escapeHtml(formatFullX(hit.segment.end))}</span>
    <span>Active for ${escapeHtml(formatDuration((hit.segment.end - hit.segment.start) / 1000))}</span>
  `;
  const tooltipWidth = 250;
  const left = Math.min(rect.width - tooltipWidth - 10, Math.max(10, hit.x2 + 8));
  const top = Math.max(10, hit.y1 - 48);
  els.plotTooltip.style.left = `${left}px`;
  els.plotTooltip.style.top = `${top}px`;
  els.plotTooltip.style.display = "block";
}

function drawStatusHoverMarker(hit) {
  ctx.save();
  ctx.strokeStyle = cssVar("--danger");
  ctx.lineWidth = 2;
  ctx.strokeRect(hit.x1, hit.y1, hit.x2 - hit.x1, hit.y2 - hit.y1);
  ctx.restore();
}

function showOperationTooltip(hit, rect) {
  const event = hit.event;
  const title = event.label || `${event.severity ?? "Event"} / ${event.component ?? hit.lane.label}`;
  els.plotTooltip.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(formatFullX(event.time))}</span>
    <span>${escapeHtml(shorten(event.message ?? "", 180))}</span>
  `;
  const tooltipWidth = 270;
  const left = Math.min(rect.width - tooltipWidth - 10, Math.max(10, hit.x2 + 8));
  const top = Math.max(10, hit.y1 - 52);
  els.plotTooltip.style.left = `${left}px`;
  els.plotTooltip.style.top = `${top}px`;
  els.plotTooltip.style.display = "block";
}

function drawOperationHoverMarker(hit) {
  ctx.save();
  ctx.strokeStyle = OPERATION_COLORS[hit.lane.id] ?? cssVar("--muted");
  ctx.lineWidth = 2;
  ctx.strokeRect(hit.x1, hit.y1, hit.x2 - hit.x1, hit.y2 - hit.y1);
  ctx.restore();
}

function getTimestampGaps() {
  const timestamps = state.rows.map((row) => ({
    value: row["Timestamp - UTC"],
    time: parseTimestamp(row["Timestamp - UTC"]),
  })).filter((item) => Number.isFinite(item.time));

  const gaps = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = timestamps[index - 1];
    const current = timestamps[index];
    const seconds = (current.time - previous.time) / 1000;
    if (seconds > GAP_THRESHOLD_SECONDS) {
      gaps.push({
        start: previous.time,
        end: current.time,
        seconds,
      });
    }
  }
  return gaps;
}

function drawGapBands(margin, width, height, xExtent) {
  const gaps = getTimestampGaps().filter((gap) => gap.end >= xExtent[0] && gap.start <= xExtent[1]);
  if (!gaps.length) return;

  ctx.save();
  ctx.fillStyle = "rgba(236, 107, 98, 0.14)";
  gaps.forEach((gap) => {
    const start = Math.max(gap.start, xExtent[0]);
    const end = Math.min(gap.end, xExtent[1]);
    const x1 = margin.left + (start - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
    const x2 = margin.left + (end - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
    ctx.fillRect(x1, margin.top, Math.max(2, x2 - x1), height);
  });
  ctx.restore();
}

function getOperationLanes() {
  const lanes = [
    { id: "network", label: "Network recovery", events: state.debug.events.filter((event) => event.category === "network") },
    { id: "error", label: "Errors", events: state.debug.events.filter((event) => event.severity === "Error" && event.category !== "network") },
    { id: "update", label: "Updates", events: state.debug.events.filter((event) => event.category === "update") },
    { id: "security", label: "Security", events: state.debug.events.filter((event) => event.severity === "Security") },
    { id: "config", label: "Config changes", events: state.debug.configChanges.map((change) => ({ ...change.event, message: `${change.path} = ${change.value}`, source: change.source })) },
    { id: "runtime", label: "Runtime / GC", events: state.debug.jvmEvents.map((event) => ({ ...event, severity: "Runtime", component: event.type === "start" ? "JVM start" : "Full GC" })) },
    { id: "boot", label: "Boot / system", events: state.debug.events.filter((event) => event.category === "boot") },
  ];
  return lanes
    .map((lane) => ({ ...lane, events: lane.events.filter((event) => Number.isFinite(event.time)).sort((a, b) => a.time - b.time) }))
    .filter((lane) => lane.events.length);
}

function getControlModeEvents() {
  const events = getControlModeEventsFromCsv();
  const configEvents = getControlModeEventsFromConfig();
  return [...events, ...configEvents].sort((a, b) => a.time - b.time);
}

function getControlModeEventsFromCsv() {
  const events = [];
  let previous = null;
  getControlModeSamplesFromCsv().forEach((sample, index) => {
    if (index > 0 && sample.value === previous) return;
    const label = sample.label;
    const value = sample.value;
    const time = sample.time;
    if (index > 0 && value === previous) return;
    events.push({
      time,
      severity: "System",
      component: "CSV control mode",
      category: "control",
      modeValue: value,
      modeLabel: label,
      message: `Control mode ${label} (${value}) from CSV column R`,
    });
    previous = value;
  });
  return events;
}

function getControlModeEventsFromConfig() {
  return state.debug.configChanges
    .filter((change) => /SelectWaterControlMode/i.test(change.path))
    .map((change) => {
      const value = Number(change.value);
      const label = controlModeLabel(value);
      return {
        time: change.time,
        severity: "System",
        component: "Config control mode",
        category: "control",
        modeValue: value,
        modeLabel: label,
        message: `Control mode changed to ${label} (${change.value}) by ${change.source}`,
        source: change.source,
      };
    });
}

function getControlModeHeader() {
  if (!state.headers.length) return "";
  return state.headers.find((header) => /control.?mode|SelectWaterControlMode|WaterControlMode/i.test(header))
    || state.headers[CONTROL_MODE_COLUMN_INDEX]
    || "";
}

function controlModeLabel(value) {
  return CONTROL_MODE_LABELS.get(Number(value)) ?? `Unknown ${value}`;
}

function getStatusLanes() {
  const controlLane = getControlModeLane();
  const bitfield = state.columns.find((column) => column.kind === "bitfield");
  if (!bitfield) return controlLane ? [controlLane] : [];

  const samples = state.rows.map((row) => ({
    time: parseTimestamp(row["Timestamp - UTC"]),
    mask: Number(row[bitfield.header]),
  })).filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.mask));

  const bitLanes = bitfield.bitMap.map((bit) => {
    const segments = [];
    let activeStart = null;

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      const active = (sample.mask & (1 << bit.bit)) !== 0;
      if (active && activeStart === null) activeStart = sample.time;

      const next = samples[index + 1];
      const nextActive = next ? (next.mask & (1 << bit.bit)) !== 0 : false;
      if (activeStart !== null && (!nextActive || !next)) {
        const end = next ? next.time : sample.time;
        if (end > activeStart) segments.push({ start: activeStart, end });
        activeStart = null;
      }
    }

    return { bit: bit.bit, label: bit.label, segments };
  }).filter((lane) => lane.segments.length);
  return controlLane ? [controlLane, ...bitLanes] : bitLanes;
}

function getControlModeLane() {
  const samples = getControlModeSamplesFromCsv();
  if (!samples.length) return null;

  const segments = [];
  let active = null;
  samples.forEach((sample, index) => {
    const next = samples[index + 1];
    if (!active || active.value !== sample.value) {
      if (active && sample.time > active.start) {
        segments.push({
          start: active.start,
          end: sample.time,
          value: active.value,
          label: active.label,
        });
      }
      active = { start: sample.time, value: sample.value, label: sample.label };
    }
    if (!next && active) {
      const end = sample.time > active.start ? sample.time : active.start + 1;
      segments.push({ start: active.start, end, value: active.value, label: active.label });
    }
  });

  return segments.length ? { id: "controlMode", bit: "CM", label: "Control mode", segments } : null;
}

function getControlModeSamplesFromCsv() {
  const header = getControlModeHeader();
  if (!header) return [];
  return state.rows.map((row) => {
    const time = parseTimestamp(row["Timestamp - UTC"]);
    const value = Number(row[header]);
    return {
      time,
      value,
      label: controlModeLabel(value),
    };
  }).filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.value));
}

function getStatusEvents() {
  const bitfield = state.columns.find((column) => column.kind === "bitfield");
  if (!bitfield) return [];

  const events = [];
  let previousMask = 0;
  state.rows.forEach((row, index) => {
    const time = parseTimestamp(row["Timestamp - UTC"]);
    const mask = Number(row[bitfield.header]);
    if (!Number.isFinite(time) || !Number.isFinite(mask)) return;
    if (index === 0 && mask === 0) {
      previousMask = mask;
      return;
    }
    if (index > 0 && mask === previousMask) return;

    const addedMask = mask & ~previousMask;
    const clearedMask = previousMask & ~mask;
    const added = labelsForMask(bitfield, addedMask);
    const cleared = labelsForMask(bitfield, clearedMask);
    if (added.length || cleared.length) {
      events.push({ time, added, cleared, mask });
    }
    previousMask = mask;
  });
  return events;
}

function labelsForMask(bitfield, mask) {
  return bitfield.bitMap
    .filter((bit) => (mask & (1 << bit.bit)) !== 0)
    .map((bit) => bit.label);
}

function drawStatusTimeline(lanes, margin, width, height, xExtent) {
  if (!lanes.length) return;

  const top = margin.top + height + 40;
  const laneHeight = 18;
  const laneGap = 4;
  const labelX = 8;
  const colors = ["#e0a04b", "#d0825d", "#df7fa2", "#b09ade", "#5ea1d8", "#35c2a6"];

  ctx.save();
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillStyle = cssVar("--muted");
  ctx.fillText("Status and control state intervals", margin.left, top - 12);

  lanes.forEach((lane, laneIndex) => {
    const y = top + laneIndex * (laneHeight + laneGap);
    const color = colors[laneIndex % colors.length];
    ctx.fillStyle = cssVar("--panel-soft");
    ctx.fillRect(margin.left, y, width, laneHeight);

    ctx.fillStyle = cssVar("--muted");
    ctx.textAlign = "right";
    ctx.fillText(typeof lane.bit === "number" ? `B${lane.bit}` : lane.bit, margin.left - 8, y + 13);
    ctx.textAlign = "left";

    lane.segments
      .filter((segment) => segment.end >= xExtent[0] && segment.start <= xExtent[1])
      .forEach((segment) => {
        const start = Math.max(segment.start, xExtent[0]);
        const end = Math.min(segment.end, xExtent[1]);
        const x1 = margin.left + (start - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
        const x2 = margin.left + (end - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.82;
        ctx.fillRect(x1, y + 3, Math.max(3, x2 - x1), laneHeight - 6);
        ctx.globalAlpha = 1;
        if (lane.id === "controlMode") {
          ctx.fillStyle = "rgba(13, 20, 18, 0.78)";
          ctx.fillRect(x1 + 3, y + 4, Math.min(Math.max(0, x2 - x1 - 6), 86), laneHeight - 8);
          ctx.fillStyle = cssVar("--ink");
          ctx.fillText(shorten(segment.label, 14), x1 + 7, y + 13);
        }
        state.hitStatusEvents.push({ x1, x2: Math.max(x2, x1 + 3), y1: y + 2, y2: y + laneHeight - 2, lane, segment });
      });

    const label = shorten(lane.label, 34);
    ctx.fillStyle = "rgba(13, 20, 18, 0.78)";
    ctx.fillRect(labelX, y + 2, margin.left - 16, laneHeight - 4);
    ctx.fillStyle = cssVar("--ink");
    ctx.fillText(label, labelX + 4, y + 13);
  });
  ctx.restore();
}

function drawOperationTimeline(lanes, margin, width, height, xExtent, statusLaneCount) {
  if (!lanes.length) return;

  const statusOffset = statusLaneCount ? 36 + statusLaneCount * 22 : 0;
  const top = margin.top + height + 40 + statusOffset;
  const laneHeight = 20;
  const laneGap = 4;
  const labelX = 8;

  ctx.save();
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillStyle = cssVar("--muted");
  ctx.fillText("Operations overlay", margin.left, top - 12);

  lanes.forEach((lane, laneIndex) => {
    const y = top + laneIndex * (laneHeight + laneGap);
    const color = OPERATION_COLORS[lane.id] ?? OPERATION_COLORS.system;
    ctx.fillStyle = cssVar("--panel-soft");
    ctx.fillRect(margin.left, y, width, laneHeight);

    ctx.fillStyle = "rgba(13, 20, 18, 0.78)";
    ctx.fillRect(labelX, y + 2, margin.left - 16, laneHeight - 4);
    ctx.fillStyle = cssVar("--ink");
    ctx.fillText(shorten(lane.label, 32), labelX + 4, y + 14);

    lane.events
      .filter((event) => event.time >= xExtent[0] && event.time <= xExtent[1])
      .forEach((event) => {
        const x = margin.left + (event.time - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
        ctx.fillStyle = color;
        ctx.globalAlpha = event.severity === "Error" ? 0.96 : 0.78;
        ctx.beginPath();
        ctx.arc(x, y + laneHeight / 2, event.severity === "Error" ? 4.8 : 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (lane.id === "control") {
          ctx.fillStyle = cssVar("--ink");
          ctx.fillText(shorten(event.modeLabel ?? "", 14), x + 6, y + 14);
        }
        state.hitOperationEvents.push({ x1: x - 7, x2: x + 7, y1: y + 2, y2: y + laneHeight - 2, lane, event });
      });
  });
  ctx.restore();
}

function fitCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(320, Math.floor(rect.width * scale));
  els.canvas.height = Math.max(300, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  els.canvas.width = Math.floor(rect.width);
  els.canvas.height = Math.floor(rect.height);
}

function drawGrid(margin, width, height, xExtent, yExtent) {
  ctx.strokeStyle = cssVar("--canvas-grid");
  ctx.fillStyle = cssVar("--muted");
  ctx.lineWidth = 1;
  ctx.font = "12px Inter, system-ui, sans-serif";

  for (let i = 0; i <= 5; i += 1) {
    const y = margin.top + i / 5 * height;
    const value = yExtent[1] - i / 5 * (yExtent[1] - yExtent[0]);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + width, y);
    ctx.stroke();
    ctx.fillText(formatNumber(value), 10, y + 4);
  }

  for (let i = 0; i <= 5; i += 1) {
    const x = margin.left + i / 5 * width;
    const value = xExtent[0] + i / 5 * (xExtent[1] - xExtent[0]);
    ctx.beginPath();
    ctx.moveTo(x, margin.top);
    ctx.lineTo(x, margin.top + height);
    ctx.stroke();
    ctx.fillText(formatX(value), x - 34, margin.top + height + 28);
  }

  ctx.strokeStyle = cssVar("--canvas-axis");
  ctx.strokeRect(margin.left, margin.top, width, height);
}

function drawLegend(series, margin) {
  let x = margin.left;
  let y = 17;
  ctx.font = "12px Inter, system-ui, sans-serif";
  series.forEach((item) => {
    const label = `${item.column.label}${item.unit ? ` (${item.unit})` : ""}`;
    const width = ctx.measureText(label).width + 30;
    if (x + width > els.canvas.width - 20) {
      x = margin.left;
      y += 18;
    }
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - 9, 16, 3);
    ctx.fillStyle = cssVar("--ink");
    ctx.fillText(label, x + 22, y - 5);
    x += width + 14;
  });
}

function extent(values) {
  return [Math.min(...values), Math.max(...values)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function padExtent(ext) {
  if (ext[0] === ext[1]) {
    ext[0] -= 1;
    ext[1] += 1;
    return;
  }
  const pad = (ext[1] - ext[0]) * 0.08;
  ext[0] -= pad;
  ext[1] += pad;
}

function padTimeExtent(ext) {
  if (ext[0] === ext[1]) {
    ext[0] -= 60 * 60 * 1000;
    ext[1] += 60 * 60 * 1000;
    return;
  }
  const pad = Math.max(60 * 1000, (ext[1] - ext[0]) * 0.02);
  ext[0] -= pad;
  ext[1] += pad;
}

function summarize(values) {
  if (!values.length) return { min: NaN, max: NaN, mean: NaN };
  const sum = values.reduce((total, value) => total + value, 0);
  return { min: Math.min(...values), max: Math.max(...values), mean: sum / values.length };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 100000 || Math.abs(value) < 0.01 && value !== 0) return value.toExponential(3);
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatX(value) {
  if (value > 946684800000) {
    return new Date(value).toISOString().slice(11, 19);
  }
  return formatNumber(value);
}

function formatFullX(value) {
  if (value > 946684800000) {
    return new Date(value).toISOString().replace("T", " ").slice(0, 19);
  }
  return formatNumber(value);
}

function formatShortDate(value) {
  if (!Number.isFinite(value)) return "n/a";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDuration(seconds) {
  if (seconds < 90) return `${seconds.toFixed(0)} sec`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(2)} hr`;
}

function shorten(value, length) {
  const text = String(value);
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function shortenPath(path) {
  const parts = String(path).split("/");
  return parts.length > 3 ? `.../${parts.slice(-3).join("/")}` : String(path);
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || "Unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function topEntries(counts, limit) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

renderAll();
