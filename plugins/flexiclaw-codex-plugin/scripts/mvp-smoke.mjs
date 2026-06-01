#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SETUP_SCRIPT = path.join(SCRIPT_DIR, "setup-check.mjs");
const DASHBOARD_SCRIPT = path.join(SCRIPT_DIR, "dashboard-e2e.mjs");

main().catch((error) => {
  console.error(`\nMVP smoke failed: ${error.message}`);
  if (error.details) {
    console.error(error.details);
  }
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const smokeId = args.id ?? `flexiclaw-mvp-smoke-${timestampToken()}`;
  const outDir = path.resolve(process.cwd(), args.outDir ?? "artifacts/mvp-smoke");

  await mkdir(outDir, { recursive: true });

  const checks = [];
  const dashboards = [];

  if (!args.skipSetup) {
    logStep("setup", "validating logs data view and Lens write probe");
    checks.push(
      await runSetupCheck({
        name: "logs_setup",
        index: args.logsIndex ?? "logs-*",
        envPath: args.env,
        config: args.config,
        writeProbe: true,
      }),
    );

    if (!args.skipApm) {
      logStep("setup", "validating APM data view and Lens write probe");
      checks.push(
        await runSetupCheck({
          name: "apm_setup",
          index: args.apmIndex ?? "traces-apm*",
          dataView: args.apmDataView,
          envPath: args.env,
          config: args.config,
          writeProbe: true,
        }),
      );
    }
  }

  logStep("dashboard", "running logs-overview draft/publish");
  dashboards.push(
    await runDashboardCase({
      id: `${smokeId}-logs-overview`,
      preset: "logs-overview",
      index: args.logsIndex ?? "logs-*",
      timeFrom: args.timeFrom ?? "now-30d",
      timeTo: args.timeTo ?? "now",
      envPath: args.env,
      config: args.config,
      expectedPanelCount: 3,
      publish: !args.draftOnly,
    }),
  );

  logStep("dashboard", "running service-incident-overview draft/publish");
  dashboards.push(
    await runDashboardCase({
      id: `${smokeId}-service-incident`,
      preset: "service-incident-overview",
      index: args.logsIndex ?? "logs-*",
      service: args.service,
      environment: args.environment,
      timeFrom: args.timeFrom ?? "now-30d",
      timeTo: args.timeTo ?? "now",
      envPath: args.env,
      config: args.config,
      expectedPanelCount: 5,
      publish: !args.draftOnly,
    }),
  );

  if (!args.skipApm) {
    logStep("dashboard", "running apm-service-overview draft/publish");
    dashboards.push(
      await runDashboardCase({
        id: `${smokeId}-apm-service-overview`,
        preset: "apm-service-overview",
        index: args.apmIndex ?? "traces-apm*",
        dataView: args.apmDataView,
        service: args.apmService ?? args.service,
        environment: args.apmEnvironment ?? args.environment,
        timeFrom: args.apmTimeFrom ?? args.timeFrom ?? "now-30d",
        timeTo: args.apmTimeTo ?? args.timeTo ?? "now",
        envPath: args.env,
        config: args.config,
        expectedPanelCount: 5,
        publish: !args.draftOnly,
      }),
    );
  }

  const failures = [
    ...checks.filter((check) => check.status !== "ok"),
    ...dashboards.filter((dashboard) => dashboard.status !== "ok"),
  ];

  const summary = {
    status: failures.length ? "failed" : "ok",
    smokeId,
    draftOnly: Boolean(args.draftOnly),
    checks,
    dashboards,
    urls: dashboards.map((dashboard) => dashboard.dashboardUrl).filter(Boolean),
  };

  const summaryPath = path.join(outDir, `${smokeId}.json`);
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ...summary,
        summaryPath,
      },
      null,
      2,
    ),
  );

  if (failures.length) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--draft-only") {
      args.draftOnly = true;
      continue;
    }
    if (arg === "--skip-setup") {
      args.skipSetup = true;
      continue;
    }
    if (arg === "--skip-apm") {
      args.skipApm = true;
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

function timestampToken() {
  return new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z")
    .toLowerCase();
}

async function runSetupCheck({ name, index, dataView, envPath, config, writeProbe }) {
  const commandArgs = [SETUP_SCRIPT, "--index", index];
  if (envPath) {
    commandArgs.push("--env", envPath);
  }
  if (config) {
    commandArgs.push("--config", config);
  }
  if (dataView) {
    commandArgs.push("--data-view", dataView);
  }
  if (writeProbe) {
    commandArgs.push("--write-probe");
  }

  const output = await runNode(commandArgs);
  const payload = parseJsonOutput(output.stdout);
  const failed = payload.checks?.filter((check) => check.status === "failed") ?? [];

  return {
    name,
    status: payload.status === "ok" && !failed.length ? "ok" : "failed",
    index,
    dataView,
    checks: payload.checks,
  };
}

async function runDashboardCase({
  id,
  preset,
  index,
  dataView,
  service,
  environment,
  timeFrom,
  timeTo,
  envPath,
  config,
  expectedPanelCount,
  publish,
}) {
  const draftArgs = [
    DASHBOARD_SCRIPT,
    "--id",
    id,
    "--preset",
    preset,
    "--index",
    index,
    "--time-from",
    timeFrom,
    "--time-to",
    timeTo,
  ];

  if (envPath) {
    draftArgs.push("--env", envPath);
  }
  if (config) {
    draftArgs.push("--config", config);
  }
  if (dataView) {
    draftArgs.push("--data-view", dataView);
  }
  if (service) {
    draftArgs.push("--service", service);
  }
  if (environment) {
    draftArgs.push("--environment", environment);
  }

  const draftOutput = await runNode(draftArgs);
  const draftSummary = parseJsonOutput(draftOutput.stdout);
  const draft = JSON.parse(await readFile(draftSummary.draftPath, "utf8"));
  const draftIssues = validateDraft({ draft, expectedPanelCount });

  let publishSummary = null;
  let publishPayload = null;
  let publishIssues = [];

  if (publish) {
    const publishOutput = await runNode([
      DASHBOARD_SCRIPT,
      "--publish",
      "--from-draft",
      draftSummary.draftPath,
      ...(envPath ? ["--env", envPath] : []),
      ...(config ? ["--config", config] : []),
    ]);
    publishSummary = parseJsonOutput(publishOutput.stdout);
    publishPayload = JSON.parse(await readFile(publishSummary.publishPath, "utf8"));
    publishIssues = validatePublish({ publishPayload, expectedPanelCount });
  }

  const issues = [...draftIssues, ...publishIssues];

  return {
    id,
    preset,
    index,
    dataView,
    service,
    environment,
    timeFrom,
    timeTo,
    status: issues.length ? "failed" : "ok",
    issues,
    panelCount: draft.dashboard.panels.length,
    draftPath: draftSummary.draftPath,
    previewPath: draftSummary.previewPath,
    publishPath: publishSummary?.publishPath,
    dashboardUrl: publishSummary?.dashboardUrl,
    lensObjects: publishPayload?.savedObjects?.visualizations?.filter((object) => object.type === "lens").length,
  };
}

function validateDraft({ draft, expectedPanelCount }) {
  const issues = [];
  const panels = draft.dashboard?.panels ?? [];

  if (panels.length !== expectedPanelCount) {
    issues.push(`Expected ${expectedPanelCount} panels, got ${panels.length}`);
  }

  for (const panel of panels) {
    if (!panel.source?.attachmentId) {
      issues.push(`${panel.id}: missing Elastic visualization attachment id`);
    }
    if (!panel.source?.toolResultId) {
      issues.push(`${panel.id}: missing Elastic visualization tool result id`);
    }
    if (panel.previewData?.status === "failed") {
      issues.push(`${panel.id}: preview failed: ${panel.previewData.reason}`);
    }
  }

  return issues;
}

function validatePublish({ publishPayload, expectedPanelCount }) {
  const issues = [];
  const visualizations = publishPayload.savedObjects?.visualizations ?? [];
  const references = publishPayload.savedObjects?.verified?.references ?? [];

  if (publishPayload.renderer !== "lens") {
    issues.push(`Expected lens renderer, got ${publishPayload.renderer}`);
  }
  if (visualizations.length !== expectedPanelCount) {
    issues.push(`Expected ${expectedPanelCount} visualization objects, got ${visualizations.length}`);
  }
  if (visualizations.some((object) => object.type !== "lens")) {
    issues.push("Publish created a non-Lens visualization object");
  }
  if (references.filter((reference) => reference.type === "lens").length !== expectedPanelCount) {
    issues.push("Dashboard does not reference the expected number of Lens panels");
  }

  return issues;
}

async function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(`Command failed: node ${args.map(shellArg).join(" ")}`);
      error.details = [stdout, stderr].filter(Boolean).join("\n").slice(0, 4000);
      reject(error);
    });
  });
}

function logStep(scope, message) {
  console.error(`[flexiclaw:mvp-smoke] ${scope}: ${message}`);
}

function parseJsonOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("Command returned empty stdout");
  }
  const firstJson = trimmed.indexOf("{");
  if (firstJson < 0) {
    throw new Error(`Command did not return JSON: ${trimmed.slice(0, 500)}`);
  }
  return JSON.parse(trimmed.slice(firstJson));
}

function shellArg(value) {
  if (/^[A-Za-z0-9_./:@*-]+$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}
