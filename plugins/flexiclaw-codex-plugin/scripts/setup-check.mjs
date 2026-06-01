#!/usr/bin/env node

import { loadElasticConfig } from "./config.mjs";

const DEFAULT_INDEX = "logs-*";
const REQUIRED_ELASTIC_TOOLS = ["platform_core_create_visualization"];

main().catch((error) => {
  console.error(`\nSetup check failed: ${error.message}`);
  if (error.details) {
    console.error(error.details);
  }
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadElasticConfig({ envPath: args.env, configPath: args.config });
  const index = args.index ?? DEFAULT_INDEX;
  const dataView = args.dataView ?? args.dataViewId;

  requireEnv(env, "KIBANA_URL");
  requireEnv(env, "ELASTIC_AUTH_HEADER");

  const kibanaUrl = trimTrailingSlash(env.KIBANA_URL);
  const toolsUrl =
    env.ELASTIC_TOOLS_URL ??
    env.ELASTIC_AGENT_BUILDER_MCP_URL ??
    `${kibanaUrl}/api/agent_builder/mcp?namespace=observability,platform.core,platform.streams`;

  const checks = [];
  await runCheck(checks, "kibana", () => checkKibana({ kibanaUrl, authHeader: env.ELASTIC_AUTH_HEADER }));
  await runCheck(checks, "data_views", () =>
    checkDataViews({
      kibanaUrl,
      authHeader: getDashboardAuthHeader(env),
      authSource: getDashboardAuthSource(env),
      index,
      dataView,
    }),
  );
  await runCheck(checks, "elastic_tools", () =>
    checkElasticTools({ toolsUrl, authHeader: env.ELASTIC_AUTH_HEADER }),
  );
  await runCheck(checks, "elasticsearch_preview", () =>
    checkElasticsearchPreview({
      elasticsearchUrl: env.ELASTICSEARCH_URL,
      authHeader: env.ELASTIC_AUTH_HEADER,
      index,
    }),
  );
  await runCheck(checks, "dashboard_lens_write", () =>
    checkDashboardLensWrite({
      enabled: Boolean(args.writeProbe),
      kibanaUrl,
      authHeader: getDashboardAuthHeader(env),
      index,
      dataView,
    }),
  );

  const failed = checks.filter((check) => check.status === "failed");
  const summary = {
    status: failed.length ? "failed" : "ok",
    kibanaHost: new URL(kibanaUrl).host,
    index,
    writeProbe: Boolean(args.writeProbe),
    checks,
    next: failed.length
      ? "Fix failed checks before generating dashboards."
      : "Generate a dashboard draft with: npm run flexiclaw:dashboard",
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write-probe") {
      args.writeProbe = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${arg}`);
    }
    const key = toCamelCase(arg.slice(2));
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function runCheck(checks, name, fn) {
  try {
    const result = await fn();
    checks.push({
      name,
      status: result.status ?? "ok",
      summary: result.summary,
      details: result.details,
    });
  } catch (error) {
    checks.push({
      name,
      status: "failed",
      summary: error.message,
      details: error.details,
    });
  }
}

async function checkKibana({ kibanaUrl, authHeader }) {
  const payload = await fetchJson({
    url: `${kibanaUrl}/api/status`,
    authHeader,
  });

  return {
    summary: `Kibana ${payload.version?.number ?? "unknown"} is reachable.`,
    details: {
      state: payload.status?.overall?.state,
      level: payload.status?.overall?.level,
    },
  };
}

async function checkDataViews({ kibanaUrl, authHeader, authSource, index, dataView }) {
  const dataViews = await listDataViews({ kibanaUrl, authHeader });
  const match = findDataView(dataViews, index, dataView);

  if (!match) {
    const error = new Error(`No Kibana data view found for index pattern: ${dataView ?? index}`);
    error.details = {
      availableDataViews: dataViews.slice(0, 10).map((entry) => ({
        id: entry.id,
        title: entry.title,
        name: entry.name,
      })),
    };
    throw error;
  }

  return {
    summary: `Data view found for ${index}.`,
    details: {
      id: match.id,
      title: match.title,
      timeFieldName: match.timeFieldName,
      availableDataViews: dataViews.length,
      authSource,
      requestedDataView: dataView,
    },
  };
}

async function checkElasticTools({ toolsUrl, authHeader }) {
  const payload = await callElasticTools({
    toolsUrl,
    authHeader,
    method: "tools/list",
    params: {},
  });

  const tools = payload.result?.tools ?? [];
  const toolNames = tools.map((tool) => tool.name).filter(Boolean);
  const missing = REQUIRED_ELASTIC_TOOLS.filter((name) => !toolNames.includes(name));

  if (missing.length) {
    throw new Error(`Missing required Elastic tools: ${missing.join(", ")}`);
  }

  return {
    summary: "Required Elastic dashboard tool is available.",
    details: {
      required: REQUIRED_ELASTIC_TOOLS,
      observabilityTools: toolNames.filter((name) => name.startsWith("observability_")).length,
      platformCoreTools: toolNames.filter((name) => name.startsWith("platform_core_")).length,
    },
  };
}

async function checkElasticsearchPreview({ elasticsearchUrl, authHeader, index }) {
  if (!elasticsearchUrl) {
    return {
      status: "skipped",
      summary: "ELASTICSEARCH_URL is not configured; preview buckets will be skipped.",
    };
  }

  const payload = await fetchJson({
    url: `${trimTrailingSlash(elasticsearchUrl)}/_resolve/index/${encodeURIComponent(index)}`,
    authHeader,
  });

  return {
    summary: `Elasticsearch can resolve ${index}.`,
    details: {
      indices: payload.indices?.length ?? 0,
      dataStreams: payload.data_streams?.length ?? 0,
      aliases: payload.aliases?.length ?? 0,
    },
  };
}

async function checkDashboardLensWrite({ enabled, kibanaUrl, authHeader, index, dataView }) {
  if (!enabled) {
    return {
      status: "skipped",
      summary: "Run with --write-probe to create and delete temporary Lens/dashboard saved objects.",
    };
  }

  const xsrf = "flexiclaw-setup-check";
  const dataViews = await listDataViews({ kibanaUrl, authHeader });
  const matchedDataView = findDataView(dataViews, index, dataView);
  if (!matchedDataView) {
    throw new Error(`No Kibana data view found for index pattern: ${index}`);
  }

  const id = `flexiclaw-setup-check-${Date.now()}`;
  const lensId = `${id}-lens`;
  const dashboardId = `${id}-dashboard`;
  const created = [];

  try {
    await createSavedObject({
      kibanaUrl,
      authHeader,
      xsrf,
      type: "lens",
      id: lensId,
      body: {
        attributes: buildProbeLensAttributes(),
        references: buildProbeLensReferences({ dataViewId: matchedDataView.id }),
      },
    });
    created.push({ type: "lens", id: lensId });

    await createSavedObject({
      kibanaUrl,
      authHeader,
      xsrf,
      type: "dashboard",
      id: dashboardId,
      body: {
        attributes: buildProbeDashboardAttributes(),
        references: [{ type: "lens", id: lensId, name: "panel_0" }],
      },
    });
    created.push({ type: "dashboard", id: dashboardId });

    return {
      summary: "Temporary Lens and dashboard saved objects were created and deleted successfully.",
      details: {
        dataViewId: matchedDataView.id,
        savedObjectTypes: ["lens", "dashboard"],
      },
    };
  } finally {
    const cleanupFailures = [];
    for (const object of created.toReversed()) {
      try {
        await deleteSavedObject({ kibanaUrl, authHeader, xsrf, type: object.type, id: object.id });
      } catch (error) {
        cleanupFailures.push(`${object.type}/${object.id}: ${error.message}`);
      }
    }
    if (cleanupFailures.length) {
      const error = new Error("Write probe cleanup failed");
      error.details = cleanupFailures.join("\n");
      throw error;
    }
  }
}

function buildProbeLensReferences({ dataViewId }) {
  return [
    {
      type: "index-pattern",
      id: dataViewId,
      name: "indexpattern-datasource-current-indexpattern",
    },
    {
      type: "index-pattern",
      id: dataViewId,
      name: "indexpattern-datasource-layer-flexiclaw-setup-check-layer",
    },
  ];
}

function buildProbeLensAttributes() {
  const layerId = "flexiclaw-setup-check-layer";
  const xColumnId = "flexiclaw-setup-check-timestamp";
  const yColumnId = "flexiclaw-setup-check-count";

  return {
    title: "Flexiclaw setup check",
    description: "Temporary Lens saved object created by Flexiclaw setup validation.",
    visualizationType: "lnsXY",
    state: {
      datasourceStates: {
        formBased: {
          layers: {
            [layerId]: {
              columnOrder: [xColumnId, yColumnId],
              columns: {
                [xColumnId]: {
                  dataType: "date",
                  isBucketed: true,
                  label: "@timestamp",
                  operationType: "date_histogram",
                  params: {
                    interval: "auto",
                    includeEmptyRows: true,
                    dropPartials: false,
                  },
                  scale: "interval",
                  sourceField: "@timestamp",
                },
                [yColumnId]: {
                  customLabel: true,
                  dataType: "number",
                  isBucketed: false,
                  label: "Document count",
                  operationType: "count",
                  params: {},
                  scale: "ratio",
                  sourceField: "___records___",
                },
              },
              incompleteColumns: {},
            },
          },
        },
      },
      filters: [],
      query: {
        language: "kuery",
        query: "",
      },
      visualization: {
        axisTitlesVisibilitySettings: {
          x: true,
          yLeft: true,
          yRight: true,
        },
        fittingFunction: "None",
        gridlinesVisibilitySettings: {
          x: true,
          yLeft: true,
          yRight: true,
        },
        layers: [
          {
            accessors: [yColumnId],
            layerId,
            layerType: "data",
            position: "top",
            seriesType: "bar_stacked",
            showGridlines: false,
            xAccessor: xColumnId,
          },
        ],
        legend: {
          isVisible: false,
          position: "right",
          legendSize: "auto",
        },
        preferredSeriesType: "bar_stacked",
        tickLabelsVisibilitySettings: {
          x: true,
          yLeft: true,
          yRight: true,
        },
        valueLabels: "hide",
        yLeftExtent: {
          mode: "full",
        },
        yRightExtent: {
          mode: "full",
        },
      },
    },
  };
}

function buildProbeDashboardAttributes() {
  return {
    title: "Flexiclaw setup check",
    description: "Temporary dashboard saved object created by Flexiclaw setup validation.",
    timeRestore: false,
    refreshInterval: {
      pause: true,
      value: 60000,
    },
    optionsJSON: JSON.stringify({
      useMargins: true,
      syncColors: false,
      syncCursor: true,
      syncTooltips: false,
      hidePanelTitles: false,
    }),
    kibanaSavedObjectMeta: {
      searchSourceJSON: JSON.stringify({
        query: { language: "kuery", query: "" },
        filter: [],
      }),
    },
    panelsJSON: JSON.stringify([
      {
        version: "9.4.0",
        type: "lens",
        gridData: {
          x: 0,
          y: 0,
          w: 24,
          h: 15,
          i: "flexiclaw-setup-check-panel",
        },
        panelIndex: "flexiclaw-setup-check-panel",
        embeddableConfig: {
          enhancements: {},
        },
        panelRefName: "panel_0",
        title: "Flexiclaw setup check",
      },
    ]),
  };
}

async function listDataViews({ kibanaUrl, authHeader }) {
  const payload = await fetchJson({
    url: `${kibanaUrl}/api/data_views`,
    authHeader,
    xsrf: "flexiclaw-setup-check",
  });
  return normalizeDataViews(payload.data_view ?? payload.data_views ?? []);
}

function normalizeDataViews(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

function findDataView(dataViews, index, dataView) {
  const requested = dataView ?? index;
  const exactMatch = dataViews.find((entry) => entry.id === requested || entry.title === requested);
  return (
    exactMatch ??
    dataViews.find((entry) => typeof entry.title === "string" && entry.title.split(",").includes(index))
  );
}

async function createSavedObject({ kibanaUrl, authHeader, xsrf, type, id, body }) {
  return fetchJson({
    url: `${kibanaUrl}/api/saved_objects/${type}/${id}?overwrite=true`,
    method: "POST",
    authHeader,
    xsrf,
    body,
  });
}

async function deleteSavedObject({ kibanaUrl, authHeader, xsrf, type, id }) {
  return fetchJson({
    url: `${kibanaUrl}/api/saved_objects/${type}/${id}`,
    method: "DELETE",
    authHeader,
    xsrf,
  });
}

async function callElasticTools({ toolsUrl, authHeader, method, params }) {
  const response = await fetch(toolsUrl, {
    method: "POST",
    headers: {
      authorization: authHeader,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `flexiclaw-setup-${method}`,
      method,
      params,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw httpError(`Elastic tools ${method} failed`, response, text);
  }

  const payload = parseJsonOrSse(text);
  if (payload.error) {
    throw new Error(`Elastic tools ${method} returned JSON-RPC error: ${JSON.stringify(payload.error)}`);
  }
  return payload;
}

async function fetchJson({ url, method = "GET", authHeader, xsrf, body }) {
  const headers = {
    authorization: authHeader,
    accept: "application/json",
  };

  if (xsrf) {
    headers["kbn-xsrf"] = xsrf;
  }
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw httpError(`HTTP request failed for ${new URL(url).pathname}`, response, text);
  }
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text);
}

function parseJsonOrSse(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty response body");
  }
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const dataPayloads = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line && line !== "[DONE]");

  const jsonPayload = dataPayloads.findLast((line) => line.startsWith("{"));
  if (!jsonPayload) {
    throw new Error("Could not parse JSON or SSE response");
  }

  return JSON.parse(jsonPayload);
}

function requireEnv(env, key) {
  if (!env[key]) {
    throw new Error(
      `Missing required Elastic setting: ${key}. Configure it in ~/.config/flexiclaw/config.json, flexiclaw.config.local.json, .env.local or the process environment.`,
    );
  }
}

function getDashboardAuthHeader(env) {
  return env.ELASTIC_DASHBOARD_AUTH_HEADER ?? env.ELASTIC_AUTH_HEADER;
}

function getDashboardAuthSource(env) {
  return env.ELASTIC_DASHBOARD_AUTH_HEADER ? "ELASTIC_DASHBOARD_AUTH_HEADER" : "ELASTIC_AUTH_HEADER";
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function httpError(message, response, body) {
  const error = new Error(`${message}: HTTP ${response.status}`);
  error.details = body.slice(0, 1000);
  return error;
}
