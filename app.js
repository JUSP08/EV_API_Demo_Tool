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
const COMPARE_CANVAS_BASE_HEIGHT = 518;
const COMPARE_STATUS_LANE_STEP = 22;
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
  devices: [],
  files: [],
  headers: [],
  rows: [],
  columns: [],
  selected: new Set(),
  units: new Map(),
  zoom: null,
  plotSearch: "",
  compare: {
    signal: "",
    signals: [],
    alignment: "absolute",
    scale: "shared",
    expandedErrorDevices: new Set(),
  },
  hitPoints: [],
  hitStatusEvents: [],
  hitOperationEvents: [],
  compareHitPoints: [],
  compareStatusHits: [],
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
  navGroupButtons: document.querySelectorAll(".nav-group-button"),
  tabGroups: document.querySelectorAll(".tab-group"),
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
  compareSignalSelect: document.getElementById("compareSignalSelect"),
  compareSignalSelect2: document.getElementById("compareSignalSelect2"),
  compareSignalSelect3: document.getElementById("compareSignalSelect3"),
  compareAlignmentSelect: document.getElementById("compareAlignmentSelect"),
  compareScaleSelect: document.getElementById("compareScaleSelect"),
  compareDeviceCount: document.getElementById("compareDeviceCount"),
  compareReportSubtitle: document.getElementById("compareReportSubtitle"),
  compareSummary: document.getElementById("compareSummary"),
  comparePlots: document.getElementById("comparePlots"),
  compareTooltip: document.getElementById("compareTooltip"),
  exportComparePdfButton: document.getElementById("exportComparePdfButton"),
  exportComparePptButton: document.getElementById("exportComparePptButton"),
  operationsStats: document.getElementById("operationsStats"),
  insightSummary: document.getElementById("insightSummary"),
  eventSummary: document.getElementById("eventSummary"),
  sourceSummary: document.getElementById("sourceSummary"),
  configSummary: document.getElementById("configSummary"),
  configImpactSummary: document.getElementById("configImpactSummary"),
  runtimeStats: document.getElementById("runtimeStats"),
  runtimeSummary: document.getElementById("runtimeSummary"),
  securitySummary: document.getElementById("securitySummary"),
  deviceSummary: document.getElementById("deviceSummary"),
  snapshotSummary: document.getElementById("snapshotSummary"),
  reliabilitySummary: document.getElementById("reliabilitySummary"),
  controlHealthSummary: document.getElementById("controlHealthSummary"),
  faultPerspectiveSummary: document.getElementById("faultPerspectiveSummary"),
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

[els.compareSignalSelect, els.compareSignalSelect2, els.compareSignalSelect3].forEach((select, index) => {
  select.addEventListener("change", () => {
    state.compare.signals[index] = select.value;
    state.compare.signal = state.compare.signals[0] || "";
    renderCompare();
  });
});

els.compareAlignmentSelect.addEventListener("change", () => {
  state.compare.alignment = els.compareAlignmentSelect.value;
  renderCompare();
});

els.compareScaleSelect.addEventListener("change", () => {
  state.compare.scale = els.compareScaleSelect.value;
  renderCompare();
});

els.exportComparePdfButton.addEventListener("click", () => {
  prepareComparePrint();
  window.print();
});

els.exportComparePptButton.addEventListener("click", exportComparePowerPoint);

els.comparePlots.addEventListener("mousemove", handleCompareHover);
els.comparePlots.addEventListener("mouseleave", hideCompareTooltip);
els.comparePlots.addEventListener("click", handleComparePlotClick);

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

els.navGroupButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateGroup(button.dataset.group);
  });
});

els.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

function activateTab(tab) {
  const button = [...els.tabButtons].find((item) => item.dataset.tab === tab && !item.hidden);
  const group = button?.dataset.group;
  if (!button || !group) {
    activateTab(firstVisibleTab());
    return;
  }

  els.navGroupButtons.forEach((item) => item.classList.toggle("active", item.dataset.group === group));
  els.tabGroups.forEach((item) => item.classList.toggle("active", item.dataset.tabGroup === group));
  els.tabButtons.forEach((item) => item.classList.toggle("active", item === button));
  els.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
  if (tab === "trend") requestAnimationFrame(drawPlot);
  if (tab === "compare") requestAnimationFrame(renderCompare);
}

function activateGroup(group) {
  const groupButton = [...els.navGroupButtons].find((button) => button.dataset.group === group && !button.hidden);
  const preferred = groupButton?.dataset.defaultTab;
  const preferredButton = [...els.tabButtons].find((button) => button.dataset.tab === preferred && !button.hidden);
  const fallbackButton = [...els.tabButtons].find((button) => button.dataset.group === group && !button.hidden);
  activateTab((preferredButton || fallbackButton)?.dataset.tab || firstVisibleTab());
}

function updateNavigationAvailability() {
  els.tabButtons.forEach((button) => {
    button.hidden = !isTabAvailable(button.dataset.tab);
  });

  els.tabGroups.forEach((group) => {
    const hasVisibleTab = [...group.querySelectorAll(".tab-button")].some((button) => !button.hidden);
    group.hidden = !hasVisibleTab;
    group.classList.toggle("active", hasVisibleTab && group.classList.contains("active"));
  });

  els.navGroupButtons.forEach((button) => {
    const hasVisibleTab = [...els.tabButtons].some((tabButton) => tabButton.dataset.group === button.dataset.group && !tabButton.hidden);
    button.hidden = !hasVisibleTab;
  });

  const activeTab = document.querySelector(".tab-panel.active")?.dataset.panel;
  const activeButton = [...els.tabButtons].find((button) => button.dataset.tab === activeTab && !button.hidden);
  activateTab(activeButton?.dataset.tab || firstVisibleTab());
}

function firstVisibleTab() {
  return [...els.tabButtons].find((button) => !button.hidden)?.dataset.tab || "trend";
}

function isTabAvailable(tab) {
  const hasCsv = state.rows.length > 0;
  const hasDebugFiles = state.debug.files.length > 0;
  switch (tab) {
    case "trend":
      return true;
    case "compare":
      return state.devices.length > 1;
    case "series":
      return hasCsv;
    case "dataset":
      return hasCsv;
    case "status":
      return state.columns.some((column) => column.kind === "bitfield") || getStatusLanes().length > 0;
    case "enums":
      return state.columns.some((column) => column.enumMap?.size);
    case "preview":
      return hasCsv;
    case "snapshot":
      return Boolean(state.debug.deviceInfo || state.debug.datapoints || state.debug.bootSlot || state.debug.watchdogCounter !== null);
    case "operations":
      return state.debug.events.length > 0;
    case "config":
      return state.debug.configChanges.length > 0;
    case "runtime":
      return state.debug.jvmEvents.length > 0;
    case "security":
      return state.debug.events.some((event) => event.severity === "Security");
    case "ai":
      return hasCsv || hasDebugFiles;
    default:
      return true;
  }
}

window.addEventListener("resize", () => {
  drawPlot();
  requestAnimationFrame(() => drawComparePlots(compareRowsForSignals(selectedCompareSignals())));
});
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
  const loaded = new Array(files.length);

  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = () => {
      loaded[index] = { name: file.name, text: String(reader.result) };
      remaining -= 1;
      if (remaining === 0) {
        const readyFiles = loaded.filter(Boolean);
        const csvFiles = readyFiles.filter((item) => isCsvLikeFile(item));
        const debugFiles = readyFiles.filter((item) => !isCsvLikeFile(item));
        if (csvFiles.length) loadCsvBatch(csvFiles, append);
        if (debugFiles.length) loadDebugFiles(debugFiles);
      }
    };
    reader.readAsText(file);
  });
}

function isCsvLikeFile(file) {
  return /\.(csv|txt)$/i.test(file.name) && file.text.includes("Timestamp - UTC");
}

function loadCsvBatch(files, append = false) {
  const parsedFiles = files.map((file) => {
    const parsed = parseDatalogCsv(file.text);
    return {
      name: file.name,
      parsed,
      device: createDeviceDataset(parsed, file.name),
    };
  });
  if (!parsedFiles.length) return;

  const previousSelected = new Set(state.selected);
  const previousUnits = new Map(state.units);
  const hasExistingTrend = append && state.rows.length;
  const primaryHeaders = hasExistingTrend ? state.headers : parsedFiles[0].parsed.headers;
  const trendFiles = parsedFiles.filter((file) => headersMatch(file.parsed.headers, primaryHeaders));
  const compareOnlyFiles = parsedFiles.filter((file) => !headersMatch(file.parsed.headers, primaryHeaders));

  if (!hasExistingTrend) {
    const primary = trendFiles[0] ?? parsedFiles[0];
    state.metadata = primary.parsed.metadata;
    state.headers = primary.parsed.headers;
    state.rows = [];
    state.files = [];
    state.devices = [];
  }

  const compatibleTrendFiles = hasExistingTrend
    ? trendFiles
    : parsedFiles.filter((file) => headersMatch(file.parsed.headers, state.headers));

  const mergedRows = [...state.rows];
  compatibleTrendFiles.forEach((file) => {
    mergedRows.push(...file.parsed.rows);
    state.files.push(file.name);
    addOrMergeDevice(file.device);
  });
  state.rows = sortRowsByTimeWithHeaders(mergedRows, state.headers);

  const compareOnly = hasExistingTrend
    ? compareOnlyFiles
    : parsedFiles.filter((file) => !headersMatch(file.parsed.headers, state.headers));
  compareOnly.forEach((file) => addOrMergeDevice(file.device));
  if (compareOnly.length) {
    console.info(`${compareOnly.length} CSV file(s) had different columns and were added to Compare only.`);
  }

  refreshCsvStateAfterLoad(previousSelected, previousUnits, hasExistingTrend);
}

function loadCsv(text, filename, append = false) {
  const parsed = parseDatalogCsv(text);
  const previousSelected = new Set(state.selected);
  const previousUnits = new Map(state.units);
  const device = createDeviceDataset(parsed, filename);

  if (append && state.rows.length) {
    const sameHeaders = parsed.headers.length === state.headers.length
      && parsed.headers.every((header, index) => header === state.headers[index]);
    if (!sameHeaders) {
      addOrMergeDevice(device);
      refreshCsvStateAfterLoad(previousSelected, previousUnits, true);
      return;
    }

    state.rows = sortRowsByTime([...state.rows, ...parsed.rows]);
    state.files.push(filename);
    addOrMergeDevice(device);
  } else {
    state.metadata = parsed.metadata;
    state.headers = parsed.headers;
    state.rows = sortRowsByTime(parsed.rows);
    state.files = [filename];
    state.devices = [device];
  }

  refreshCsvStateAfterLoad(previousSelected, previousUnits, append);
}

function refreshCsvStateAfterLoad(previousSelected, previousUnits, append) {
  state.columns = state.headers.map((header) => inferColumn(header, state.rows));
  state.selected = append && previousSelected.size
    ? new Set([...previousSelected].filter((header) => state.headers.includes(header)))
    : new Set(defaultSelectedColumns(state.columns));
  if (!state.selected.size) state.selected = new Set(defaultSelectedColumns(state.columns));
  state.units = new Map();
  state.columns.forEach((column) => {
    state.units.set(column.header, previousUnits.get(column.header) ?? defaultUnit(column));
  });
  state.zoom = null;
  const compareHeaders = new Set(commonCompareSignals().map((signal) => signal.header));
  if (!state.compare.signals.length || state.compare.signals.every((header) => !compareHeaders.has(header))) {
    state.compare.signals = defaultCompareSignals();
    state.compare.signal = state.compare.signals[0] || "";
  }
  updateSubtitle();
  renderAll();
}

function headersMatch(headers, otherHeaders) {
  return headers.length === otherHeaders.length
    && headers.every((header, index) => header === otherHeaders[index]);
}

function createDeviceDataset(parsed, filename) {
  const metadata = Object.fromEntries(parsed.metadata.map((row) => [row[0], row.slice(1).join(", ")]));
  const serial = metadata["Serial Number"]
    || metadata["Serial number"]
    || metadata.Serial
    || inferSerialFromFilename(filename)
    || filename.replace(/\.[^.]+$/, "");
  const rows = sortRowsByTimeWithHeaders(parsed.rows, parsed.headers);
  return {
    id: serial,
    name: serial,
    files: [filename],
    metadata: parsed.metadata,
    headers: parsed.headers,
    rows,
    columns: parsed.headers.map((header) => inferColumn(header, rows)),
  };
}

function addOrMergeDevice(device) {
  const existing = state.devices.find((item) => item.id === device.id);
  if (!existing) {
    state.devices.push(device);
    return;
  }
  existing.files.push(...device.files);
  existing.rows = sortRowsByTimeWithHeaders([...existing.rows, ...device.rows], existing.headers);
  existing.columns = existing.headers.map((header) => inferColumn(header, existing.rows));
}

function inferSerialFromFilename(filename) {
  const match = filename.match(/\d{5}-\d{5}-\d{3}-\d{3}-\d{3}|\d{5}-\d{5}-\d{3}-\d{3}/);
  return match ? match[0] : "";
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

function sortRowsByTimeWithHeaders(rows, headers) {
  if (!headers.includes("Timestamp - UTC") && !rows.some((row) => row["Timestamp - UTC"])) return rows;
  return [...rows].sort((a, b) => parseTimestamp(a["Timestamp - UTC"]) - parseTimestamp(b["Timestamp - UTC"]));
}

function resetDataset() {
  state.metadata = [];
  state.devices = [];
  state.files = [];
  state.headers = [];
  state.rows = [];
  state.columns = [];
  state.selected = new Set();
  state.units = new Map();
  state.zoom = null;
  state.plotSearch = "";
  state.compare = { signal: "", signals: [], alignment: "absolute", scale: "shared", expandedErrorDevices: new Set() };
  state.hitPoints = [];
  state.hitStatusEvents = [];
  state.hitOperationEvents = [];
  state.compareHitPoints = [];
  state.compareStatusHits = [];
  state.plotBounds = null;
  state.dragZoom = null;
  state.debug = emptyDebugState();
  els.plotColumnSearch.value = "";
  hideCompareTooltip();
  els.compareSignalSelect.innerHTML = "";
  els.compareSignalSelect2.innerHTML = "";
  els.compareSignalSelect3.innerHTML = "";
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
  updateNavigationAvailability();
  renderStats();
  renderCompare();
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
  const debugIdentity = debugDeviceIdentityLines();
  els.datasetStats.innerHTML = [
    statLine("Files", state.files.length.toLocaleString()),
    statLine("Rows", state.rows.length.toLocaleString()),
    statLine("Columns", state.headers.length.toLocaleString()),
    statLine("Start", timestamps[0] ?? "n/a"),
    statLine("End", timestamps[timestamps.length - 1] ?? "n/a"),
    statLine("Serial", metadata["Serial Number"] ?? "n/a"),
    ...debugIdentity,
  ].join("");
}

function statLine(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

function debugDeviceIdentityLines() {
  if (!state.debug.deviceInfo) return [];
  const identity = deviceIdentityFields();
  return [
    ["Belimo String", identity.belimoString],
    ["Application", identity.applicationName],
  ]
    .filter(([, value]) => value !== "")
    .map(([label, value]) => statLine(label, value));
}

function deviceIdentityFields() {
  const info = state.debug.deviceInfo ?? {};
  const appVersion = [
    info.applicationModel?.["Application version"] ?? deviceInfoValue(["Application version", "ApplicationVersion"], [/application\s*version/i]),
    info.applicationModel?.["Version Qualifier"] ?? deviceInfoValue(["Version Qualifier", "VersionQualifier"], [/version\s*qualifier/i]),
  ].filter(Boolean).join(" ");
  return {
    serial: info.hardware?.["Serial number"] ?? deviceInfoValue(["Serial number", "SerialNumber"], [/serial\s*number/i]),
    belimoString: (info.hardware?.["Belimo String"] ?? deviceInfoValue(["Belimo String", "BelimoString"], [/belimo\s*string/i])).trim(),
    applicationName: info.applicationModel?.["Application name"] ?? deviceInfoValue(["Application name", "Application Name", "ApplicationName"], [/application\s*name/i]),
    applicationVersion: appVersion.trim(),
    platform: info.hardware?.Platform ?? deviceInfoValue(["Platform"], [/platform/i]),
    activeBootSlot: info.software?.["Active Boot Slot"] ?? deviceInfoValue(["Active Boot Slot", "ActiveBootSlot"], [/active\s*boot\s*slot/i]),
    csp: info.software?.["Csp Version"] ?? deviceInfoValue(["Csp Version", "CspVersion"], [/csp\s*version/i]),
    bsp: info.software?.["Bsp version"] ?? deviceInfoValue(["Bsp version", "BspVersion"], [/bsp\s*version/i]),
    dataprofile: `${info.deviceDataprofileStatus?.["Dataprofile ID"] ?? ""} ${info.deviceDataprofileStatus?.["Dataprofile Version"] ?? ""}`.trim(),
    exportTime: info.dateAndTime ?? "",
  };
}

function deviceInfoValue(exactKeys, fallbackPatterns) {
  const info = state.debug.deviceInfo;
  const normalizedKeys = exactKeys.map(normalizeJsonKey);
  const exact = findJsonValue(info, (key) => normalizedKeys.includes(normalizeJsonKey(key)));
  if (exact !== "") return exact;
  return findJsonValue(info, (key) => fallbackPatterns.some((pattern) => pattern.test(key)));
}

function findJsonValue(value, keyMatches) {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonValue(item, keyMatches);
      if (found !== "") return found;
    }
    return "";
  }
  for (const [key, child] of Object.entries(value)) {
    if (keyMatches(key) && child !== null && typeof child !== "object" && String(child).trim() !== "") {
      return String(child);
    }
    const found = findJsonValue(child, keyMatches);
    if (found !== "") return found;
  }
  return "";
}

function normalizeJsonKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function renderCompare() {
  const signals = commonCompareSignals();
  if (!signals.length || !state.devices.length) {
    state.compareHitPoints = [];
    state.compareStatusHits = [];
    hideCompareTooltip();
    els.compareDeviceCount.textContent = "0 EVs";
    els.compareSignalSelect.innerHTML = `<option value="">No common signals</option>`;
    els.compareSignalSelect2.innerHTML = `<option value="">No common signals</option>`;
    els.compareSignalSelect3.innerHTML = `<option value="">No common signals</option>`;
    els.compareSummary.className = "summary-list muted";
    els.compareSummary.textContent = "Load two or more EV trend CSVs to compare.";
    els.comparePlots.innerHTML = "";
    return;
  }

  const signalHeaders = new Set(signals.map((signal) => signal.header));
  if (!state.compare.signals.length) state.compare.signals = defaultCompareSignals();
  state.compare.signals = [0, 1, 2].map((index) => signalHeaders.has(state.compare.signals[index]) ? state.compare.signals[index] : "");
  if (!state.compare.signals[0]) state.compare.signals[0] = signals[0].header;
  state.compare.signal = state.compare.signals[0];

  renderCompareSignalSelect(els.compareSignalSelect, signals, state.compare.signals[0], false);
  renderCompareSignalSelect(els.compareSignalSelect2, signals, state.compare.signals[1], true);
  renderCompareSignalSelect(els.compareSignalSelect3, signals, state.compare.signals[2], true);
  els.compareAlignmentSelect.value = state.compare.alignment;
  els.compareScaleSelect.value = state.compare.scale;
  els.compareDeviceCount.textContent = `${state.devices.length.toLocaleString()} EV${state.devices.length === 1 ? "" : "s"}`;

  const rows = compareRowsForSignals(selectedCompareSignals());
  els.compareSummary.className = "summary-list";
  els.compareSummary.innerHTML = renderCompareSummary(rows);
  els.comparePlots.innerHTML = rows.map((row, index) => {
    const errorDetailLanes = getCompareErrorDetailLanes(row.device);
    const errorExpanded = isCompareErrorExpanded(row.device);
    const canvasHeight = compareCanvasHeight(row.device);
    return `
      <div class="compare-row">
        <div class="compare-meta">
          <strong>${escapeHtml(`Serial: ${row.device.name}`)}</strong>
          <span class="compare-file-line" title="${escapeAttr(compareFullFileLabel(row.device))}">${escapeHtml(compareFileLabel(row.device))}</span>
          <span>${escapeHtml(`Samples: ${row.points.length.toLocaleString()}`)}</span>
          <span>${escapeHtml(`Date: ${row.rangeLabel}`)}</span>
          ${errorDetailLanes.length ? `
            <button class="compare-expand-button" type="button" data-device-id="${escapeAttr(row.device.id)}" aria-expanded="${errorExpanded ? "true" : "false"}">
              <span class="compare-caret" aria-hidden="true"></span>
              <span>Error detail</span>
              <span>${errorDetailLanes.length}</span>
            </button>
          ` : ""}
        </div>
        <canvas class="compare-canvas" data-compare-index="${index}" height="${canvasHeight}" style="--compare-canvas-height: ${canvasHeight}px"></canvas>
      </div>
    `;
  }).join("");
  requestAnimationFrame(() => drawComparePlots(rows));
}

function compareExpandedErrorDevices() {
  if (!(state.compare.expandedErrorDevices instanceof Set)) {
    state.compare.expandedErrorDevices = new Set();
  }
  return state.compare.expandedErrorDevices;
}

function isCompareErrorExpanded(device) {
  return compareExpandedErrorDevices().has(device.id);
}

function compareCanvasHeight(device) {
  const expandedLaneCount = isCompareErrorExpanded(device) ? getCompareErrorDetailLanes(device).length : 0;
  return COMPARE_CANVAS_BASE_HEIGHT + expandedLaneCount * COMPARE_STATUS_LANE_STEP;
}

function compareFileLabel(device) {
  const files = [...new Set(device.files)];
  if (!files.length) return "File: n/a";
  if (files.length === 1) return `File: ${files[0]}`;
  return `Files: ${files[0]} +${files.length - 1} more`;
}

function compareFullFileLabel(device) {
  const files = [...new Set(device.files)];
  return files.length ? `Files: ${files.join(", ")}` : "Files: n/a";
}

function compareReportMetaLine(row) {
  return [
    `Serial: ${row.device.name}`,
    compareFileLabel(row.device),
    `Samples: ${row.points.length.toLocaleString()}`,
    `Date: ${row.rangeLabel}`,
  ].join(" | ");
}

function prepareComparePrint() {
  const signals = selectedCompareSignals()
    .map((header) => commonCompareSignals().find((signal) => signal.header === header)?.label)
    .filter(Boolean);
  els.compareReportSubtitle.textContent = [
    `${state.devices.length.toLocaleString()} EV${state.devices.length === 1 ? "" : "s"}`,
    signals.length ? `Signals: ${signals.join(", ")}` : "No signals selected",
    state.compare.alignment === "relative" ? "Relative start alignment" : "Absolute time alignment",
    new Date().toLocaleString(),
  ].join(" | ");
  drawComparePlots(compareRowsForSignals(selectedCompareSignals()));
}

async function exportComparePowerPoint() {
  const rows = compareRowsForSignals(selectedCompareSignals());
  if (!rows.length) {
    alert("Load two or more EV trend CSVs and select at least one common signal before exporting PowerPoint.");
    return;
  }

  const originalText = els.exportComparePptButton.textContent;
  els.exportComparePptButton.disabled = true;
  els.exportComparePptButton.textContent = "Building PPTX...";

  try {
    drawComparePlots(rows);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const canvases = [...document.querySelectorAll(".compare-canvas")];
    const slides = rows.map((row, index) => {
      const canvas = canvases[index];
      if (!canvas) return null;
      return {
        title: "EV Trend Comparison",
        meta: compareReportMetaLine(row),
        imageBytes: dataUrlToBytes(canvas.toDataURL("image/png")),
      };
    }).filter(Boolean);

    if (!slides.length) throw new Error("No Compare graph canvases were available to export.");
    const blob = createComparePptx(slides);
    downloadBlob(blob, `ev-trend-comparison-${fileDateStamp()}.pptx`);
  } catch (error) {
    console.error(error);
    alert(`PowerPoint export failed: ${error.message}`);
  } finally {
    els.exportComparePptButton.disabled = false;
    els.exportComparePptButton.textContent = originalText;
  }
}

function createComparePptx(slides) {
  const entries = [];
  const addText = (name, text) => entries.push({ name, data: encodeUtf8(text) });
  const addBytes = (name, data) => entries.push({ name, data });

  addText("[Content_Types].xml", pptContentTypesXml(slides.length));
  addText("_rels/.rels", pptRootRelsXml());
  addText("docProps/core.xml", pptCoreXml());
  addText("docProps/app.xml", pptAppXml(slides.length));
  addText("ppt/presentation.xml", pptPresentationXml(slides.length));
  addText("ppt/_rels/presentation.xml.rels", pptPresentationRelsXml(slides.length));
  addText("ppt/slideMasters/slideMaster1.xml", pptSlideMasterXml());
  addText("ppt/slideMasters/_rels/slideMaster1.xml.rels", pptSlideMasterRelsXml());
  addText("ppt/slideLayouts/slideLayout1.xml", pptSlideLayoutXml());
  addText("ppt/slideLayouts/_rels/slideLayout1.xml.rels", pptSlideLayoutRelsXml());
  addText("ppt/theme/theme1.xml", pptThemeXml());

  slides.forEach((slide, index) => {
    const slideNumber = index + 1;
    addText(`ppt/slides/slide${slideNumber}.xml`, pptSlideXml(slide, slideNumber));
    addText(`ppt/slides/_rels/slide${slideNumber}.xml.rels`, pptSlideRelsXml(slideNumber));
    addBytes(`ppt/media/image${slideNumber}.png`, slide.imageBytes);
  });

  return createZipBlob(entries, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
}

function pptContentTypesXml(slideCount) {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) => `
  <Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slideOverrides}
</Types>`;
}

function pptRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function pptCoreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>EV Trend Comparison</dc:title>
  <dc:creator>Dashboard Plus</dc:creator>
  <cp:lastModifiedBy>Dashboard Plus</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function pptAppXml(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Dashboard Plus</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${slideCount}</Slides>
</Properties>`;
}

function pptPresentationXml(slideCount) {
  const slideIds = Array.from({ length: slideCount }, (_, index) => `
    <p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function pptPresentationRelsXml(slideCount) {
  const slideRels = Array.from({ length: slideCount }, (_, index) => `
  <Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slideRels}
</Relationships>`;
}

function pptSlideXml(slide, slideNumber) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${pptTextShape(2, "Title", slide.title, 365760, 182880, 11460480, 320040, 1800, true)}
      ${pptTextShape(3, "Trend metadata", slide.meta, 365760, 548640, 11460480, 228600, 900, false)}
      <p:pic>
        <p:nvPicPr><p:cNvPr id="4" name="EV trend graph ${slideNumber}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="365760" y="914400"/><a:ext cx="11460480" cy="5486400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function pptTextShape(id, name, text, x, y, cx, cy, fontSize, bold) {
  return `<p:sp>
        <p:nvSpPr><p:cNvPr id="${id}" name="${escapeHtml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
        <p:txBody><a:bodyPr wrap="none" rtlCol="0"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${fontSize}"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="20312D"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${escapeHtml(text)}</a:t></a:r><a:endParaRPr lang="en-US" sz="${fontSize}"/></a:p></p:txBody>
      </p:sp>`;
}

function pptSlideRelsXml(slideNumber) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${slideNumber}.png"/>
</Relationships>`;
}

function pptSlideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`;
}

function pptSlideMasterRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
}

function pptSlideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function pptSlideLayoutRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function pptThemeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Dashboard Plus">
  <a:themeElements>
    <a:clrScheme name="Dashboard Plus">
      <a:dk1><a:srgbClr val="20312D"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="4F625C"/></a:dk2><a:lt2><a:srgbClr val="F5F8F7"/></a:lt2>
      <a:accent1><a:srgbClr val="35C2A6"/></a:accent1><a:accent2><a:srgbClr val="5EA1D8"/></a:accent2>
      <a:accent3><a:srgbClr val="E0A04B"/></a:accent3><a:accent4><a:srgbClr val="B09ADE"/></a:accent4>
      <a:accent5><a:srgbClr val="DF7FA2"/></a:accent5><a:accent6><a:srgbClr val="A0B96D"/></a:accent6>
      <a:hlink><a:srgbClr val="5EA1D8"/></a:hlink><a:folHlink><a:srgbClr val="B09ADE"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Dashboard Plus"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Dashboard Plus">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/><a:extraClrSchemeLst/>
</a:theme>`;
}

function renderCompareSignalSelect(select, signals, selected, allowNone) {
  select.innerHTML = [
    allowNone ? `<option value="">None</option>` : "",
    ...signals.map((signal) => `
      <option value="${escapeAttr(signal.header)}" ${signal.header === selected ? "selected" : ""}>
        ${escapeHtml(signal.label)}
      </option>
    `),
  ].join("");
}

function commonCompareSignals() {
  if (!state.devices.length) return [];
  const headerSets = state.devices.map((device) => new Set(device.headers));
  return state.devices[0].columns
    .filter(isPlottableColumn)
    .filter((column) => headerSets.every((set) => set.has(column.header)))
    .sort((a, b) => compareSignalRank(a) - compareSignalRank(b) || a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function compareSignalRank(column) {
  const text = `${column.header} ${column.label}`.toLowerCase();
  if (/waterflow|flow|position|setpoint|power|differential.*pressure|temperature/.test(text)) return 0;
  if (/energy|volume|delta|glycol/.test(text)) return 1;
  if (/status|error|warning|watchdog/.test(text)) return 2;
  return 3;
}

function defaultCompareSignal() {
  return commonCompareSignals()[0]?.header || "";
}

function defaultCompareSignals() {
  const signals = commonCompareSignals();
  const preferred = [
    "2303: AbsoluteWaterFlow_m3/sec",
    "12: RelativePosition_%",
    "2304: AbsolutePower_W",
    "4320: AbsoluteDifferentialWaterPressure_Pa",
  ];
  const selected = preferred.filter((header) => signals.some((signal) => signal.header === header));
  return [...selected, ...signals.map((signal) => signal.header)].filter((header, index, all) => header && all.indexOf(header) === index).slice(0, 3);
}

function selectedCompareSignals() {
  return state.compare.signals.filter((header, index, all) => header && all.indexOf(header) === index).slice(0, 3);
}

function compareRowsForSignal(header) {
  return compareRowsForSignals(header ? [header] : []);
}

function compareRowsForSignals(headers) {
  return state.devices.map((device) => {
    const baseTime = parseTimestamp(device.rows.find((row) => Number.isFinite(parseTimestamp(row["Timestamp - UTC"])))?.["Timestamp - UTC"]);
    const series = headers.map((header, index) => {
      const column = device.columns.find((item) => item.header === header);
      if (!column) return null;
      const unit = state.units.get(header) ?? defaultUnit(column);
      const converter = converterFor(column, unit);
      const points = device.rows.map((row, rowIndex) => {
        const time = parseX(row["Timestamp - UTC"], rowIndex);
        const raw = Number(row[header]);
        if (!Number.isFinite(time) || !Number.isFinite(raw)) return null;
        return {
          x: state.compare.alignment === "relative" && Number.isFinite(baseTime) ? time - baseTime : time,
          originalTime: time,
          y: converter(raw),
          raw,
        };
      }).filter(Boolean);
      return {
        header,
        column,
        unit,
        points,
        color: COLORS[index % COLORS.length],
        stats: summarize(points.map((point) => point.y)),
      };
    }).filter((item) => item && item.points.length);
    const allPoints = series.flatMap((item) => item.points).sort((a, b) => a.originalTime - b.originalTime);
    const first = allPoints[0]?.originalTime;
    const last = allPoints[allPoints.length - 1]?.originalTime;
    return {
      device,
      series,
      points: allPoints,
      rangeLabel: Number.isFinite(first) && Number.isFinite(last) ? `${formatShortDate(first)} to ${formatShortDate(last)}` : "No timestamp range",
    };
  }).filter((row) => row && row.series.length && row.points.length);
}

function renderCompareSummary(rows) {
  if (!rows.length) return `<div class="muted">No comparable samples for this signal.</div>`;
  const selected = selectedCompareSignals();
  const signalLines = selected.map((header, index) => {
    const rowSeries = rows.map((row) => ({ row, series: row.series.find((item) => item.header === header) })).filter((item) => item.series);
    if (!rowSeries.length) return "";
    const highest = [...rowSeries].sort((a, b) => b.series.stats.max - a.series.stats.max)[0];
    const lowest = [...rowSeries].sort((a, b) => a.series.stats.min - b.series.stats.min)[0];
    const label = rowSeries[0].series.column.label;
    const unit = rowSeries[0].series.unit;
    return `
      <div class="status-line">
        <strong><span class="badge system" style="color:${COLORS[index % COLORS.length]}">${escapeHtml(label)}</span></strong>
        <span>Highest max: ${escapeHtml(highest.row.device.name)} ${formatNumber(highest.series.stats.max)}${unit ? ` ${escapeHtml(unit)}` : ""}; lowest min: ${escapeHtml(lowest.row.device.name)} ${formatNumber(lowest.series.stats.min)}${unit ? ` ${escapeHtml(unit)}` : ""}</span>
      </div>
    `;
  }).join("");
  return `
    <div class="status-line">
      <strong>${selected.length.toLocaleString()} global signal${selected.length === 1 ? "" : "s"}</strong>
      <span>${rows.length.toLocaleString()} EV${rows.length === 1 ? "" : "s"} compared using ${state.compare.alignment === "relative" ? "relative start alignment" : "absolute timestamps"}.</span>
    </div>
    ${signalLines}
  `;
}

function drawComparePlots(rows) {
  state.compareHitPoints = [];
  state.compareStatusHits = [];
  hideCompareTooltip();
  if (!rows.length) return;
  const allPoints = rows.flatMap((row) => row.points);
  const sharedX = extent(allPoints.map((point) => point.x));
  const sharedYByHeader = {};
  selectedCompareSignals().forEach((header) => {
    const points = rows.flatMap((row) => row.series.find((item) => item.header === header)?.points ?? []);
    if (points.length) {
      sharedYByHeader[header] = extent(points.map((point) => point.y));
      padExtent(sharedYByHeader[header]);
    }
  });
  padTimeExtent(sharedX);

  document.querySelectorAll(".compare-canvas").forEach((canvas) => {
    const index = Number(canvas.dataset.compareIndex);
    const row = rows[index];
    if (!row) return;
    drawCompareCanvas(canvas, row, sharedX, sharedYByHeader, index);
  });
}

function drawCompareCanvas(canvas, row, sharedX, sharedYByHeader, rowIndex) {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * scale));
  canvas.height = Math.max(140, Math.floor(rect.height * scale));
  const local = canvas.getContext("2d");
  local.setTransform(scale, 0, 0, scale, 0, 0);
  const width = rect.width;
  const height = rect.height;
  const margin = { top: 18, right: 18, bottom: 34, left: 70 };
  const plotW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const statusLanes = getCompareStatusLanes(row.device);
  const statusBlockH = statusLanes.length ? 24 + statusLanes.length * 22 : 0;
  const plotInnerH = Math.max(110, innerH - statusBlockH);
  const laneGap = 10;
  const laneH = (plotInnerH - Math.max(0, row.series.length - 1) * laneGap) / row.series.length;
  const xExtent = sharedX;

  local.clearRect(0, 0, width, height);
  local.fillStyle = cssVar("--canvas");
  local.fillRect(0, 0, width, height);
  local.font = "11px Inter, system-ui, sans-serif";

  drawCompareGapBands(local, row.device, margin, plotW, plotInnerH, xExtent);

  row.series.forEach((series, laneIndex) => {
    const top = margin.top + laneIndex * (laneH + laneGap);
    const yExtent = state.compare.scale === "shared" && sharedYByHeader[series.header]
      ? [...sharedYByHeader[series.header]]
      : extent(series.points.map((point) => point.y));
    padExtent(yExtent);

    local.strokeStyle = cssVar("--canvas-grid");
    local.fillStyle = cssVar("--muted");
    for (let i = 0; i <= 2; i += 1) {
      const y = top + i / 2 * laneH;
      const value = yExtent[1] - i / 2 * (yExtent[1] - yExtent[0]);
      local.beginPath();
      local.moveTo(margin.left, y);
      local.lineTo(margin.left + plotW, y);
      local.stroke();
      local.fillText(formatNumber(value), 8, y + 4);
    }

    local.strokeStyle = cssVar("--canvas-axis");
    local.strokeRect(margin.left, top, plotW, laneH);
    drawZeroGuideLine(local, margin.left, top, plotW, laneH, yExtent);
    local.fillStyle = series.color;
    local.fillText(shorten(series.column.label, 34), margin.left + 8, top + 14);
    local.strokeStyle = series.color;
    local.lineWidth = 2;
    local.beginPath();
    const sampleStep = Math.max(1, Math.ceil(series.points.length / 900));
    series.points.forEach((point, index) => {
      const x = margin.left + (point.x - xExtent[0]) / (xExtent[1] - xExtent[0]) * plotW;
      const y = top + laneH - (point.y - yExtent[0]) / (yExtent[1] - yExtent[0]) * laneH;
      if (index === 0) local.moveTo(x, y);
      else local.lineTo(x, y);
      if (index % sampleStep === 0 || index === series.points.length - 1) {
        state.compareHitPoints.push({
          canvas,
          rowIndex,
          laneIndex,
          x,
          y,
          point,
          series,
          row,
        });
      }
    });
    local.stroke();
  });

  drawCompareStatusBands(local, row, statusLanes, margin, plotW, margin.top + plotInnerH + 22, xExtent);

  local.fillStyle = cssVar("--muted");
  const startLabel = state.compare.alignment === "relative" ? "0" : formatX(xExtent[0]);
  const endLabel = state.compare.alignment === "relative" ? formatDuration((xExtent[1] - xExtent[0]) / 1000) : formatX(xExtent[1]);
  local.fillText(startLabel, margin.left, height - 10);
  local.fillText(endLabel, Math.max(margin.left, margin.left + plotW - 78), height - 10);
}

function getCompareStatusLanes(device) {
  const lanes = [getCompareControlModeLane(device), getCompareErrorStateLane(device)].filter(Boolean);
  if (lanes.some((lane) => lane.id === "errorState") && isCompareErrorExpanded(device)) {
    lanes.push(...getCompareErrorDetailLanes(device));
  }
  return lanes;
}

function getCompareControlModeLane(device) {
  const header = getDeviceControlModeHeader(device);
  if (!header) return null;
  const baseTime = firstDeviceTime(device);
  const samples = device.rows.map((dataRow) => {
    const time = parseTimestamp(dataRow["Timestamp - UTC"]);
    const value = Number(dataRow[header]);
    if (!Number.isFinite(time) || !Number.isFinite(value)) return null;
    return {
      time: compareStatusTime(time, baseTime),
      value,
      label: controlModeLabel(value),
    };
  }).filter(Boolean);
  const segments = buildCompareStateSegments(samples);
  return segments.length ? { id: "controlMode", bit: "CM", label: "Control mode", segments } : null;
}

function getCompareErrorStateLane(device) {
  const column = findCompareErrorStateColumn(device);
  if (!column) return null;
  const baseTime = firstDeviceTime(device);
  const samples = device.rows.map((dataRow) => {
    const time = parseTimestamp(dataRow["Timestamp - UTC"]);
    const value = Number(dataRow[column.header]);
    if (!Number.isFinite(time) || !Number.isFinite(value)) return null;
    return {
      time: compareStatusTime(time, baseTime),
      value,
      label: errorStateLabel(column, value),
    };
  }).filter(Boolean);
  const segments = buildCompareStateSegments(samples);
  return segments.length ? { id: "errorState", bit: "ERR", label: "Error state", segments } : null;
}

function getCompareErrorDetailLanes(device) {
  const column = findCompareErrorStateColumn(device);
  if (!column) return [];
  const baseTime = firstDeviceTime(device);
  const samples = device.rows.map((dataRow) => {
    const time = parseTimestamp(dataRow["Timestamp - UTC"]);
    const value = Number(dataRow[column.header]);
    if (!Number.isFinite(time) || !Number.isFinite(value)) return null;
    return {
      time: compareStatusTime(time, baseTime),
      value,
    };
  }).filter(Boolean);

  if (column.bitMap.length) {
    return column.bitMap.map((bit) => {
      const segments = buildCompareBitSegments(samples, bit);
      return {
        id: `errorBit:${bit.bit}`,
        kind: "errorBit",
        bit: `B${bit.bit}`,
        bitNumber: bit.bit,
        label: bit.label,
        segments,
      };
    }).filter((lane) => lane.segments.length);
  }

  const values = [...new Set(samples.map((sample) => sample.value))]
    .filter((value) => value !== 0)
    .sort((a, b) => a - b);
  return values.map((value, index) => {
    const label = errorStateLabel(column, value);
    const segments = buildCompareValueSegments(samples, value, label);
    return {
      id: `errorValue:${value}`,
      kind: "errorValue",
      bit: `S${index + 1}`,
      value,
      label,
      segments,
    };
  }).filter((lane) => lane.segments.length);
}

function buildCompareBitSegments(samples, bit) {
  const segments = [];
  let activeStart = null;
  let activeValue = null;

  samples.forEach((sample, index) => {
    const active = maskHasBit(sample.value, bit.bit);
    const next = samples[index + 1];
    const nextActive = next ? maskHasBit(next.value, bit.bit) : false;
    if (active && activeStart === null) {
      activeStart = sample.time;
      activeValue = sample.value;
    }

    if (activeStart !== null && (!nextActive || !next)) {
      const end = next ? next.time : Math.max(sample.time, activeStart + 1);
      if (end > activeStart) {
        segments.push({
          start: activeStart,
          end,
          value: activeValue ?? sample.value,
          label: bit.label,
        });
      }
      activeStart = null;
      activeValue = null;
    }
  });

  return segments;
}

function maskHasBit(mask, bit) {
  return Math.floor(mask / (2 ** bit)) % 2 === 1;
}

function buildCompareValueSegments(samples, value, label) {
  const segments = [];
  let activeStart = null;

  samples.forEach((sample, index) => {
    const active = sample.value === value;
    const next = samples[index + 1];
    const nextActive = next ? next.value === value : false;
    if (active && activeStart === null) activeStart = sample.time;

    if (activeStart !== null && (!nextActive || !next)) {
      const end = next ? next.time : Math.max(sample.time, activeStart + 1);
      if (end > activeStart) {
        segments.push({
          start: activeStart,
          end,
          value,
          label,
        });
      }
      activeStart = null;
    }
  });

  return segments;
}

function buildCompareStateSegments(samples) {
  const segments = [];
  let active = null;
  samples.forEach((sample, index) => {
    const next = samples[index + 1];
    if (!active || active.value !== sample.value || active.label !== sample.label) {
      if (active && sample.time > active.start) {
        segments.push({ start: active.start, end: sample.time, value: active.value, label: active.label });
      }
      active = { start: sample.time, value: sample.value, label: sample.label };
    }
    if (!next && active) {
      const end = sample.time > active.start ? sample.time : active.start + 1;
      segments.push({ start: active.start, end, value: active.value, label: active.label });
    }
  });
  return segments;
}

function getDeviceControlModeHeader(device) {
  if (!device.headers.length) return "";
  return device.headers.find((header) => /control.?mode|SelectWaterControlMode|WaterControlMode/i.test(header))
    || device.headers[CONTROL_MODE_COLUMN_INDEX]
    || "";
}

function findCompareErrorStateColumn(device) {
  const candidates = device.columns.filter((column) => column.kind === "bitfield" || column.kind === "state" || column.kind === "enum");
  return candidates.find((column) => /error.?state|device.?error.?status|error.?status/i.test(column.header))
    || candidates.find((column) => /fault|alarm|warning|watchdog/i.test(column.header))
    || candidates.find((column) => column.kind === "bitfield")
    || null;
}

function errorStateLabel(column, value) {
  if (column.bitMap.length) {
    if (!value) return "No active error";
    const labels = labelsForMask(column, value);
    return labels.length ? labels.join(", ") : `Mask ${value}`;
  }
  if (column.enumMap.has(value)) return column.enumMap.get(value);
  return value ? `State ${value}` : "No active error";
}

function firstDeviceTime(device) {
  return parseTimestamp(device.rows.find((dataRow) => Number.isFinite(parseTimestamp(dataRow["Timestamp - UTC"])))?.["Timestamp - UTC"]);
}

function compareStatusTime(time, baseTime) {
  return state.compare.alignment === "relative" && Number.isFinite(baseTime) ? time - baseTime : time;
}

function drawCompareStatusBands(local, row, lanes, margin, width, top, xExtent) {
  if (!lanes.length) return;
  const laneHeight = 18;
  const laneGap = 4;
  const colors = ["#e0a04b", "#ec6b62", "#df7fa2", "#b09ade", "#5ea1d8", "#a0b96d", "#d0825d"];

  local.save();
  local.font = "11px Inter, system-ui, sans-serif";
  local.fillStyle = cssVar("--muted");
  local.fillText("Status indicators", margin.left, top - 8);

  lanes.forEach((lane, laneIndex) => {
    const y = top + laneIndex * (laneHeight + laneGap);
    const color = lane.id === "controlMode"
      ? "#e0a04b"
      : lane.id === "errorState" ? "#ec6b62" : colors[laneIndex % colors.length];
    local.fillStyle = cssVar("--panel-soft");
    local.fillRect(margin.left, y, width, laneHeight);

    local.fillStyle = cssVar("--muted");
    local.textAlign = "right";
    local.fillText(lane.bit, margin.left - 8, y + 13);
    local.textAlign = "left";

    lane.segments
      .filter((segment) => segment.end >= xExtent[0] && segment.start <= xExtent[1])
      .forEach((segment) => {
        const start = Math.max(segment.start, xExtent[0]);
        const end = Math.min(segment.end, xExtent[1]);
        const x1 = margin.left + (start - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
        const x2 = margin.left + (end - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
        const activeColor = lane.id === "errorState" && !segment.value ? "#35c2a6" : color;
        local.fillStyle = activeColor;
        local.globalAlpha = lane.id === "errorState" && !segment.value ? 0.42 : 0.84;
        local.fillRect(x1, y + 3, Math.max(3, x2 - x1), laneHeight - 6);
        local.globalAlpha = 1;

        if (x2 - x1 > 42) {
          local.fillStyle = "rgba(13, 20, 18, 0.78)";
          local.fillRect(x1 + 3, y + 4, Math.min(Math.max(0, x2 - x1 - 6), 118), laneHeight - 8);
          local.fillStyle = cssVar("--ink");
          local.fillText(shorten(segment.label, 18), x1 + 7, y + 13);
        }

        state.compareStatusHits.push({
          canvas: local.canvas,
          row,
          lane,
          segment,
          x1,
          x2: Math.max(x2, x1 + 3),
          y1: y + 2,
          y2: y + laneHeight - 2,
        });
      });

    local.fillStyle = "rgba(13, 20, 18, 0.78)";
    local.fillRect(8, y + 2, margin.left - 16, laneHeight - 4);
    local.fillStyle = cssVar("--ink");
    local.fillText(shorten(lane.label, 18), 12, y + 13);
  });
  local.restore();
}

function handleComparePlotClick(event) {
  const button = event.target.closest?.(".compare-expand-button");
  if (!button) return;
  const deviceId = button.dataset.deviceId;
  if (!deviceId) return;

  const expanded = compareExpandedErrorDevices();
  if (expanded.has(deviceId)) expanded.delete(deviceId);
  else expanded.add(deviceId);
  hideCompareTooltip();
  renderCompare();
}

function handleCompareHover(event) {
  if (!state.compareHitPoints.length && !state.compareStatusHits.length) return hideCompareTooltip();
  const canvas = event.target.closest?.(".compare-canvas");
  if (!canvas) return hideCompareTooltip();
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const statusHit = state.compareStatusHits.find((hit) => (
    hit.canvas === canvas
    && mouseX >= hit.x1
    && mouseX <= hit.x2
    && mouseY >= hit.y1
    && mouseY <= hit.y2
  ));
  if (statusHit) {
    showCompareStatusTooltip(statusHit, rect);
    return;
  }

  let nearest = null;
  let nearestDistance = Infinity;
  state.compareHitPoints.forEach((hit) => {
    if (hit.canvas !== canvas) return;
    const distance = Math.hypot(hit.x - mouseX, hit.y - mouseY);
    if (distance < nearestDistance) {
      nearest = hit;
      nearestDistance = distance;
    }
  });

  if (!nearest || nearestDistance > 34) return hideCompareTooltip();
  showCompareTooltip(nearest, rect);
}

function showCompareTooltip(hit, canvasRect) {
  const wrapRect = els.comparePlots.parentElement.getBoundingClientRect();
  const timeLabel = state.compare.alignment === "relative"
    ? formatDuration(hit.point.x / 1000)
    : formatFullX(hit.point.originalTime);
  els.compareTooltip.innerHTML = `
    <strong>${escapeHtml(hit.series.column.label)}</strong>
    <span>${escapeHtml(hit.row.device.name)}</span>
    <span>${escapeHtml(timeLabel)}</span>
    <span>${escapeHtml(`${formatNumber(hit.point.y)}${hit.series.unit ? ` ${hit.series.unit}` : ""}`)}</span>
  `;
  const localLeft = canvasRect.left - wrapRect.left + hit.x + 12;
  const localTop = canvasRect.top - wrapRect.top + hit.y - 58;
  const tooltipWidth = 250;
  els.compareTooltip.style.left = `${Math.min(wrapRect.width - tooltipWidth - 10, Math.max(10, localLeft))}px`;
  els.compareTooltip.style.top = `${Math.max(10, localTop)}px`;
  els.compareTooltip.style.display = "block";
}

function showCompareStatusTooltip(hit, canvasRect) {
  const wrapRect = els.comparePlots.parentElement.getBoundingClientRect();
  const startLabel = formatCompareStatusTime(hit.segment.start);
  const endLabel = formatCompareStatusTime(hit.segment.end);
  const valueLabel = hit.lane.id === "controlMode"
    ? "Mode"
    : hit.lane.kind === "errorBit" ? "Error bit" : "Decoded state";
  const rawLabel = hit.lane.kind === "errorBit"
    ? `Bit ${hit.lane.bitNumber}; mask sample ${hit.segment.value}`
    : `Raw: ${hit.segment.value}`;
  els.compareTooltip.innerHTML = `
    <strong>${escapeHtml(hit.lane.label)}</strong>
    <span>${escapeHtml(hit.row.device.name)}</span>
    <span>${escapeHtml(`${startLabel} to ${endLabel}`)}</span>
    <span>${escapeHtml(`${valueLabel}: ${hit.segment.label}`)}</span>
    <span>${escapeHtml(rawLabel)}</span>
  `;
  const localLeft = canvasRect.left - wrapRect.left + Math.min(hit.x2 - 10, Math.max(hit.x1 + 12, (hit.x1 + hit.x2) / 2));
  const localTop = canvasRect.top - wrapRect.top + hit.y1 - 72;
  const tooltipWidth = 280;
  els.compareTooltip.style.left = `${Math.min(wrapRect.width - tooltipWidth - 10, Math.max(10, localLeft))}px`;
  els.compareTooltip.style.top = `${Math.max(10, localTop)}px`;
  els.compareTooltip.style.display = "block";
}

function formatCompareStatusTime(value) {
  return state.compare.alignment === "relative" ? formatDuration(value / 1000) : formatFullX(value);
}

function hideCompareTooltip() {
  els.compareTooltip.style.display = "none";
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

  const impactChanges = controlImpactingChanges();
  els.configImpactSummary.className = impactChanges.length ? "summary-list" : "summary-list muted";
  els.configImpactSummary.innerHTML = impactChanges.length
    ? impactChanges.slice(-24).reverse().map(renderConfigImpactLine).join("")
    : "No control-impacting changes loaded yet.";
}

function renderRuntime() {
  const runtime = state.debug.jvmEvents;
  const starts = runtime.filter((event) => event.type === "start");
  const gcs = runtime.filter((event) => event.type === "gc");
  const maxGc = Math.max(...gcs.map((event) => event.gcMillis), NaN);
  const maxLoad = Math.max(...gcs.map((event) => event.loadMillis), NaN);
  const maxWindow = Math.max(...gcs.map((event) => event.windowSeconds), NaN);
  const versions = countBy(starts, (event) => event.version);

  els.runtimeStats.innerHTML = runtime.length ? [
    statLine("Agent starts", starts.length.toLocaleString()),
    statLine("Full GC events", gcs.length.toLocaleString()),
    statLine("Max GC", Number.isFinite(maxGc) ? `${maxGc.toLocaleString()} ms` : "n/a"),
    statLine("Max load", Number.isFinite(maxLoad) ? `${maxLoad.toLocaleString()} ms` : "n/a"),
    statLine("Max GC window", Number.isFinite(maxWindow) ? `${maxWindow.toLocaleString()} sec` : "n/a"),
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
    const identity = deviceIdentityFields();
    els.deviceSummary.innerHTML = [
      statLine("Serial", identity.serial || "n/a"),
      statLine("Belimo String", identity.belimoString || "n/a"),
      statLine("Application", identity.applicationName || "n/a"),
      statLine("Application version", identity.applicationVersion || "n/a"),
      statLine("Platform", identity.platform || "n/a"),
      statLine("Active slot", identity.activeBootSlot || "n/a"),
      statLine("CSP", identity.csp || "n/a"),
      statLine("BSP", identity.bsp || "n/a"),
      statLine("Dataprofile", identity.dataprofile || "n/a"),
      statLine("Export time", identity.exportTime || "n/a"),
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

  const controlHealth = buildControlHealthSummary();
  els.controlHealthSummary.className = controlHealth.length ? "summary-list" : "summary-list muted";
  els.controlHealthSummary.innerHTML = controlHealth.length
    ? controlHealth.map((item) => renderFindingLine(item)).join("")
    : "No allDatapoints.json loaded yet.";

  const faultPerspective = buildFaultPerspectiveSummary();
  els.faultPerspectiveSummary.className = faultPerspective.length ? "summary-list" : "summary-list muted";
  els.faultPerspectiveSummary.innerHTML = faultPerspective.length
    ? faultPerspective.map((item) => renderFindingLine(item)).join("")
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
  const modelStarts = state.debug.events.filter((event) => event.component === "ModelExecutorImpl").length;
  const configImpact = controlImpactingChanges();
  const majorCounters = majorHistoricalFaultCounters().filter((item) => item.value > 0);
  const datapoints = state.debug.datapoints ?? {};

  if (modelStarts || starts.length) insights.push({
    title: "Restart history available",
    detail: `${starts.length.toLocaleString()} JVM agent starts and ${modelStarts.toLocaleString()} model starts were parsed.`,
  });
  if (configImpact.length) insights.push({
    title: "Control-impacting configuration changes",
    detail: `${configImpact.length.toLocaleString()} setup/control changes were found, including bus, setpoint, flow limit, wizard, or identity changes.`,
  });
  if (majorCounters.length) insights.push({
    title: "Historical fault burden differs from active health",
    detail: `${majorCounters.length.toLocaleString()} non-zero historical fault counters are present; check Snapshot for active-vs-historical interpretation.`,
  });
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

function controlImpactingChanges() {
  return state.debug.configChanges
    .map((change) => ({ ...change, impact: classifyConfigImpact(change.path) }))
    .filter((change) => change.impact);
}

function classifyConfigImpact(path) {
  const text = path.toLowerCase();
  if (/selectwatercontrolmode|watercontrol|powercontrol|differentialwaterpressure|differentialtemperature|setpoint|minimumwaterflow|maximumwaterflow|pid|deadband/.test(text)) return "Control";
  if (/selectbusprotocol|bus|modbus|bacnet|watchdog|setpointsource/.test(text)) return "Communication";
  if (/wizard/.test(text)) return "Commissioning";
  if (/deviceidentification|description|installationlocation/.test(text)) return "Identity";
  if (/poe|power|unit_settings|units/.test(text)) return "Setup";
  return "";
}

function renderConfigImpactLine(change) {
  const source = change.source || "unknown source";
  return `
    <div class="status-line">
      <strong><span class="badge update">${escapeHtml(change.impact)}</span> ${escapeHtml(shortenPath(change.path))}</strong>
      <span>${escapeHtml(formatFullX(change.time))}: ${escapeHtml(String(change.value))} from ${escapeHtml(source)}</span>
    </div>
  `;
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
  const powerUps = numberFromAnyDatapoint(["OcPowerUpCounter", "powerUpCount"]);
  const uptime = numberFromAnyDatapoint(["OcUptime", "uptime"]);
  const operationHours = numberFromAnyDatapoint(["OcApplicationOperationHours", "ApplicationOperationHours"]);
  const watchdogReboots = numberFromAnyDatapoint(["OcWatchdogRebootCounter", "WatchdogRebootCounter"]);
  const watchdogFile = state.debug.watchdogCounter;
  const jvmStarts = state.debug.jvmEvents.filter((event) => event.type === "start").length;
  const modelStarts = state.debug.events.filter((event) => event.component === "ModelExecutorImpl").length;
  const systemRuns = state.debug.events.filter((event) => event.component === "SystemService").length;
  const busTriggers = [
    ["Bus", "BusWatchdogTriggered"],
    ["BACnet/IP", "BacnetIpBusWatchdogTriggered"],
    ["BACnet MS/TP", "BacnetMstpBusWatchdogTriggered"],
    ["Modbus RTU", "ModbusRtuBusWatchdogTriggered"],
    ["Modbus TCP", "ModbusTcpBusWatchdogTriggered"],
    ["Modbus TCP", "Modbus TCP BusWatchdog Triggered"],
    ["MP slave", "MpSlaveBusWatchdogTriggered"],
  ].map(([label, key]) => ({ label, key, value: numberFromDatapoint(key) })).filter((item) => Number.isFinite(item.value));

  if (Number.isFinite(powerUps)) add("Power-up counter", `${powerUps.toLocaleString()} recorded power-ups`, powerUps > 1 ? "update" : "system");
  if (Number.isFinite(uptime)) add("OC uptime", formatDuration(uptime), uptime < 3600 && powerUps > 1 ? "update" : "system");
  if (Number.isFinite(operationHours)) add("Application operation hours", `${operationHours.toLocaleString()} hours`);
  if (jvmStarts) add("JVM agent starts", jvmStarts.toLocaleString(), jvmStarts > 1 ? "update" : "system");
  if (modelStarts || systemRuns) add("Model/System starts", `${modelStarts.toLocaleString()} model starts, ${systemRuns.toLocaleString()} system-running events`, modelStarts > 1 ? "update" : "system");
  add("Active boot slot", stringFromAnyDatapoint(["OcActiveBootSlot", "ActiveBootSlot"]) || state.debug.deviceInfo?.software?.["Active Boot Slot"] || state.debug.bootSlot?.["bootjournal.lastboot.slot"] || "n/a");
  add("Last successful boot slot", state.debug.bootSlot?.["bootjournal.lastsuccessfulboot.slot"] || "n/a");
  add("Power supply status", stringFromAnyDatapoint(["PowerSupplyStatus", "powerState", "poeSupplyStatus"]) || "n/a");
  add("Watchdog support", stringFromDatapoint("WatchdogSupported") || "n/a");
  if (Number.isFinite(watchdogReboots)) add("OC watchdog reboot counter", watchdogReboots.toLocaleString(), watchdogReboots ? "error" : "system");
  add("Last reboot by watchdog", stringFromDatapoint("OcLastRebootByWatchdog") || "n/a", stringFromDatapoint("OcLastRebootByWatchdog") === "true" ? "error" : "system");
  add("Last watchdog cause", stringFromDatapoint("OcLastWatchdogCause") || "None reported");
  if (watchdogFile !== null) add("watchdog.counter file", String(watchdogFile), watchdogFile ? "error" : "system");
  add("Watchdog timeouts", [
    `BACnet ${stringFromAnyDatapoint(["SetBacnetWatchdogTimeout", "Set Bacnet Watchdog Timeout"]) || "n/a"}s`,
    `Modbus ${stringFromAnyDatapoint(["SetModbusWatchdogTimeout", "modbusWatchdogTimeout"]) || "n/a"}s`,
    `MP ${stringFromAnyDatapoint(["SetMpSlaveWatchdogTimeout", "mpWatchdogTimeout"]) || "n/a"}s`,
    `Any comm ${stringFromDatapoint("anyCommunicationWatchdogTimeout") || "n/a"}s`,
  ].join(", "));
  busTriggers.forEach((item) => {
    add(`${item.label} watchdog triggers`, item.value.toLocaleString(), item.value > 0 ? "error" : "system");
  });
  return items;
}

function buildControlHealthSummary() {
  const dp = state.debug.datapoints;
  if (!dp) return [];
  const items = [];
  const add = (title, detail, severity = "system") => items.push({ title, detail, severity });
  const controlMode = numberFromDatapoint("SelectWaterControlMode");
  const setpointSource = stringFromDatapoint("SelectSetpointSource");
  const busProtocol = stringFromDatapoint("SelectBusProtocol");
  const flowActual = numberFromDatapoint("AbsoluteWaterFlow");
  const flowSetpoint = numberFromDatapoint("AbsoluteWaterFlowSetpoint");
  const relFlow = numberFromDatapoint("RelativeWaterFlow");
  const relSetpoint = numberFromDatapoint("RelativeWaterFlowSetpoint");
  const maxFlow = numberFromDatapoint("SetMaximumWaterFlow");
  const minFlow = numberFromDatapoint("SetMinimumWaterFlow");
  const dT = numberFromDatapoint("DifferentialWaterTemperature");
  const dTSetpoint = numberFromDatapoint("DifferentialWaterTemperatureSetpoint");
  const setpointReached = stringFromAnyDatapoint(["ControllerSetpointReached", "ctrl_flow_sp_reached"]);

  if (Number.isFinite(controlMode)) add("Control mode", `${controlModeLabel(controlMode)} (${controlMode})`);
  if (setpointSource) add("Setpoint source", `${setpointSource}${stringFromDatapoint("bus_setpoint_selected_sl") === "true" ? " (bus selected)" : ""}`);
  if (busProtocol) add("Bus protocol", busProtocol);
  if (Number.isFinite(maxFlow) || Number.isFinite(minFlow)) add("Flow limits", `Min ${formatEngineeringValue(minFlow, "m3/s")}, max ${formatEngineeringValue(maxFlow, "m3/s")}`);
  if (Number.isFinite(flowActual) && Number.isFinite(flowSetpoint)) {
    const diff = flowActual - flowSetpoint;
    const pct = flowSetpoint ? diff / flowSetpoint * 100 : NaN;
    add("Absolute flow tracking", `${formatEngineeringValue(flowActual, "m3/s")} actual vs ${formatEngineeringValue(flowSetpoint, "m3/s")} setpoint (${formatSignedPercent(pct)} error)`, Math.abs(pct) > 5 ? "update" : "system");
  }
  if (Number.isFinite(relFlow) && Number.isFinite(relSetpoint)) {
    const diff = relFlow - relSetpoint;
    add("Relative flow tracking", `${formatNumber(relFlow)}% actual vs ${formatNumber(relSetpoint)}% setpoint (${formatSignedNumber(diff)} points)`, Math.abs(diff) > 5 ? "update" : "system");
  }
  if (Number.isFinite(dT) && Number.isFinite(dTSetpoint)) {
    const diff = dT - dTSetpoint;
    add("Delta T tracking", `${formatNumber(dT)} K actual vs ${formatNumber(dTSetpoint)} K setpoint (${formatSignedNumber(diff)} K)`, Math.abs(diff) > 2 ? "update" : "system");
  }
  if (setpointReached) add("Setpoint reached", setpointReached, /false|0/i.test(setpointReached) ? "update" : "system");
  return items;
}

function buildFaultPerspectiveSummary() {
  const dp = state.debug.datapoints;
  if (!dp) return [];
  const items = [];
  const add = (title, detail, severity = "system") => items.push({ title, detail, severity });
  const activeFlags = [
    ["Collective error active", stringFromDatapoint("collective_error"), (value) => String(value).toLowerCase() === "true"],
    ["No collective error", stringFromDatapoint("no_collective_error"), (value) => String(value).toLowerCase() === "false"],
    ["Flow sensor OK", stringFromDatapoint("flow_sensor_ok"), (value) => String(value).toLowerCase() === "false"],
    ["Power OK", stringFromDatapoint("power_ok"), (value) => String(value).toLowerCase() === "false"],
    ["Flow sensor not OK", stringFromDatapoint("flow_sensor_not_ok"), (value) => String(value).toLowerCase() === "true"],
    ["Flow measurement error active", stringFromDatapoint("flow_measurement_error_sl"), (value) => String(value).toLowerCase() === "true"],
  ].filter(([, value]) => value !== "");

  activeFlags.forEach(([title, value, isBad]) => {
    add(title, value, isBad(value) ? "error" : "system");
  });

  const counters = majorHistoricalFaultCounters().filter((item) => item.value > 0);
  if (counters.length) {
    add("Historical counters present", `${counters.length.toLocaleString()} non-zero counters found; this can coexist with a currently healthy snapshot.`, "update");
    counters.slice(0, 8).forEach((counter) => {
      add(counter.label, counter.value.toLocaleString(), counter.severity);
    });
  } else {
    add("Historical counters", "No major non-zero historical fault counters found.");
  }
  return items;
}

function majorHistoricalFaultCounters() {
  const keys = [
    ["Cummulated error counter", "CummulatedErrorCounter-TotalOccurences", "error"],
    ["Error count", "errorCount", "error"],
    ["Flow measure errors", "FlowMeasureError-ErrOccurance", "error"],
    ["Flow setpoint not reached", "FlowSetpointNotReached-ErrOccurance", "update"],
    ["Flow with closed valve", "FlowWithClosedValve-ErrOccurance", "update"],
    ["Reverse flow", "ReverseFlow-ErrOccurance", "update"],
    ["No communication to actuator", "NoComm2Actuator-ErrOccurance", "error"],
    ["Modbus TCP watchdog", "Modbus TCP BusWatchdog Triggered", "error"],
    ["BACnet/IP watchdog", "BacnetIpBusWatchdogTriggered", "error"],
  ];
  return keys
    .map(([label, key, severity]) => ({ label, key, severity, value: numberFromDatapoint(key) }))
    .filter((item) => Number.isFinite(item.value));
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
  const powerUps = numberFromAnyDatapoint(["OcPowerUpCounter", "powerUpCount"]);
  const uptime = numberFromAnyDatapoint(["OcUptime", "uptime"]);
  const watchdogReboots = numberFromAnyDatapoint(["OcWatchdogRebootCounter", "WatchdogRebootCounter"]);
  const bacnetWatchdog = numberFromAnyDatapoint(["BacnetIpBusWatchdogTriggered", "Modbus TCP BusWatchdog Triggered"]);
  const networkRecoveries = state.debug.events.filter((event) => event.category === "network").length;
  const updateErrors = state.debug.events.filter((event) => event.category === "update" && event.severity === "Error").length;
  const configImpact = controlImpactingChanges().length;
  const controlMode = numberFromDatapoint("SelectWaterControlMode");
  const actualFlow = numberFromDatapoint("AbsoluteWaterFlow");
  const flowSetpoint = numberFromDatapoint("AbsoluteWaterFlowSetpoint");

  if (Number.isFinite(powerUps) && powerUps > 1 && Number.isFinite(uptime) && uptime < 3600) {
    add("Recent reboot after multiple power-ups", `Power-up counter is ${powerUps}, while uptime is only ${formatDuration(uptime)}. This suggests the export was taken soon after a restart/power cycle.`, "update");
  }
  if (watchdogReboots === 0 && stringFromDatapoint("OcLastRebootByWatchdog") === "false" && state.debug.watchdogCounter === 0) {
    add("No OC watchdog reboot evidence", "OC watchdog reboot counter, last-watchdog flag, and watchdog.counter file are all zero/false in this bundle.", "system");
  } else if ((watchdogReboots || 0) > 0 || state.debug.watchdogCounter > 0) {
    add("Watchdog reboot evidence found", `OC watchdog reboots: ${watchdogReboots}; watchdog.counter: ${state.debug.watchdogCounter}.`, "error");
  }
  if ((bacnetWatchdog || 0) > 0) {
    add("Bus watchdog triggered", `${bacnetWatchdog} bus watchdog trigger(s) are reported even though OC watchdog reboots may be clean. Check bus supervision separately from system resets.`, "error");
  }
  if (configImpact) {
    add("Control-impacting setup changes found", `${configImpact.toLocaleString()} configuration changes affect control, communication, commissioning, identity, or setup context. Review the Config tab before blaming device health.`, "update");
  }
  if (Number.isFinite(controlMode)) {
    add("Control mode context", `Current water control mode is ${controlModeLabel(controlMode)} (${controlMode}); interpret trend tracking against this mode.`, "system");
  }
  if (Number.isFinite(actualFlow) && Number.isFinite(flowSetpoint) && flowSetpoint) {
    const errorPct = (actualFlow - flowSetpoint) / flowSetpoint * 100;
    if (Math.abs(errorPct) <= 5) {
      add("Current flow tracking is close", `AbsoluteWaterFlow is within ${formatSignedPercent(errorPct)} of AbsoluteWaterFlowSetpoint at export time.`, "system");
    }
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

function stringFromAnyDatapoint(keys) {
  for (const key of keys) {
    const value = stringFromDatapoint(key);
    if (value !== "") return value;
  }
  return "";
}

function numberFromDatapoint(key) {
  const value = Number(stringFromDatapoint(key));
  return Number.isFinite(value) ? value : NaN;
}

function numberFromAnyDatapoint(keys) {
  for (const key of keys) {
    const value = numberFromDatapoint(key);
    if (Number.isFinite(value)) return value;
  }
  return NaN;
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
      controlImpactingChanges: controlImpactingChanges().slice(-40).map((change) => ({
        time: formatFullX(change.time),
        impact: change.impact,
        path: change.path,
        value: change.value,
        source: change.source,
      })),
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
  const identity = deviceIdentityFields();
  return {
    device: {
      serial: identity.serial,
      belimoString: identity.belimoString,
      applicationName: identity.applicationName,
      applicationVersion: identity.applicationVersion,
      platform: identity.platform,
      csp: identity.csp,
      bsp: identity.bsp,
      activeBootSlot: identity.activeBootSlot || stringFromAnyDatapoint(["OcActiveBootSlot", "ActiveBootSlot"]),
      dataprofile: state.debug.deviceInfo?.deviceDataprofileStatus ?? null,
      exportTime: identity.exportTime,
    },
    powerBootWatchdog: buildReliabilitySummary(),
    controlHealth: buildControlHealthSummary(),
    currentVsHistoricalFaults: buildFaultPerspectiveSummary(),
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
  state.hitPoints = [];
  state.hitStatusEvents = [];
  state.hitOperationEvents = [];
  hidePlotTooltip();
  const series = selectedSeries().filter((item) => item.points.length > 1);
  const operationLanes = els.operationsOverlayToggle.checked ? getOperationLanes() : [];
  const statusLanes = els.statusOverlayToggle.checked ? getStatusLanes() : [];
  sizeTrendCanvasForOverlays(statusLanes, operationLanes);
  fitCanvas();
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  const timelinePoints = operationLanes.flatMap((lane) => lane.events.map((event) => event.time));
  const allSeriesPoints = series.flatMap((item) => item.points);
  const xValues = [...allSeriesPoints.map((point) => point.x), ...timelinePoints].filter(Number.isFinite);
  els.emptyState.style.display = xValues.length ? "none" : "grid";
  if (!xValues.length) return;

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
  drawZeroGuideLine(ctx, margin.left, margin.top, width, height, yExtent);

  visibleSeries.forEach((item) => {
    ctx.beginPath();
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    const hitSampleStep = Math.max(1, Math.ceil(item.points.length / 1200));
    item.points.forEach((point, index) => {
      const x = margin.left + (point.x - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
      const y = margin.top + height - (point.y - yExtent[0]) / (yExtent[1] - yExtent[0]) * height;
      if (index % hitSampleStep === 0 || index === item.points.length - 1) {
        state.hitPoints.push({ x, y, point, series: item });
      }
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

function sizeTrendCanvasForOverlays(statusLanes, operationLanes) {
  const statusHeight = statusLanes.length ? 36 + statusLanes.length * 22 : 0;
  const operationHeight = operationLanes.length ? 36 + operationLanes.length * 24 : 0;
  const desiredHeight = Math.max(520, 26 + 300 + 58 + statusHeight + operationHeight);
  els.canvas.style.height = `${desiredHeight}px`;
  els.canvas.parentElement.style.minHeight = `${Math.max(420, desiredHeight)}px`;
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
  return getTimestampGapsForRows(state.rows);
}

function getTimestampGapsForRows(rows) {
  const timestamps = rows.map((row) => ({
    value: row["Timestamp - UTC"],
    time: parseTimestamp(row["Timestamp - UTC"]),
  })).filter((item) => Number.isFinite(item.time)).sort((a, b) => a.time - b.time);

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

function getCompareTimestampGaps(device) {
  const baseTime = firstDeviceTime(device);
  return getTimestampGapsForRows(device.rows).map((gap) => ({
    ...gap,
    start: compareStatusTime(gap.start, baseTime),
    end: compareStatusTime(gap.end, baseTime),
  }));
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

function drawCompareGapBands(local, device, margin, width, height, xExtent) {
  const gaps = getCompareTimestampGaps(device).filter((gap) => gap.end >= xExtent[0] && gap.start <= xExtent[1]);
  if (!gaps.length) return;

  local.save();
  local.fillStyle = "rgba(236, 107, 98, 0.14)";
  gaps.forEach((gap) => {
    const start = Math.max(gap.start, xExtent[0]);
    const end = Math.min(gap.end, xExtent[1]);
    const x1 = margin.left + (start - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
    const x2 = margin.left + (end - xExtent[0]) / (xExtent[1] - xExtent[0]) * width;
    local.fillRect(x1, margin.top, Math.max(2, x2 - x1), height);
  });
  local.restore();
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

function drawZeroGuideLine(targetCtx, left, top, width, height, yExtent) {
  if (!Number.isFinite(yExtent[0]) || !Number.isFinite(yExtent[1])) return;
  if (yExtent[0] > 0 || yExtent[1] < 0 || yExtent[0] === yExtent[1]) return;

  const y = top + height - (0 - yExtent[0]) / (yExtent[1] - yExtent[0]) * height;
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.setLineDash([1.5, 5]);
  targetCtx.lineCap = "round";
  targetCtx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  targetCtx.lineWidth = 1;
  targetCtx.moveTo(left, y);
  targetCtx.lineTo(left + width, y);
  targetCtx.stroke();
  targetCtx.restore();
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
  let min = Infinity;
  let max = -Infinity;
  values.forEach((value) => {
    if (!Number.isFinite(value)) return;
    if (value < min) min = value;
    if (value > max) max = value;
  });
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : [NaN, NaN];
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
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  values.forEach((value) => {
    if (!Number.isFinite(value)) return;
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    count += 1;
  });
  return count ? { min, max, mean: sum / count } : { min: NaN, max: NaN, mean: NaN };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 100000 || Math.abs(value) < 0.01 && value !== 0) return value.toExponential(3);
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatEngineeringValue(value, unit) {
  if (!Number.isFinite(value)) return "n/a";
  return `${formatNumber(value)} ${unit}`;
}

function formatSignedPercent(value) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

function formatSignedNumber(value) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
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

function encodeUtf8(text) {
  return new TextEncoder().encode(text);
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileDateStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function createZipBlob(entries, mimeType) {
  const parts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encodeUtf8(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    parts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...parts, ...centralParts, endHeader], { type: mimeType });
}

let crcTable = null;

function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[index] = value >>> 0;
    }
  }

  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
}

renderAll();
