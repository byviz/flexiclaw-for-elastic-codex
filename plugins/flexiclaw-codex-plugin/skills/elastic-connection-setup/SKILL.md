---
name: elastic-connection-setup
description: "Use when the user wants to connect, configure or authenticate Elastic for Flexiclaw in Codex, especially with a Kibana URL and read-only API key."
metadata:
  flexiclaw:
    capability: elastic_connection_setup
    mode: local_codex_configuration
    user_prompt: "Configura tu Kibana URL y una API key en ~/.config/flexiclaw/config.json y validare la conexion."
---

# Elastic Connection Setup

## Purpose

Help the user connect Flexiclaw to Elastic in Codex with the simplest possible onboarding.

Use this user-facing sentence:

```text
Configura tu Kibana URL y una API key en `~/.config/flexiclaw/config.json` y validare la conexion.
```

Do not ask users to paste API keys into the chat. Do not lead with backend implementation terms, namespaces or protocol details. Mention those only if the user asks how it works or when writing advanced/manual documentation.

## When To Use

Use this skill when the user asks:

- conecta mi Elastic
- configurar Elastic en Codex
- conectar Kibana
- usar Flexiclaw con mi cluster
- donde pongo la API key
- como doy credenciales al complemento
- setup de Flexiclaw

## Inputs To Collect

Ask the user to put these values in `~/.config/flexiclaw/config.json`:

- `kibanaUrl`: Kibana URL.
- `apiKey`: Elastic API key with read-only permissions.
- `elasticsearchUrl`: optional, used by local preview helpers.
- `dashboardApiKey`: optional, only needed for publishing Kibana dashboards.

Do not ask for Elasticsearch username/password. If the user offers user/password, recommend creating a read-only API key instead.

Accept either a bare API key or a value prefixed with `ApiKey `. Normalize it internally when running commands.

If the user uses a non-default Kibana space, ask for the space id only when needed.

## Local Config File

The recommended setup is a user-level config file:

```sh
mkdir -p ~/.config/flexiclaw
nano ~/.config/flexiclaw/config.json
```

Then put this content in the file:

```json
{
  "kibanaUrl": "https://your-kibana.example.com",
  "elasticsearchUrl": "https://your-elasticsearch.example.com",
  "apiKey": "your-read-only-api-key",
  "dashboardApiKey": "your-dashboard-write-api-key"
}
```

`~/.config/flexiclaw/config.json` is outside the repository, so users do not need to find the plugin install folder.

On Windows, use `%APPDATA%\Flexiclaw\config.json`.

`flexiclaw.config.local.json` in the repo root and `.env.local` are still supported for local development, CI and advanced users, but user-level config is preferred because it avoids plugin path confusion.

## Required API Key Permissions

For observability investigation and visualization generation, the API key should include:

- Elasticsearch index read permissions for the target observability data.
- Kibana read permissions for Elastic's Codex-compatible tools.
- Kibana read permissions for Discover, Dashboards, Visualize, APM, Logs, Metrics/Infrastructure and Streams when those areas are used.

For dashboard publishing, use a separate restricted key if possible. It needs permission to create/update Kibana dashboards and Lens visualizations.

If Elastic returns:

```text
Unauthorized to get actions
```

the key is missing a Kibana read permission needed by Elastic's visualization flow.

This error is about Elastic's visualization attachment/action flow. It is not the same as Flexiclaw's saved-object dashboard publish path. If dashboard publishing is required, validate it separately with:

```sh
npm run flexiclaw:setup-check -- --write-probe
```

## User-Facing Flow

1. Tell the user to create or edit `~/.config/flexiclaw/config.json`.
2. Do not ask them to paste the API key in chat.
3. For normal Codex usage, do not ask the user to find the plugin cache or run `npm` commands.
4. If helper scripts are available in the current workspace or a writable plugin copy, validate the connection yourself:

```sh
npm run flexiclaw:setup-check
```

5. Validate dashboard publishing only when they want that capability and only if helper scripts are available:

```sh
npm run flexiclaw:setup-check -- --write-probe
```

6. If helper scripts are not available, tell the user to open a new Codex thread after configuration and ask what Flexiclaw can see in Elastic.
7. In the new thread, verify by asking what Flexiclaw can see in Elastic.

## Configuration Behavior

Flexiclaw local helper scripts read configuration from:

1. process environment;
2. `~/.config/flexiclaw/config.json`;
3. `flexiclaw.config.local.json` in the current workspace;
4. `plugins/flexiclaw-codex-plugin/flexiclaw.config.local.json`;
5. `.env.local` or `.env`.

Process environment has the highest priority. By default, user-level config is preferred over workspace config because it is the recommended user-facing setup.

The config file supports:

- `kibanaUrl`
- `elasticsearchUrl`
- `apiKey`
- `dashboardApiKey`
- `authHeader`
- `dashboardAuthHeader`

Use `--config <path>` when the file is not in the repository root.

## Safety Rules

- Prefer read-only API keys with the minimum required privileges.
- Do not store credentials in the public plugin package.
- Do not commit `.env.local` or `flexiclaw.config.local.json`.
- Do not ask the user to find Codex's plugin cache directory.
- Do not modify Elastic cluster settings, ILM policies, templates, data streams or saved objects during setup.
- If a command output exposes a secret, do not repeat that output to the user.

## Success Message

After successful setup, say:

```text
Flexiclaw ya esta conectado a Elastic en Codex. Abre un thread nuevo y preguntale: "que puedes ver en mi Elastic?"
```
