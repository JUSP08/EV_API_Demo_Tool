const STORAGE_KEY = "evApiTester.v1";

const DATAPOINTS = {
  2106: {
    name: "OverrideAbsoluteWaterFlow",
    endpoint: "/api/v1/mpmodelid/2106",
    defaultValue: "0.0016",
    unitType: "flow",
    baseUnit: "m3/s",
    group: "Flow override and sensor errors",
    order: 1,
    layoutColumn: 1,
    layoutRow: 1,
  },
  2115: {
    name: "OverrideFlowBodyWaterTemperature",
    endpoint: "/api/v1/mpmodelid/2115",
    defaultValue: "293.15",
    unitType: "temperature",
    baseUnit: "K",
    group: "Temperature override",
    order: 1,
  },
  2105: {
    name: "OverrideU5AnalogOutputValue",
    endpoint: "/api/v1/mpmodelid/2105",
    defaultValue: "-12345",
    unitType: "percent",
    baseUnit: "%",
    group: "Analog I/O",
    order: 2,
  },
  2112: {
    name: "OverrideY3AnalogInputValue",
    endpoint: "/api/v1/mpmodelid/2112",
    defaultValue: "-12345",
    unitType: "percent",
    baseUnit: "%",
    group: "Analog I/O",
    order: 1,
  },
  2113: {
    name: "OverridePcbaY3AnalogForcedControl",
    endpoint: "/api/v1/mpmodelid/2113",
    defaultValue: "-12345",
    unitType: "status",
    baseUnit: "raw",
    group: "Analog I/O",
    order: 3,
  },
  AOVoltSet: {
    name: "AOVoltSet",
    endpoint: "/api/v1/datapoints/application/CerebrasDAD/AOVoltSet",
    defaultValue: "0",
    unitType: "voltage",
    baseUnit: "V",
    group: "Analog I/O",
    order: 4,
    source: "CerebrasDAD",
  },
  2121: {
    name: "OverridePersistentWaterFlowSensorDeviceErrorStatus",
    endpoint: "/api/v1/mpmodelid/2121",
    defaultValue: "-12345",
    unitType: "status",
    baseUnit: "raw",
    group: "Flow override and sensor errors",
    order: 2,
    layoutColumn: 1,
    layoutRow: 2,
  },
  2120: {
    name: "OverrideNonPersistentWaterFlowSensorDeviceErrorStatus",
    endpoint: "/api/v1/mpmodelid/2120",
    defaultValue: "-12345",
    unitType: "status",
    baseUnit: "raw",
    group: "Flow override and sensor errors",
    order: 3,
    layoutColumn: 2,
    layoutRow: 2,
  },
  35: {
    name: "FlowHighAlarmLimit",
    endpoint: "/api/v1/datapoints/application/CerebrasDAD/FlowHighAlarmLimit",
    defaultValue: "110",
    unitType: "flow",
    baseUnit: "lpm",
    group: "Flow override and sensor errors",
    order: 4,
    layoutColumn: 1,
    layoutRow: 3,
    source: "CerebrasDAD",
  },
  38: {
    name: "FlowLowAlarmLimit",
    endpoint: "/api/v1/datapoints/application/CerebrasDAD/FlowLowAlarmLimit",
    defaultValue: "90",
    unitType: "flow",
    baseUnit: "lpm",
    group: "Flow override and sensor errors",
    order: 5,
    layoutColumn: 2,
    layoutRow: 3,
    source: "CerebrasDAD",
  },
  44: {
    name: "TempHighAlarmLimit",
    endpoint: "/api/v1/datapoints/application/CerebrasDAD/TempHighAlarmLimit",
    defaultValue: "30",
    unitType: "temperature",
    baseUnit: "C",
    group: "Temperature override",
    source: "CerebrasDAD",
  },
  46: {
    name: "TempLowAlarmLimit",
    endpoint: "/api/v1/datapoints/application/CerebrasDAD/TempLowAlarmLimit",
    defaultValue: "20",
    unitType: "temperature",
    baseUnit: "C",
    group: "Temperature override",
    source: "CerebrasDAD",
  },
  56: {
    name: "InRangeActiveHigh",
    endpoint: "/api/v1/datapoints/application/CerebrasDAD/InRangeActiveHigh",
    defaultValue: "1",
    unitType: "status",
    baseUnit: "raw",
    group: "InRange settings",
    source: "CerebrasDAD",
  },
  111: {
    name: "SelectWaterControlMode",
    endpoint: "/api/v1/mpmodelid/111",
    defaultValue: "1",
    unitType: "controlMode",
    baseUnit: "mode",
    group: "Control mode",
  },
};

const OUTPUT_STATES = {
  AOStatus: {
    name: "AOStatus",
    endpoint: "/api/v1/datapoints/application/CerebrasDAD/AOStatus",
    source: "CerebrasDAD",
  },
  InRangeStatus: {
    name: "InRangeStatus",
    endpoint: "/api/v1/datapoints/application/CerebrasDAD/InRangeStatus",
    source: "CerebrasDAD",
  },
};

const UNITS = {
  flow: [
    { value: "m3/s", label: "m3/s" },
    { value: "lpm", label: "lpm" },
    { value: "gpm", label: "gpm" },
  ],
  temperature: [
    { value: "K", label: "K" },
    { value: "C", label: "deg C" },
    { value: "F", label: "deg F" },
  ],
  percent: [{ value: "%", label: "%" }],
  voltage: [{ value: "V", label: "V" }],
  status: [{ value: "raw", label: "raw" }],
  controlMode: [{ value: "mode", label: "mode" }],
};

const fields = {
  ip: document.querySelector("#ip"),
  secondaryIp: document.querySelector("#secondaryIp"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  saveLocal: document.querySelector("#saveLocal"),
  endpoint: document.querySelector("#endpoint"),
};

const datapointList = document.querySelector("#datapointList");
const outputStateList = document.querySelector("#outputStateList");
const preview = document.querySelector("#preview");
const responseBox = document.querySelector("#response");
const statusPill = document.querySelector("#status");

let pollTimer = null;
let rampTimer = null;
let rampStep = 0;
let rampBusy = false;
let selectedModelId = "2106";
let savedState = {};

function loadSaved() {
  savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  fields.ip.value = savedState.ip || fields.ip.value;
  fields.secondaryIp.value = savedState.secondaryIp || fields.secondaryIp.value;
  fields.username.value = savedState.username || fields.username.value;
  fields.password.value = savedState.password || fields.password.value;
  fields.saveLocal.checked = savedState.saveLocal ?? true;
}

function saveState() {
  if (!fields.saveLocal.checked) {
    localStorage.removeItem(STORAGE_KEY);
    savedState = {};
    return;
  }

  savedState = {
    ip: fields.ip.value,
    secondaryIp: fields.secondaryIp.value,
    username: fields.username.value,
    password: fields.password.value,
    saveLocal: fields.saveLocal.checked,
    datapoints: {},
  };

  document.querySelectorAll(".datapoint-card").forEach((card) => {
    savedState.datapoints[card.dataset.modelId] = {
      value: card.querySelector("[data-role='value']").value,
      unit: card.querySelector("[data-role='unit']").value,
      rampDelta: card.querySelector("[data-role='ramp-delta']")?.value,
      rampIntervals: card.querySelector("[data-role='ramp-intervals']")?.value,
      rampPeriod: card.querySelector("[data-role='ramp-period']")?.value,
    };
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
}

function groupedDatapoints() {
  const groupOrder = [
    "Flow override and sensor errors",
    "Temperature override",
    "Analog I/O",
    "InRange settings",
    "Control mode",
  ];

  const entries = Object.entries(DATAPOINTS);
  return groupOrder
    .map((group) => [
      group,
      entries
        .filter(([, datapoint]) => datapoint.group === group)
        .sort(([, a], [, b]) => (a.order || 99) - (b.order || 99)),
    ])
    .filter(([, groupEntries]) => groupEntries.length > 0);
}

function renderDatapoints() {
  datapointList.innerHTML = groupedDatapoints()
    .map(([group, entries]) => {
      const cards = entries.map(([modelId, datapoint]) => cardTemplate(modelId, datapoint)).join("");
      return `
        <section class="datapoint-group ${group === "Flow override and sensor errors" ? "flow-group" : ""}">
          <h3>${group}</h3>
          <div class="datapoint-group-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  datapointList.querySelectorAll(".datapoint-card").forEach((card) => {
    const modelId = card.dataset.modelId;
    card.querySelector("[data-role='select']").addEventListener("click", () => selectCard(modelId));
    card.querySelector("[data-role='write']").addEventListener("click", () => writeDatapoint(modelId));
    card.querySelector("[data-role='ramp']")?.addEventListener("click", () => toggleRamp(modelId));
    card.querySelector("[data-role='value']").addEventListener("input", () => {
      selectCard(modelId);
      saveState();
      updatePreview(modelId);
    });
    card.querySelector("[data-role='unit']").addEventListener("change", () => {
      selectCard(modelId);
      saveState();
      updatePreview(modelId);
    });
    card.querySelectorAll("input[data-role^='ramp-']").forEach((input) =>
      input.addEventListener("input", () => {
        selectCard(modelId);
        saveState();
      }),
    );
  });

  selectCard(selectedModelId);
}

function cardTemplate(modelId, datapoint) {
  const saved = savedState.datapoints?.[modelId] || {};
  const value = saved.value ?? datapoint.defaultValue;
  const units = UNITS[datapoint.unitType] || [{ value: "raw", label: "raw" }];
  const selectedUnit = saved.unit || datapoint.baseUnit || units[0].value;
  const unitOptions = units
    .map((unit) => `<option value="${unit.value}" ${unit.value === selectedUnit ? "selected" : ""}>${unit.label}</option>`)
    .join("");
  const placement = [
    datapoint.layoutColumn ? `data-layout-column="${datapoint.layoutColumn}"` : "",
    datapoint.layoutRow ? `data-layout-row="${datapoint.layoutRow}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const placementAttributes = placement ? ` ${placement}` : "";

  return `
    <article class="datapoint-card" data-model-id="${modelId}"${placementAttributes}>
      <button class="datapoint-title" type="button" data-role="select">
        <strong>${datapoint.name}</strong>
        <span>${datapoint.source || `MP ${modelId}`}</span>
      </button>
      <div class="card-controls">
        <input data-role="value" value="${value}" inputmode="decimal" aria-label="${datapoint.name} value" />
        <select data-role="unit" aria-label="${datapoint.name} unit">${unitOptions}</select>
        <button class="write-small" type="button" data-role="write">Write</button>
      </div>
      ${modelId === "2106" ? rampTemplate(saved) : ""}
    </article>
  `;
}

function rampTemplate(saved) {
  return `
    <div class="ramp-controls">
      <button class="ramp-toggle" type="button" data-role="ramp">Start ramp</button>
      <label class="ramp-field">
        <span>Delta</span>
        <input data-role="ramp-delta" value="${saved.rampDelta ?? "0.5"}" inputmode="decimal" aria-label="Ramp delta" />
      </label>
      <label class="ramp-field">
        <span>Intervals</span>
        <input data-role="ramp-intervals" value="${saved.rampIntervals ?? "4"}" inputmode="numeric" aria-label="Ramp intervals per period" />
      </label>
      <label class="ramp-field">
        <span>Period s</span>
        <input data-role="ramp-period" value="${saved.rampPeriod ?? "4"}" inputmode="decimal" aria-label="Ramp period length in seconds" />
      </label>
      <span data-role="ramp-status">Ramp off</span>
    </div>
  `;
}

function renderOutputStates() {
  outputStateList.innerHTML = Object.entries(OUTPUT_STATES)
    .map(([stateId, state]) => `
      <article class="output-state-card" data-output-id="${stateId}">
        <div>
          <strong>${state.name}</strong>
          <span>${state.source || stateId}</span>
        </div>
        <output>--</output>
      </article>
    `)
    .join("");
}

function selectCard(modelId) {
  selectedModelId = modelId;
  document.querySelectorAll(".datapoint-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.modelId === modelId);
  });

  fields.endpoint.value = DATAPOINTS[modelId].endpoint;
  updatePreview(modelId);
}

function cardValues(modelId) {
  const card = document.querySelector(`.datapoint-card[data-model-id="${modelId}"]`);
  const datapoint = DATAPOINTS[modelId];
  return {
    datapoint,
    value: card.querySelector("[data-role='value']").value.trim(),
    unit: card.querySelector("[data-role='unit']").value,
  };
}

function convertValueForRequest(modelId) {
  const { datapoint, value, unit } = cardValues(modelId);
  return convertValue(datapoint, value, unit);
}

function convertValue(datapoint, value, unit) {
  const rawValue = Number(value);
  if (!Number.isFinite(rawValue)) return value;

  if (datapoint.unitType === "temperature") {
    const kelvin = unit === "C" ? rawValue + 273.15 : unit === "F" ? (rawValue - 32) * (5 / 9) + 273.15 : rawValue;
    if (datapoint.baseUnit === "C") return formatNumber(kelvin - 273.15);
    if (datapoint.baseUnit === "F") return formatNumber((kelvin - 273.15) * (9 / 5) + 32);
    return formatNumber(kelvin);
  }

  if (datapoint.unitType === "flow") {
    const cubicMetersPerSecond = unit === "lpm" ? rawValue / 60000 : unit === "gpm" ? rawValue * 0.0000630901964 : rawValue;
    if (datapoint.baseUnit === "lpm") return formatNumber(cubicMetersPerSecond * 60000);
    if (datapoint.baseUnit === "gpm") return formatNumber(cubicMetersPerSecond / 0.0000630901964);
    return formatNumber(cubicMetersPerSecond);
  }

  return value;
}

function formatNumber(value) {
  return Number(value.toFixed(10)).toString();
}

function buildPayload(modelId) {
  return `{'value':${convertValueForRequest(modelId)}}`;
}

function writeIps() {
  return [fields.ip.value.trim(), fields.secondaryIp.value.trim()].filter(Boolean);
}

function updatePreview(modelId = selectedModelId) {
  const datapoint = DATAPOINTS[modelId];
  fields.endpoint.value = datapoint.endpoint;
  preview.textContent = writeIps()
    .map((ip) => `curl.exe --noproxy "*" --connect-timeout 8 --basic -X PUT -k "https://${ip}:443${datapoint.endpoint}" -u "${fields.username.value.trim()}:********" -d "${buildPayload(modelId)}"`)
    .join("\n");
}

function setStatus(label, className) {
  statusPill.textContent = label;
  statusPill.className = `status ${className}`;
}

async function writeDatapoint(modelId) {
  selectCard(modelId);
  saveState();

  const card = document.querySelector(`.datapoint-card[data-model-id="${modelId}"]`);
  const button = card.querySelector("[data-role='write']");
  const datapoint = DATAPOINTS[modelId];
  button.disabled = true;
  setStatus("Writing", "idle");
  responseBox.textContent = `Writing ${datapoint.name}...`;

  try {
    const { response, data } = await sendWrite(datapoint, convertValueForRequest(modelId));
    showWriteResult(response, data);
  } catch (error) {
    responseBox.textContent = error.message;
    setStatus("Failed", "error");
  } finally {
    button.disabled = false;
  }
}

async function sendWrite(datapoint, value) {
  const response = await fetch("/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ips: writeIps(),
      username: fields.username.value.trim(),
      password: fields.password.value,
      endpoint: datapoint.endpoint,
      value,
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { response, data };
}

function showWriteResult(response, data) {
  responseBox.textContent = JSON.stringify(data, null, 2);
  setStatus(response.ok ? "Success" : "Failed", response.ok ? "ok" : "error");
  if (response.ok) updateOutputStates();
}

function toggleRamp(modelId) {
  if (modelId !== "2106") return;
  if (rampTimer) {
    stopRamp();
    return;
  }

  selectCard(modelId);
  saveState();
  const ramp = rampSettings();
  if (!ramp.ok) {
    responseBox.textContent = `Ramp stopped: ${ramp.error}`;
    setStatus("Ramp stopped", "error");
    return;
  }

  rampStep = 0;
  runRampStep();
  rampTimer = setInterval(runRampStep, ramp.intervalMs);
  updateRampUi(true);
}

function stopRamp() {
  if (rampTimer) clearInterval(rampTimer);
  rampTimer = null;
  rampBusy = false;
  updateRampUi(false);
}

async function runRampStep() {
  if (rampBusy) return;

  const modelId = "2106";
  const { datapoint, value, unit } = cardValues(modelId);
  const baseValue = Number(value);
  const ramp = rampSettings();
  if (!Number.isFinite(baseValue)) {
    stopRamp();
    responseBox.textContent = "Ramp stopped: MP 2106 value must be numeric.";
    setStatus("Ramp stopped", "error");
    return;
  }
  if (!ramp.ok) {
    stopRamp();
    responseBox.textContent = `Ramp stopped: ${ramp.error}`;
    setStatus("Ramp stopped", "error");
    return;
  }

  const phase = (2 * Math.PI * (rampStep % ramp.intervals)) / ramp.intervals;
  const displayValue = formatNumber(baseValue + ramp.delta * Math.sin(phase));
  const requestValue = convertValue(datapoint, displayValue, unit);
  rampStep += 1;
  rampBusy = true;
  setRampStatus(`Writing ${displayValue} ${unit}`);
  setStatus("Ramping", "idle");

  try {
    const { response, data } = await sendWrite(datapoint, requestValue);
    responseBox.textContent = JSON.stringify(data, null, 2);
    setStatus(response.ok ? "Ramping" : "Ramp failed", response.ok ? "ok" : "error");
    setRampStatus(response.ok ? `Last ${displayValue} ${unit}` : "Write failed");
    if (response.ok) updateOutputStates();
  } catch (error) {
    responseBox.textContent = error.message;
    setStatus("Ramp failed", "error");
    setRampStatus("Write failed");
  } finally {
    rampBusy = false;
  }
}

function updateRampUi(isRunning) {
  const card = document.querySelector(`.datapoint-card[data-model-id="2106"]`);
  if (!card) return;

  const button = card.querySelector("[data-role='ramp']");
  button.textContent = isRunning ? "Stop ramp" : "Start ramp";
  button.classList.toggle("running", isRunning);
  if (!isRunning) setRampStatus("Ramp off");
}

function setRampStatus(text) {
  const card = document.querySelector(`.datapoint-card[data-model-id="2106"]`);
  card?.querySelector("[data-role='ramp-status']")?.replaceChildren(document.createTextNode(text));
}

function rampSettings() {
  const card = document.querySelector(`.datapoint-card[data-model-id="2106"]`);
  const delta = Number(card?.querySelector("[data-role='ramp-delta']")?.value.trim());
  const intervals = Number(card?.querySelector("[data-role='ramp-intervals']")?.value.trim());
  const periodSeconds = Number(card?.querySelector("[data-role='ramp-period']")?.value.trim());

  if (!Number.isFinite(delta)) return { ok: false, error: "delta must be numeric." };
  if (!Number.isInteger(intervals) || intervals < 3) return { ok: false, error: "intervals per period must be an integer of 3 or more." };
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) return { ok: false, error: "period length must be greater than 0 seconds." };

  return {
    ok: true,
    delta,
    intervals,
    periodSeconds,
    intervalMs: Math.max(100, (periodSeconds * 1000) / intervals),
  };
}

async function readOutputState(stateId) {
  const state = OUTPUT_STATES[stateId];
  try {
    const response = await fetch("/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip: fields.ip.value.trim(),
        username: fields.username.value.trim(),
        password: fields.password.value,
        endpoint: state.endpoint,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      setOutputState(stateId, "Read failed", "error");
      return;
    }

    const valveValue = extractValveValue(data.stdout);
    setOutputState(stateId, valveValue ?? "--", "ok");
  } catch {
    setOutputState(stateId, "Read failed", "error");
  }
}

function setOutputState(stateId, value, state = "ok") {
  const card = document.querySelector(`.output-state-card[data-output-id="${stateId}"]`);
  if (!card) return;

  card.className = `output-state-card ${state}`;
  card.querySelector("output").textContent = value;
}

function extractValveValue(payload) {
  const point = payload?.datapoints?.[0];
  return point?.value ?? null;
}

function updateOutputStates(stateIds = Object.keys(OUTPUT_STATES)) {
  if (!fields.password.value) return;
  stateIds.forEach((stateId) => readOutputState(stateId));
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  updateOutputStates();
  pollTimer = setInterval(updateOutputStates, 5000);
}

loadSaved();
renderDatapoints();
renderOutputStates();
updatePreview();
startPolling();

Object.values(fields).forEach((input) => {
  input.addEventListener("input", () => {
    saveState();
    updatePreview();
  });
  input.addEventListener("change", () => {
    saveState();
    updatePreview();
    startPolling();
  });
});
