#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadElasticConfig } from "./config.mjs";

const DEFAULT_DATE_TOKEN = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const DEFAULT_PRESET = "logs-overview";
const DEFAULT_RENDERER = "lens";

const PRESET_DEFAULTS = {
  "log-volume": {
    idPrefix: "flexiclaw-log-volume",
    title: "[Flexiclaw] Log Volume",
    index: "logs-*",
  },
  "logs-overview": {
    idPrefix: "flexiclaw-logs-overview",
    title: "[Flexiclaw] Logs Overview",
    index: "logs-*",
  },
  "service-incident-overview": {
    idPrefix: "flexiclaw-service-incident",
    title: "[Flexiclaw] Service Incident Overview",
    index: "logs-*",
  },
  "apm-service-overview": {
    idPrefix: "flexiclaw-apm-service-overview",
    title: "[Flexiclaw] APM Service Overview",
    index: "traces-apm*",
  },
};

const PANEL_PRESETS = {
  "log-volume": [
    {
      id: "log-volume-over-time",
      title: "Log volume over time",
      question: "How many log documents were ingested over the selected time window?",
      chartType: "xy",
      visualizationPrompt:
        "Create an XY time series visualization showing log document count over time.",
      preview: {
        kind: "date_histogram",
        field: "@timestamp",
        interval: "30m",
      },
    },
  ],
  "logs-overview": [
    {
      id: "log-volume-over-time",
      title: "Log volume over time",
      question: "How many log documents were ingested over the selected time window?",
      chartType: "xy",
      visualizationPrompt:
        "Create an XY time series visualization showing log document count over time.",
      preview: {
        kind: "date_histogram",
        field: "@timestamp",
        interval: "30m",
      },
    },
    {
      id: "log-level-breakdown",
      title: "Log level breakdown",
      question: "Which log levels dominate the selected time window?",
      chartType: "pie",
      visualizationPrompt: "Create a visualization showing log document count by log.level.",
      preview: {
        kind: "terms",
        field: "log.level",
        size: 10,
      },
    },
    {
      id: "top-datasets-by-log-volume",
      title: "Top log datasets by volume",
      question: "Which Elastic log datasets are producing the most documents?",
      chartType: "datatable",
      visualizationPrompt:
        "Create a datatable showing the top 10 data_stream.dataset values by log document count.",
      preview: {
        kind: "terms",
        field: "data_stream.dataset",
        size: 10,
      },
    },
  ],
  "service-incident-overview": [
    {
      id: "service-log-volume-over-time",
      title: "Service log volume over time",
      question: "Is the affected service producing an unusual amount of logs?",
      chartType: "xy",
      visualizationPrompt:
        "Create an XY time series visualization showing log document count over time for the investigated service.",
      preview: {
        kind: "date_histogram",
        field: "@timestamp",
        interval: "30m",
      },
    },
    {
      id: "error-warning-volume-over-time",
      title: "Error and warning volume over time",
      question: "When did errors and warnings increase for the investigated service?",
      chartType: "xy",
      visualizationPrompt:
        "Create an XY time series visualization showing error and warning log count over time.",
      preview: {
        kind: "date_histogram",
        field: "@timestamp",
        interval: "30m",
        filter: logLevelFilter(["error", "fatal", "warn", "warning"]),
      },
    },
    {
      id: "log-level-breakdown",
      title: "Log level breakdown",
      question: "Which log severities dominate the incident window?",
      chartType: "pie",
      visualizationPrompt: "Create a visualization showing log document count by log.level.",
      preview: {
        kind: "terms",
        field: "log.level",
        size: 10,
      },
    },
    {
      id: "affected-hosts-by-log-volume",
      title: "Affected hosts by log volume",
      question: "Which hosts are producing the most logs during the incident window?",
      chartType: "datatable",
      visualizationPrompt: "Create a datatable showing top host.name values by log document count.",
      preview: {
        kind: "terms",
        field: "host.name",
        size: 10,
      },
    },
    {
      id: "error-warning-datasets",
      title: "Error and warning datasets",
      question: "Which data streams are contributing the most error and warning logs?",
      chartType: "datatable",
      visualizationPrompt:
        "Create a datatable showing top data_stream.dataset values by error and warning log count.",
      preview: {
        kind: "terms",
        field: "data_stream.dataset",
        size: 10,
        filter: logLevelFilter(["error", "fatal", "warn", "warning"]),
      },
    },
  ],
  "apm-service-overview": [
    {
      id: "apm-latency-p95-p99",
      title: "APM latency p95 and p99",
      question: "Did high-percentile service latency increase during the incident window?",
      chartType: "xy",
      visualizationPrompt:
        "Create an XY time series visualization showing APM transaction latency p95 and p99 over time.",
      preview: {
        kind: "date_histogram",
        field: "@timestamp",
        interval: "30m",
        filter: apmTransactionFilter(),
        metrics: [
          percentileMetric({
            id: "latency_p95_ms",
            label: "p95 latency (ms)",
            percentile: 95,
          }),
          percentileMetric({
            id: "latency_p99_ms",
            label: "p99 latency (ms)",
            percentile: 99,
          }),
        ],
      },
    },
    {
      id: "apm-transaction-volume",
      title: "APM transaction volume",
      question: "Did request volume change during the incident window?",
      chartType: "xy",
      visualizationPrompt:
        "Create an XY time series visualization showing APM transaction count over time.",
      preview: {
        kind: "date_histogram",
        field: "@timestamp",
        interval: "30m",
        filter: apmTransactionFilter(),
        metrics: [countMetric({ id: "transaction_count", label: "Transaction count" })],
      },
    },
    {
      id: "apm-error-rate",
      title: "APM error rate",
      question: "When did failed transaction rate increase?",
      chartType: "xy",
      visualizationPrompt:
        "Create an XY time series visualization showing APM failed transaction rate over time.",
      preview: {
        kind: "date_histogram",
        field: "@timestamp",
        interval: "30m",
        filter: apmTransactionFilter(),
        metrics: [errorRateMetric()],
      },
    },
    {
      id: "apm-top-transactions-by-latency",
      title: "Top transactions by p95 latency",
      question: "Which transactions have the highest p95 latency?",
      chartType: "datatable",
      visualizationPrompt:
        "Create a datatable showing top transaction.name values with APM p95 transaction latency.",
      preview: {
        kind: "terms",
        field: "transaction.name",
        size: 10,
        filter: apmTransactionFilter(),
        metrics: [
          percentileMetric({
            id: "latency_p95_ms",
            label: "p95 latency (ms)",
            percentile: 95,
          }),
        ],
      },
    },
    {
      id: "apm-top-transactions-by-failures",
      title: "Top transactions by failures",
      question: "Which transactions are producing the most failed outcomes?",
      chartType: "datatable",
      visualizationPrompt:
        "Create a datatable showing top transaction.name values by failed APM transaction count.",
      preview: {
        kind: "terms",
        field: "transaction.name",
        size: 10,
        filter: apmTransactionFilter(),
        metrics: [failureCountMetric()],
      },
    },
  ],
};

main().catch((error) => {
  console.error(`\nE2E failed: ${error.message}`);
  if (error.details) {
    console.error(error.details);
  }
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await loadElasticConfig({ envPath: args.env, configPath: args.config });

  requireEnv(env, "KIBANA_URL");

  const kibanaUrl = trimTrailingSlash(env.KIBANA_URL);
  const outDir = path.resolve(process.cwd(), args.outDir ?? "artifacts/dashboard-e2e");

  if (args.fromDraft) {
    const draftPath = path.resolve(process.cwd(), args.fromDraft);
    const draft = JSON.parse(await readFile(draftPath, "utf8"));
    const renderer = getRenderer(args);
    const publishResult = await publishDashboard({
      kibanaUrl,
      authHeader: getPublishAuthHeader(env),
      draft,
      renderer,
    });
    const publishPath = path.join(path.dirname(draftPath), `${draft.dashboard.id}.publish.json`);
    await writeFile(publishPath, `${JSON.stringify(publishResult, null, 2)}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          status: "ok",
          mode: "publish-from-draft",
          renderer,
          dashboardId: draft.dashboard.id,
          attachmentIds: draft.dashboard.panels.map((panel) => panel.source?.attachmentId).filter(Boolean),
          toolResultIds: draft.dashboard.panels.map((panel) => panel.source?.toolResultId).filter(Boolean),
          draftPath,
          previewPath: previewPathForDraft(draftPath, draft),
          publishPath,
          dashboardUrl: publishResult.dashboardUrl,
        },
        null,
        2,
      ),
    );
    return;
  }

  requireEnv(env, "ELASTIC_AUTH_HEADER");

  const preset = args.preset ?? DEFAULT_PRESET;
  const dashboardId = args.id ?? defaultIdForPreset(preset);
  const title = args.title ?? defaultTitleForPreset(preset);
  const index = args.index ?? defaultIndexForPreset(preset);
  const dataView = args.dataView ?? args.dataViewId;
  const timeFrom = args.timeFrom ?? "now-30d";
  const timeTo = args.timeTo ?? "now";
  const filters = buildGlobalFilters({
    service: args.service,
    environment: args.environment,
  });
  const mcpUrl =
    env.ELASTIC_TOOLS_URL ??
    env.ELASTIC_AGENT_BUILDER_MCP_URL ??
    `${kibanaUrl}/api/agent_builder/mcp?namespace=observability,platform.core,platform.streams`;
  const panelSpecs = getPanelSpecs(preset);

  await mkdir(outDir, { recursive: true });

  const panels = [];
  for (const spec of panelSpecs) {
    const query = [
      spec.visualizationPrompt,
      `Use ${index}.`,
      `Title it ${title} - ${spec.title}.`,
      ...buildElasticToolContext({ filters, spec }),
    ].join(" ");

    const agentVisualization = await createElasticVisualizationOrFallback({
      mcpUrl,
      authHeader: env.ELASTIC_AUTH_HEADER,
      query,
      index,
      spec,
      chartType: spec.chartType,
    });

    const previewData = await fetchPreviewData({
      elasticsearchUrl: env.ELASTICSEARCH_URL,
      authHeader: env.ELASTIC_AUTH_HEADER,
      index,
      timeFrom,
      timeTo,
      filters,
      preview: spec.preview,
    });

    panels.push(buildPanel({ spec, index, filters, agentVisualization, previewData }));
  }

  const draft = buildDraft({
    dashboardId,
    title,
    index,
    dataView,
    preset,
    timeFrom,
    timeTo,
    filters,
    panels,
  });

  const draftPath = path.join(outDir, `${dashboardId}.draft.json`);
  const previewPath = path.join(outDir, `${dashboardId}.preview.html`);
  await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  await writeFile(previewPath, renderPreviewHtml(draft), "utf8");

  let publishResult = null;
  if (args.publish) {
    publishResult = await publishDashboard({
      kibanaUrl,
      authHeader: getPublishAuthHeader(env),
      draft,
      renderer: getRenderer(args),
    });

    const publishPath = path.join(outDir, `${dashboardId}.publish.json`);
    await writeFile(publishPath, `${JSON.stringify(publishResult, null, 2)}\n`, "utf8");
  }

  const summary = {
    status: "ok",
    mode: args.publish ? "publish" : "draft",
    renderer: args.publish ? getRenderer(args) : undefined,
    dashboardId,
    preset,
    index,
    dataView,
    filters: filters.labels,
    panelCount: draft.dashboard.panels.length,
    visualizationIntentStatus: summarizeVisualizationIntentStatus(draft.dashboard.panels),
    attachmentIds: draft.dashboard.panels.map((panel) => panel.source.attachmentId).filter(Boolean),
    toolResultIds: draft.dashboard.panels.map((panel) => panel.source.toolResultId).filter(Boolean),
    draftPath,
    previewPath,
    dashboardUrl: publishResult?.dashboardUrl,
    approvalRequired: args.publish
      ? undefined
      : "Review the generated preview file before publishing. Publish only after explicit approval.",
    nextCommand: args.publish
      ? undefined
      : `npm run flexiclaw:dashboard:publish -- --from-draft ${shellQuote(path.relative(process.cwd(), draftPath))}`,
  };

  console.log(JSON.stringify(summary, null, 2));
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--publish") {
      args.publish = true;
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

function requireEnv(env, key) {
  if (!env[key]) {
    throw new Error(
      `Missing required Elastic setting: ${key}. Configure it in ~/.config/flexiclaw/config.json, flexiclaw.config.local.json, .env.local or the process environment.`,
    );
  }
}

function getPanelSpecs(preset) {
  const panelSpecs = PANEL_PRESETS[preset];
  if (!panelSpecs) {
    throw new Error(`Unknown preset: ${preset}. Available presets: ${Object.keys(PANEL_PRESETS).join(", ")}`);
  }
  return panelSpecs;
}

function getPresetDefaults(preset) {
  const defaults = PRESET_DEFAULTS[preset];
  if (!defaults) {
    throw new Error(`Unknown preset defaults: ${preset}`);
  }
  return defaults;
}

function defaultIdForPreset(preset) {
  return `${getPresetDefaults(preset).idPrefix}-${DEFAULT_DATE_TOKEN}`;
}

function defaultTitleForPreset(preset) {
  return getPresetDefaults(preset).title;
}

function defaultIndexForPreset(preset) {
  return getPresetDefaults(preset).index;
}

function getRenderer(args) {
  const renderer = args.renderer ?? DEFAULT_RENDERER;
  if (!["vega", "lens"].includes(renderer)) {
    throw new Error("Unsupported renderer. Use --renderer vega or --renderer lens.");
  }
  return renderer;
}

function logLevelFilter(levels) {
  return {
    description: `log.level in ${levels.join(", ")}`,
    kql: `(${levels.map((level) => `log.level: ${quoteKqlValue(level)}`).join(" or ")})`,
    dsl: {
      terms: {
        "log.level": levels,
      },
    },
  };
}

function apmTransactionFilter() {
  return termFilter("processor.event", "transaction");
}

function outcomeFilter(outcome) {
  return termFilter("event.outcome", outcome);
}

function termFilter(field, value) {
  return {
    description: `${field} is ${value}`,
    kql: `${field}: ${quoteKqlValue(value)}`,
    dsl: {
      term: {
        [field]: value,
      },
    },
  };
}

function countMetric({ id = "count", label = "Document count" } = {}) {
  return {
    id,
    label,
    operation: "count",
    lensOperation: "count",
  };
}

function percentileMetric({ id, label, percentile, field = "transaction.duration.us", scale = 0.001 }) {
  return {
    id,
    label,
    operation: "percentile",
    lensOperation: "formula",
    field,
    percentile,
    scale,
    lensFormula: `percentile(${field}, percentile=${percentile}) / 1000`,
    format: {
      id: "number",
      params: {
        decimals: 2,
      },
    },
  };
}

function errorRateMetric() {
  return {
    id: "error_rate",
    label: "Error rate",
    operation: "rate",
    lensOperation: "formula",
    numeratorFilter: outcomeFilter("failure"),
    lensFormula: `count(kql='event.outcome: "failure"') / count()`,
    format: {
      id: "percent",
      params: {
        decimals: 2,
      },
    },
  };
}

function failureCountMetric() {
  return {
    id: "failed_transactions",
    label: "Failed transactions",
    operation: "filtered_count",
    lensOperation: "formula",
    filter: outcomeFilter("failure"),
    lensFormula: `count(kql='event.outcome: "failure"')`,
    format: {
      id: "number",
      params: {
        decimals: 0,
      },
    },
  };
}

function buildGlobalFilters({ service, environment }) {
  const filters = [];

  if (service) {
    filters.push({
      label: `service.name=${service}`,
      kql: `service.name: ${quoteKqlValue(service)}`,
      dsl: {
        term: {
          "service.name": service,
        },
      },
    });
  }

  if (environment) {
    filters.push({
      label: `service.environment=${environment}`,
      kql: `service.environment: ${quoteKqlValue(environment)}`,
      dsl: {
        term: {
          "service.environment": environment,
        },
      },
    });
  }

  return {
    items: filters,
    labels: filters.map((filter) => filter.label),
    kql: combineKql(filters.map((filter) => filter.kql)),
    dsl: filters.map((filter) => filter.dsl),
  };
}

function buildElasticToolContext({ filters, spec }) {
  const context = [];
  if (filters.labels.length) {
    context.push(`Apply these investigation filters: ${filters.labels.join(", ")}.`);
  }
  if (spec.preview.filter?.description) {
    context.push(`Panel-specific filter: ${spec.preview.filter.description}.`);
  }
  if (spec.preview.metrics?.length) {
    context.push(`Metrics: ${spec.preview.metrics.map((metric) => metric.label).join(", ")}.`);
  }
  return context;
}

function combineKql(parts) {
  return parts.filter(Boolean).map((part) => `(${part})`).join(" and ");
}

function quoteKqlValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function getPublishAuthHeader(env) {
  const authHeader = env.ELASTIC_DASHBOARD_AUTH_HEADER ?? env.ELASTIC_AUTH_HEADER;
  if (!authHeader) {
    throw new Error("Missing ELASTIC_DASHBOARD_AUTH_HEADER or ELASTIC_AUTH_HEADER for publishing");
  }
  return authHeader;
}

function previewPathForDraft(draftPath, draft) {
  return path.join(path.dirname(draftPath), `${draft.dashboard.id}.preview.html`);
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function createElasticVisualizationOrFallback({ mcpUrl, authHeader, query, index, spec, chartType }) {
  try {
    return await createElasticVisualization({ mcpUrl, authHeader, query, index, chartType });
  } catch (error) {
    if (!isVisualizationAttachmentAuthError(error)) {
      throw error;
    }
    return buildFallbackVisualization({ spec, query, reason: summarizeError(error) });
  }
}

async function createElasticVisualization({ mcpUrl, authHeader, query, index, chartType }) {
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      authorization: authHeader,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "flexiclaw-dashboard-e2e-create-visualization",
      method: "tools/call",
      params: {
        name: "platform_core_create_visualization",
        arguments: {
          query,
          index,
          chartType,
        },
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw httpError("Elastic create_visualization failed", response, text);
  }

  const payload = parseJsonOrSse(text);
  if (payload.error) {
    throw new Error(`Elastic returned JSON-RPC error: ${JSON.stringify(payload.error)}`);
  }

  return extractVisualization(payload);
}

function isVisualizationAttachmentAuthError(error) {
  const text = `${error.message ?? ""}\n${error.details ?? ""}`;
  return /Unauthorized to get actions/i.test(text);
}

function buildFallbackVisualization({ spec, query, reason }) {
  return {
    status: "fallback",
    reason,
    toolResultId: null,
    attachmentId: null,
    chartType: spec.chartType,
    esql: null,
    visualization: {
      kind: "flexiclaw-local-preview",
      title: spec.title,
      chartType: spec.chartType,
      preview: spec.preview,
    },
    query,
    raw: null,
  };
}

function summarizeError(error) {
  return String(error.details || error.message || "unknown error").replace(/\s+/g, " ").slice(0, 240);
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
    throw new Error("Could not parse JSON or SSE response from Elastic");
  }

  return JSON.parse(jsonPayload);
}

function extractVisualization(payload) {
  const content = payload?.result?.content ?? [];
  for (const item of content) {
    if (item?.type !== "text" || !item.text) {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(item.text);
    } catch {
      continue;
    }

    const result = parsed.results?.find((entry) => entry.type === "visualization");
    const data = result?.data;
    if (!data) {
      continue;
    }

    return {
      toolResultId: result.tool_result_id,
      attachmentId: data.attachment_id,
      chartType: data.chart_type,
      esql: data.esql,
      visualization: data.visualization,
      query: data.query,
      raw: result,
    };
  }

  throw new Error("Elastic response did not include a visualization result");
}

async function fetchPreviewData({ elasticsearchUrl, authHeader, index, timeFrom, timeTo, filters, preview }) {
  if (!elasticsearchUrl) {
    return {
      status: "skipped",
      reason: "ELASTICSEARCH_URL is not configured",
      kind: preview.kind,
      buckets: [],
    };
  }

  const agg = buildPreviewAggregation(preview);
  const query = buildPreviewQuery({ timeFrom, timeTo, filters, preview });
  const url = `${trimTrailingSlash(elasticsearchUrl)}/${encodeURIComponent(index)}/_search`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: authHeader,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      size: 0,
      query,
      aggs: {
        preview: agg,
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    return {
      status: "failed",
      reason: `Elasticsearch preview query failed with HTTP ${response.status}`,
      kind: preview.kind,
      details: safeJson(text) ?? text.slice(0, 500),
      buckets: [],
    };
  }

  const payload = JSON.parse(text);
  const buckets = payload.aggregations?.preview?.buckets ?? [];

  return {
    status: "ok",
    kind: preview.kind,
    field: preview.field,
    kql: combineKql([filters.kql, preview.filter?.kql]),
    total: payload.hits?.total,
    buckets: buckets.map((bucket) => normalizePreviewBucket(preview, bucket)),
  };
}

function buildPreviewQuery({ timeFrom, timeTo, filters, preview }) {
  const filter = [
    {
      range: {
        "@timestamp": {
          gte: timeFrom,
          lte: timeTo,
        },
      },
    },
    ...filters.dsl,
  ];

  if (preview.filter?.dsl) {
    filter.push(preview.filter.dsl);
  }

  return {
    bool: {
      filter,
    },
  };
}

function buildPreviewAggregation(preview) {
  const metricAggs = buildPreviewMetricAggregations(preview.metrics);

  if (preview.kind === "date_histogram") {
    return {
      date_histogram: {
        field: preview.field,
        fixed_interval: preview.interval ?? "30m",
        min_doc_count: 0,
      },
      ...(Object.keys(metricAggs).length ? { aggs: metricAggs } : {}),
    };
  }

  if (preview.kind === "terms") {
    return {
      terms: {
        field: preview.field,
        size: preview.size ?? 10,
      },
      ...(Object.keys(metricAggs).length ? { aggs: metricAggs } : {}),
    };
  }

  throw new Error(`Unsupported preview kind: ${preview.kind}`);
}

function buildPreviewMetricAggregations(metrics = []) {
  const aggs = {};
  for (const metric of metrics) {
    if (metric.operation === "count") {
      continue;
    }
    if (metric.operation === "percentile") {
      aggs[metric.id] = {
        percentiles: {
          field: metric.field,
          percents: [metric.percentile],
        },
      };
      continue;
    }
    if (metric.operation === "filtered_count") {
      aggs[metric.id] = {
        filter: metric.filter.dsl,
      };
      continue;
    }
    if (metric.operation === "rate") {
      aggs[`${metric.id}_numerator`] = {
        filter: metric.numeratorFilter.dsl,
      };
      continue;
    }
    throw new Error(`Unsupported preview metric operation: ${metric.operation}`);
  }
  return aggs;
}

function normalizePreviewBucket(preview, bucket) {
  const values = normalizePreviewMetricValues(preview.metrics, bucket);

  if (preview.kind === "date_histogram") {
    return {
      time: bucket.key_as_string,
      count: bucket.doc_count,
      value: primaryPreviewValue(values, bucket.doc_count),
      values,
    };
  }

  return {
    label: String(bucket.key_as_string ?? bucket.key),
    count: bucket.doc_count,
    value: primaryPreviewValue(values, bucket.doc_count),
    values,
  };
}

function normalizePreviewMetricValues(metrics = [], bucket) {
  if (!metrics.length) {
    return {
      count: {
        label: "Document count",
        value: bucket.doc_count,
      },
    };
  }

  const values = {};
  for (const metric of metrics) {
    if (metric.operation === "count") {
      values[metric.id] = {
        label: metric.label,
        value: bucket.doc_count,
      };
      continue;
    }
    if (metric.operation === "percentile") {
      const raw = bucket[metric.id]?.values?.[`${metric.percentile}.0`] ?? bucket[metric.id]?.values?.[metric.percentile];
      values[metric.id] = {
        label: metric.label,
        value: raw == null ? null : raw * (metric.scale ?? 1),
      };
      continue;
    }
    if (metric.operation === "filtered_count") {
      values[metric.id] = {
        label: metric.label,
        value: bucket[metric.id]?.doc_count ?? 0,
      };
      continue;
    }
    if (metric.operation === "rate") {
      const numerator = bucket[`${metric.id}_numerator`]?.doc_count ?? 0;
      values[metric.id] = {
        label: metric.label,
        value: bucket.doc_count > 0 ? numerator / bucket.doc_count : 0,
      };
      continue;
    }
  }
  return values;
}

function primaryPreviewValue(values, fallback) {
  const first = Object.values(values)[0]?.value;
  return first == null || Number.isNaN(first) ? fallback : first;
}

function buildPanel({ spec, index, filters, agentVisualization, previewData }) {
  const query = {
    kql: combineKql([filters.kql, spec.preview.filter?.kql]),
    globalKql: filters.kql,
    panelKql: spec.preview.filter?.kql ?? "",
  };

  return {
    id: spec.id,
    title: spec.title,
    question: spec.question,
    index,
    chartType: agentVisualization.chartType,
    requestedChartType: spec.chartType,
    esql: agentVisualization.esql,
    visualization: agentVisualization.visualization,
    preview: spec.preview,
    query,
    previewData,
    source: {
      elasticTool: "platform_core_create_visualization",
      status: agentVisualization.status ?? "ok",
      reason: agentVisualization.reason,
      attachmentId: agentVisualization.attachmentId,
      toolResultId: agentVisualization.toolResultId,
    },
  };
}

function summarizeVisualizationIntentStatus(panels) {
  const fallbackCount = panels.filter((panel) => panel.source.status === "fallback").length;
  if (!fallbackCount) {
    return "elastic_attachment_created";
  }
  if (fallbackCount === panels.length) {
    return "local_preview_fallback";
  }
  return "partial_local_preview_fallback";
}

function buildDraft({ dashboardId, title, index, dataView, preset, timeFrom, timeTo, filters, panels }) {
  return {
    version: "0.1",
    generatedAt: new Date().toISOString(),
    mode: "draft",
    source: {
      elasticTool: "platform_core_create_visualization",
      visualizationIntentStatus: summarizeVisualizationIntentStatus(panels),
      preset,
      panelCount: panels.length,
    },
    dashboard: {
      id: dashboardId,
      title,
      description:
        "Flexiclaw dashboard draft: Elastic visualization attachments are used when authorized; otherwise Flexiclaw builds a local preview and Kibana APIs can publish Lens panels after approval.",
      index,
      dataView,
      preset,
      timeFrom,
      timeTo,
      filters,
      query: {
        kql: filters.kql,
      },
      panels: panels.map((panel, index) => ({
        ...panel,
        layout: panelLayout(index),
      })),
    },
  };
}

function panelLayout(index) {
  if (index === 0) {
    return { x: 0, y: 8, w: 48, h: 18 };
  }

  return {
    x: index % 2 === 1 ? 0 : 24,
    y: 26 + Math.floor((index - 1) / 2) * 16,
    w: 24,
    h: 16,
  };
}

async function publishDashboard({ kibanaUrl, authHeader, draft, renderer = DEFAULT_RENDERER }) {
  const dashboard = draft.dashboard;
  const xsrf = "flexiclaw-dashboard-e2e";
  const visualizationResponses = [];
  const references = [];
  const dataViewId =
    renderer === "lens"
      ? await resolveDataViewId({
          kibanaUrl,
          authHeader,
          xsrf,
          index: dashboard.index,
          dataView: dashboard.dataView,
        })
      : null;

  for (const panel of dashboard.panels) {
    const visualizationId = `${dashboard.id}-${panel.id}-${renderer}`;
    const referenceName = `panel_${panel.id.replaceAll("-", "_")}`;
    const savedObjectType = renderer === "lens" ? "lens" : "visualization";
    const savedObjectBody =
      renderer === "lens"
        ? {
            attributes: buildLensAttributes({ panel }),
            references: buildLensReferences({ layerId: panel.id, dataViewId }),
          }
        : {
            attributes: buildVegaVisualizationAttributes({ dashboard, panel }),
            references: [],
          };

    const visualizationResponse = await createSavedObject({
      kibanaUrl,
      authHeader,
      xsrf,
      type: savedObjectType,
      id: visualizationId,
      body: savedObjectBody,
    });

    visualizationResponses.push({
      id: visualizationResponse.id,
      type: visualizationResponse.type,
      updatedAt: visualizationResponse.updated_at,
    });
    references.push({
      type: savedObjectType,
      id: visualizationId,
      name: referenceName,
    });
  }

  const dashboardResponse = await createSavedObject({
    kibanaUrl,
    authHeader,
    xsrf,
    type: "dashboard",
    id: dashboard.id,
    body: {
      attributes: buildDashboardAttributes({ dashboard, renderer }),
      references,
    },
  });

  const verifyResponse = await getSavedObject({
    kibanaUrl,
    authHeader,
    xsrf,
    type: "dashboard",
    id: dashboard.id,
  });

  return {
    status: "published",
    renderer,
    dashboardId: dashboard.id,
    dashboardUrl: `${kibanaUrl}/app/dashboards#/view/${dashboard.id}`,
    savedObjects: {
      visualizations: visualizationResponses,
      dashboard: {
        id: dashboardResponse.id,
        type: dashboardResponse.type,
        updatedAt: dashboardResponse.updated_at,
      },
      verified: {
        id: verifyResponse.id,
        title: verifyResponse.attributes?.title,
        references: verifyResponse.references?.map((reference) => ({
          type: reference.type,
          id: reference.id,
          name: reference.name,
        })),
      },
    },
  };
}

async function resolveDataViewId({ kibanaUrl, authHeader, xsrf, index, dataView }) {
  const response = await fetch(`${kibanaUrl}/api/data_views`, {
    method: "GET",
    headers: {
      authorization: authHeader,
      "kbn-xsrf": xsrf,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw httpError("Failed to list Kibana data views", response, text);
  }

  const payload = JSON.parse(text);
  const dataViews = normalizeDataViews(payload.data_view ?? payload.data_views ?? []);
  const requested = dataView ?? index;
  const exactMatch = dataViews.find((entry) => entry.id === requested || entry.title === requested);
  const compatibleMatch =
    exactMatch ??
    dataViews.find((entry) => typeof entry.title === "string" && entry.title.split(",").includes(index));

  if (!compatibleMatch) {
    throw new Error(`No Kibana data view found for index pattern: ${index}`);
  }

  return compatibleMatch.id;
}

function normalizeDataViews(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

function buildLensReferences({ layerId, dataViewId }) {
  return [
    {
      type: "index-pattern",
      id: dataViewId,
      name: "indexpattern-datasource-current-indexpattern",
    },
    {
      type: "index-pattern",
      id: dataViewId,
      name: `indexpattern-datasource-layer-${layerId}`,
    },
  ];
}

function buildLensAttributes({ panel }) {
  const layerId = panel.id;
  const xColumnId = `${panel.id}-x`;
  const metricColumns = lensMetricColumns(panel);
  const sortColumn = lensTermsSortColumn(panel, metricColumns);
  const yColumnId = metricColumns[0].id;
  const kql = panel.query?.kql ?? "";
  const columns = [...metricColumns, ...(sortColumn ? [sortColumn] : [])];

  return {
    title: panel.title,
    description: "Created by Flexiclaw from an Elastic visualization draft.",
    visualizationType: "lnsXY",
    state: {
      datasourceStates: {
        formBased: {
          layers: {
            [layerId]: {
              columnOrder: [xColumnId, ...columns.map((column) => column.id)],
              columns: {
                [xColumnId]: buildLensBucketColumn({
                  panel,
                  orderColumnId: sortColumn?.id ?? yColumnId,
                }),
                ...Object.fromEntries(
                  columns.map((column) => [
                    column.id,
                    buildLensMetricColumn({ metric: column.metric }),
                  ]),
                ),
              },
              incompleteColumns: {},
            },
          },
        },
      },
      filters: [],
      query: {
        language: "kuery",
        query: kql,
      },
      visualization: buildLensXyVisualization({
        layerId,
        xColumnId,
        yColumnIds: metricColumns.map((column) => column.id),
        panel,
      }),
    },
  };
}

function lensMetricColumns(panel) {
  const metrics = panel.preview.metrics?.length
    ? panel.preview.metrics
    : [countMetric({ id: "count", label: "Document count" })];

  return metrics.map((metric) => ({
    id: `${panel.id}-${metric.id}`,
    metric,
  }));
}

function lensTermsSortColumn(panel, metricColumns) {
  // Lens formulas cannot safely drive terms bucket ordering; use a hidden count column for sorting.
  const needsSortColumn =
    panel.preview.kind === "terms" &&
    metricColumns.some((column) => column.metric.lensOperation === "formula");

  if (!needsSortColumn) {
    return null;
  }

  return {
    id: `${panel.id}-sort-count`,
    metric: countMetric({
      id: "sort_count",
      label: "Sort count",
    }),
  };
}

function buildLensBucketColumn({ panel, orderColumnId }) {
  if (panel.preview.kind === "date_histogram") {
    return {
      dataType: "date",
      isBucketed: true,
      label: panel.preview.field,
      operationType: "date_histogram",
      params: {
        interval: "auto",
        includeEmptyRows: true,
        dropPartials: false,
      },
      scale: "interval",
      sourceField: panel.preview.field,
    };
  }

  if (panel.preview.kind === "terms") {
    return {
      dataType: "string",
      isBucketed: true,
      label: `Top values of ${panel.preview.field}`,
      operationType: "terms",
      params: {
        orderBy: {
          type: "column",
          columnId: orderColumnId,
        },
        orderDirection: "desc",
        size: panel.preview.size ?? 10,
        otherBucket: false,
        missingBucket: false,
        parentFormat: {
          id: "terms",
        },
        include: [],
        exclude: [],
        includeIsRegex: false,
        excludeIsRegex: false,
      },
      scale: "ordinal",
      sourceField: panel.preview.field,
    };
  }

  throw new Error(`Unsupported Lens panel preview kind: ${panel.preview.kind}`);
}

function buildLensMetricColumn({ metric }) {
  if (metric.lensOperation === "formula") {
    return {
      customLabel: true,
      dataType: "number",
      isBucketed: false,
      label: metric.label,
      operationType: "formula",
      params: {
        formula: metric.lensFormula,
        isFormulaBroken: false,
        ...(metric.format ? { format: metric.format } : {}),
      },
      scale: "ratio",
      sourceField: "___records___",
    };
  }

  return {
    customLabel: true,
    dataType: "number",
    isBucketed: false,
    label: metric.label,
    operationType: "count",
    params: {},
    scale: "ratio",
    sourceField: "___records___",
  };
}

function buildLensXyVisualization({ layerId, xColumnId, yColumnIds, panel }) {
  const isTerms = panel.preview.kind === "terms";

  return {
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
        accessors: yColumnIds,
        layerId,
        layerType: "data",
        position: "top",
        seriesType: isTerms ? "bar_horizontal" : "bar_stacked",
        showGridlines: false,
        xAccessor: xColumnId,
      },
    ],
    legend: {
      isVisible: false,
      position: "right",
      legendSize: "auto",
    },
    preferredSeriesType: isTerms ? "bar_horizontal" : "bar_stacked",
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
  };
}

function buildVegaVisualizationAttributes({ dashboard, panel }) {
  const spec = buildVegaLiteSpec({ panel });

  return {
    title: `${dashboard.title} - ${panel.title}`,
    description:
      "Created by Flexiclaw from an Elastic visualization draft.",
    visState: JSON.stringify({
      title: panel.title,
      type: "vega",
      params: {
        spec: JSON.stringify(spec, null, 2),
      },
      aggs: [],
    }),
    uiStateJSON: "{}",
    version: 1,
    kibanaSavedObjectMeta: {
      searchSourceJSON: JSON.stringify({
        query: { language: "kuery", query: panel.query?.kql ?? "" },
        filter: [],
      }),
    },
  };
}

function buildVegaLiteSpec({ panel }) {
  if (panel.preview.kind === "date_histogram") {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title: panel.title,
      data: {
        url: {
          "%context%": true,
          "%timefield%": "@timestamp",
          index: panel.index,
          body: {
            size: 0,
            aggs: {
              preview: buildPreviewAggregation(panel.preview),
            },
          },
        },
        format: {
          property: "aggregations.preview.buckets",
        },
      },
      mark: {
        type: "bar",
        tooltip: true,
        color: "#1EA97C",
      },
      encoding: {
        x: {
          field: "key",
          type: "temporal",
          axis: { title: "Time" },
        },
        y: {
          field: "doc_count",
          type: "quantitative",
          axis: { title: "Document count" },
        },
      },
    };
  }

  if (panel.preview.kind === "terms") {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      title: panel.title,
      data: {
        url: {
          "%context%": true,
          "%timefield%": "@timestamp",
          index: panel.index,
          body: {
            size: 0,
            aggs: {
              preview: buildPreviewAggregation(panel.preview),
            },
          },
        },
        format: {
          property: "aggregations.preview.buckets",
        },
      },
      mark: {
        type: "bar",
        tooltip: true,
        color: "#3B82F6",
      },
      encoding: {
        y: {
          field: "key",
          type: "nominal",
          sort: "-x",
          axis: { title: panel.preview.field },
        },
        x: {
          field: "doc_count",
          type: "quantitative",
          axis: { title: "Document count" },
        },
      },
    };
  }

  throw new Error(`Unsupported panel preview kind: ${panel.preview.kind}`);
}

function buildDashboardAttributes({ dashboard, renderer }) {
  const kql = dashboard.query?.kql ?? "";

  return {
    title: dashboard.title,
    description: dashboard.description,
    timeRestore: true,
    timeFrom: dashboard.timeFrom,
    timeTo: dashboard.timeTo,
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
        query: { language: "kuery", query: kql },
        filter: [],
      }),
    },
    panelsJSON: JSON.stringify([
      buildMarkdownPanel({ dashboard }),
      ...dashboard.panels.map((panel) => ({
        version: "9.4.0",
        type: renderer === "lens" ? "lens" : "visualization",
        gridData: {
          ...panel.layout,
          i: panel.id,
        },
        panelIndex: panel.id,
        embeddableConfig: {
          enhancements: {},
        },
        panelRefName: `panel_${panel.id.replaceAll("-", "_")}`,
        title: panel.title,
      })),
    ]),
  };
}

function buildMarkdownPanel({ dashboard }) {
  const filters = dashboard.filters?.labels?.length ? dashboard.filters.labels.join(", ") : "none";
  const markdown = [
    `## ${dashboard.title}`,
    "",
    "Created by Flexiclaw after preview approval.",
    "",
    `- Preset: \`${dashboard.preset}\``,
    `- Index: \`${dashboard.index}\``,
    `- Data view: \`${dashboard.dataView ?? "auto"}\``,
    `- Time range: \`${dashboard.timeFrom} to ${dashboard.timeTo}\``,
    `- Filters: \`${filters}\``,
    `- Panels: \`${dashboard.panels.length}\``,
    "",
    ...dashboard.panels.flatMap((panel) => [
      `### ${panel.title}`,
      `- Question: ${panel.question}`,
      `- KQL: \`${panel.query?.kql || "<none>"}\``,
      `- Visualization intent source: ${panel.source.status === "fallback" ? "Flexiclaw local preview fallback" : "Elastic attachment tool"}`,
      `- Elastic visualization attachment: \`${panel.source.attachmentId ?? "<not available>"}\``,
      `- Elastic tool result: \`${panel.source.toolResultId ?? "<not available>"}\``,
      "",
    ]),
  ].join("\n");

  return {
    version: "9.4.0",
    type: "visualization",
    gridData: {
      x: 0,
      y: 0,
      w: 48,
      h: 8,
      i: "flexiclaw-summary",
    },
    panelIndex: "flexiclaw-summary",
    embeddableConfig: {
      savedVis: {
        title: "",
        description: "",
        type: "markdown",
        params: {
          fontSize: 12,
          openLinksInNewTab: false,
          markdown,
        },
        uiState: {},
        data: {
          aggs: [],
          searchSource: {
            query: { query: dashboard.query?.kql ?? "", language: "kuery" },
            filter: [],
          },
        },
      },
      enhancements: {},
      hidePanelTitles: true,
      type: "visualization",
    },
    title: "Flexiclaw summary",
  };
}

async function createSavedObject({ kibanaUrl, authHeader, xsrf, type, id, body }) {
  const response = await fetch(`${kibanaUrl}/api/saved_objects/${type}/${id}?overwrite=true`, {
    method: "POST",
    headers: {
      authorization: authHeader,
      "content-type": "application/json",
      "kbn-xsrf": xsrf,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw httpError(`Failed to create saved object ${type}/${id}`, response, text);
  }
  return JSON.parse(text);
}

async function getSavedObject({ kibanaUrl, authHeader, xsrf, type, id }) {
  const response = await fetch(`${kibanaUrl}/api/saved_objects/${type}/${id}`, {
    method: "GET",
    headers: {
      authorization: authHeader,
      "kbn-xsrf": xsrf,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw httpError(`Failed to verify saved object ${type}/${id}`, response, text);
  }
  return JSON.parse(text);
}

function renderPreviewHtml(draft) {
  const dashboard = draft.dashboard;
  const panelSections = dashboard.panels.map((panel) => renderPreviewPanel(panel)).join("\n");
  const evidenceSections = dashboard.panels.map((panel) => renderPanelEvidence(panel)).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(dashboard.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #5c6875;
      --line: #d8dee6;
      --accent: #1ea97c;
      --warn: #9a6700;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    main {
      width: min(1120px, calc(100vw - 32px));
      margin: 24px auto;
    }
    header {
      margin-bottom: 16px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 26px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    .panel, .metric {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .metric {
      padding: 14px;
      min-height: 80px;
    }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 8px;
    }
    .metric strong {
      font-size: 15px;
      overflow-wrap: anywhere;
    }
    .panel-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    .panel {
      padding: 16px;
      margin-bottom: 12px;
    }
    .panel.full {
      grid-column: 1 / -1;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 17px;
      letter-spacing: 0;
    }
    svg {
      display: block;
      width: 100%;
      height: 280px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fbfcfd;
    }
    pre {
      margin: 0;
      padding: 12px;
      overflow-x: auto;
      border-radius: 6px;
      background: #111827;
      color: #e5e7eb;
      font-size: 13px;
      line-height: 1.45;
    }
    .warning {
      color: var(--warn);
      font-weight: 600;
    }
    details {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      margin-bottom: 12px;
      padding: 12px 16px;
    }
    summary {
      cursor: pointer;
      font-weight: 700;
    }
    @media (max-width: 760px) {
      main { width: min(100vw - 20px, 1120px); margin: 12px auto; }
      .grid, .panel-grid { grid-template-columns: 1fr; }
      .panel.full { grid-column: auto; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(dashboard.title)}</h1>
      <p>${escapeHtml(dashboard.description)}</p>
    </header>

    <section class="grid" aria-label="Dashboard metadata">
      <div class="metric"><span>Preset</span><strong>${escapeHtml(dashboard.preset)}</strong></div>
      <div class="metric"><span>Panels</span><strong>${escapeHtml(dashboard.panels.length)}</strong></div>
      <div class="metric"><span>Time range</span><strong>${escapeHtml(`${dashboard.timeFrom} to ${dashboard.timeTo}`)}</strong></div>
      <div class="metric"><span>Filters</span><strong>${escapeHtml(dashboard.filters?.labels?.join(", ") || "none")}</strong></div>
    </section>

    <section class="panel-grid" aria-label="Preview panels">
      ${panelSections}
    </section>

    ${evidenceSections}
  </main>
</body>
</html>
`;
}

function renderPreviewPanel(panel) {
  const buckets = panel.previewData?.buckets ?? [];
  const fullClass = panel.preview.kind === "date_histogram" ? " full" : "";
  const chart =
    panel.preview.kind === "date_histogram"
      ? renderTimeSeriesBars(buckets, panel.title)
      : renderHorizontalBars(buckets, panel.preview.field);

  return `<article class="panel${fullClass}">
      <h2>${escapeHtml(panel.title)}</h2>
      ${chart}
      ${renderPreviewStatus(panel.previewData)}
    </article>`;
}

function renderPanelEvidence(panel) {
  const sourceLabel =
    panel.source.status === "fallback"
      ? "Flexiclaw local preview fallback"
      : "Elastic attachment tool";
  return `<details>
    <summary>${escapeHtml(panel.title)} evidence</summary>
    <p>Visualization intent source: <strong>${escapeHtml(sourceLabel)}</strong></p>
    <p>Attachment: <strong>${escapeHtml(panel.source.attachmentId ?? "not available")}</strong></p>
    <p>Tool result: <strong>${escapeHtml(panel.source.toolResultId ?? "not available")}</strong></p>
    ${panel.source.reason ? `<p class="warning">${escapeHtml(panel.source.reason)}</p>` : ""}
    <p>KQL: <strong>${escapeHtml(panel.query?.kql || "none")}</strong></p>
    <h2>Elastic ES|QL</h2>
    <pre><code>${escapeHtml(panel.esql ?? "ES|QL was not returned by Elastic.")}</code></pre>
    <h2>Visualization config</h2>
    <pre><code>${escapeHtml(JSON.stringify(panel.visualization, null, 2))}</code></pre>
  </details>`;
}

function renderPreviewStatus(previewData) {
  if (!previewData || previewData.status === "ok") {
    return "";
  }

  return `<p class="warning">${escapeHtml(previewData.reason ?? "Preview data was not available.")}</p>`;
}

function renderTimeSeriesBars(buckets, title) {
  if (!buckets.length) {
    return '<p class="warning">No preview buckets available.</p>';
  }

  const width = 900;
  const height = 280;
  const padding = { top: 22, right: 18, bottom: 36, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = Math.max(...buckets.map((bucket) => previewChartValue(bucket)), 1);
  const barGap = 2;
  const barWidth = Math.max(1, plotWidth / buckets.length - barGap);

  const bars = buckets
    .map((bucket, index) => {
      const value = previewChartValue(bucket);
      const barHeight = (value / max) * plotHeight;
      const x = padding.left + index * (plotWidth / buckets.length);
      const y = padding.top + plotHeight - barHeight;
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(barWidth)}" height="${round(barHeight)}"><title>${escapeHtml(bucket.time)}: ${escapeHtml(formatPreviewValues(bucket))}</title></rect>`;
    })
    .join("");

  const first = buckets[0]?.time ?? "";
  const last = buckets.at(-1)?.time ?? "";

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
    <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${padding.left + plotWidth}" y2="${padding.top + plotHeight}" stroke="#aeb8c4" />
    <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotHeight}" stroke="#aeb8c4" />
    <text x="${padding.left}" y="18" fill="#5c6875" font-size="12">max ${max}</text>
    <text x="${padding.left}" y="${height - 10}" fill="#5c6875" font-size="11">${escapeHtml(first)}</text>
    <text x="${padding.left + plotWidth}" y="${height - 10}" text-anchor="end" fill="#5c6875" font-size="11">${escapeHtml(last)}</text>
    <g fill="#1ea97c">${bars}</g>
  </svg>`;
}

function renderHorizontalBars(buckets, field) {
  if (!buckets.length) {
    return '<p class="warning">No preview buckets available.</p>';
  }

  const width = 900;
  const height = 280;
  const padding = { top: 22, right: 28, bottom: 24, left: 170 };
  const plotWidth = width - padding.left - padding.right;
  const rowHeight = Math.min(28, (height - padding.top - padding.bottom) / buckets.length);
  const max = Math.max(...buckets.map((bucket) => previewChartValue(bucket)), 1);

  const rows = buckets
    .map((bucket, index) => {
      const y = padding.top + index * rowHeight;
      const value = previewChartValue(bucket);
      const barWidth = (value / max) * plotWidth;
      const label = truncate(bucket.label, 24);
      return `<g>
        <text x="${padding.left - 8}" y="${round(y + rowHeight * 0.68)}" text-anchor="end" fill="#5c6875" font-size="11">${escapeHtml(label)}</text>
        <rect x="${padding.left}" y="${round(y + 4)}" width="${round(barWidth)}" height="${round(Math.max(4, rowHeight - 8))}" fill="#3B82F6"><title>${escapeHtml(bucket.label)}: ${escapeHtml(formatPreviewValues(bucket))}</title></rect>
        <text x="${round(padding.left + barWidth + 6)}" y="${round(y + rowHeight * 0.68)}" fill="#5c6875" font-size="11">${escapeHtml(formatPreviewNumber(value))}</text>
      </g>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(field)} breakdown">
    <text x="${padding.left}" y="18" fill="#5c6875" font-size="12">max ${max}</text>
    ${rows}
  </svg>`;
}

function previewChartValue(bucket) {
  return Number(bucket.value ?? bucket.count ?? 0);
}

function formatPreviewValues(bucket) {
  const values = bucket.values ? Object.values(bucket.values) : [];
  if (!values.length) {
    return formatPreviewNumber(bucket.count ?? 0);
  }
  return values.map((entry) => `${entry.label}: ${formatPreviewNumber(entry.value)}`).join(", ");
}

function formatPreviewNumber(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "n/a";
  }
  const number = Number(value);
  if (Math.abs(number) < 1 && number !== 0) {
    return number.toFixed(3);
  }
  if (!Number.isInteger(number)) {
    return number.toFixed(2);
  }
  return String(number);
}

function truncate(value, maxLength) {
  const text = String(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function round(value) {
  return Number(value.toFixed(2));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function httpError(message, response, body) {
  const error = new Error(`${message}: HTTP ${response.status}`);
  error.details = body.slice(0, 1000);
  return error;
}
