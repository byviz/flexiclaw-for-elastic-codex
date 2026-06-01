import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ENV_FILES = [".env.local", ".env"];
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(SCRIPT_DIR, "..");
const USER_CONFIG_FILE = path.join(resolveUserConfigDir(), "config.json");
const DEFAULT_CONFIG_FILES = [
  "flexiclaw.config.local.json",
  path.join("plugins", "flexiclaw-codex-plugin", "flexiclaw.config.local.json"),
  path.join(PLUGIN_ROOT, "flexiclaw.config.local.json"),
  USER_CONFIG_FILE,
];

export async function loadElasticConfig({ envPath, configPath, cwd = process.cwd() } = {}) {
  const fileValues = {};
  const sources = [];

  for (const candidate of resolveCandidates({ cwd, explicitPath: envPath, defaults: DEFAULT_ENV_FILES })) {
    if (!existsSync(candidate)) {
      continue;
    }
    Object.assign(fileValues, await readEnvFile(candidate, fileValues));
    sources.push(candidate);
  }

  const explicitConfig = Boolean(configPath);
  const configShouldOverwriteEnvFile = explicitConfig || !envPath;
  for (const candidate of resolveCandidates({
    cwd,
    explicitPath: configPath,
    defaults: DEFAULT_CONFIG_FILES,
  })) {
    if (!existsSync(candidate)) {
      continue;
    }
    const configValues = mapConfigToEnv(await readJsonFile(candidate));
    mergeConfigValues(fileValues, configValues, { overwrite: configShouldOverwriteEnvFile });
    sources.push(candidate);
  }

  const env = {
    ...fileValues,
    ...process.env,
  };

  if (sources.length) {
    env.FLEXICLAW_CONFIG_SOURCES = sources.join(path.delimiter);
  }

  return env;
}

function resolveCandidates({ cwd, explicitPath, defaults }) {
  if (explicitPath) {
    return [path.resolve(cwd, explicitPath)];
  }
  return unique(defaults.map((entry) => path.resolve(cwd, entry)));
}

function resolveUserConfigDir() {
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "flexiclaw");
  }
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Flexiclaw");
  }
  return path.join(os.homedir(), ".config", "flexiclaw");
}

function unique(values) {
  return [...new Set(values)];
}

async function readEnvFile(filePath, existingValues) {
  const values = {};
  const content = await readFile(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (existingValues[key] !== undefined || values[key] !== undefined) {
      continue;
    }
    values[key] = unquoteEnv(rawValue.trim());
  }

  return values;
}

async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    error.message = `Invalid Flexiclaw config file ${filePath}: ${error.message}`;
    throw error;
  }
}

function mergeConfigValues(target, values, { overwrite }) {
  for (const [key, value] of Object.entries(values)) {
    if (!value) {
      continue;
    }
    if (!overwrite && target[key] !== undefined) {
      continue;
    }
    target[key] = value;
  }
}

function mapConfigToEnv(config) {
  const values = {};

  const kibanaUrl = pick(config, ["KIBANA_URL", "kibanaUrl", "kibana.url"]);
  const elasticsearchUrl = pick(config, [
    "ELASTICSEARCH_URL",
    "elasticsearchUrl",
    "elasticsearch.url",
  ]);
  const authHeader = pick(config, ["ELASTIC_AUTH_HEADER", "authHeader", "auth.header"]);
  const apiKey = pick(config, ["apiKey", "elasticApiKey", "auth.apiKey"]);
  const dashboardAuthHeader = pick(config, [
    "ELASTIC_DASHBOARD_AUTH_HEADER",
    "dashboardAuthHeader",
    "dashboard.authHeader",
  ]);
  const dashboardApiKey = pick(config, [
    "dashboardApiKey",
    "dashboard.apiKey",
    "kibanaDashboardApiKey",
  ]);
  const toolsUrl = pick(config, [
    "ELASTIC_TOOLS_URL",
    "ELASTIC_AGENT_BUILDER_MCP_URL",
    "agentBuilderMcpUrl",
    "elasticToolsUrl",
    "elastic.mcpUrl",
  ]);

  setIfValue(values, "KIBANA_URL", kibanaUrl);
  setIfValue(values, "ELASTICSEARCH_URL", elasticsearchUrl);
  setIfValue(values, "ELASTIC_AUTH_HEADER", authHeader ?? apiKeyToHeader(apiKey));
  setIfValue(
    values,
    "ELASTIC_DASHBOARD_AUTH_HEADER",
    dashboardAuthHeader ?? apiKeyToHeader(dashboardApiKey),
  );
  setIfValue(values, "ELASTIC_TOOLS_URL", toolsUrl);
  setIfValue(values, "ELASTIC_AGENT_BUILDER_MCP_URL", toolsUrl);

  return values;
}

function pick(object, keys) {
  for (const key of keys) {
    const value = getValue(object, key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getValue(object, key) {
  return key.split(".").reduce((current, part) => current?.[part], object);
}

function setIfValue(target, key, value) {
  if (value) {
    target[key] = value;
  }
}

function apiKeyToHeader(value) {
  if (!value) {
    return undefined;
  }
  const trimmed = String(value).trim();
  if (/^(ApiKey|Bearer|Basic)\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `ApiKey ${trimmed}`;
}

function unquoteEnv(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
