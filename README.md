<p align="center">
  <img src="plugins/flexiclaw-codex-plugin/assets/flexi-default.png" alt="Flexiclaw mascot" width="220">
</p>

# FlexiClaw for Elastic

**Codex plugin for Elastic observability.**

![Version 0.2.0](https://img.shields.io/badge/version-0.2.0-blue)
![Codex plugin](https://img.shields.io/badge/Codex-plugin-111827)
![Elastic Observability](https://img.shields.io/badge/Elastic-Observability-00BFB3)
![License MPL--2.0](https://img.shields.io/badge/license-MPL--2.0-orange)
![MVP](https://img.shields.io/badge/status-MVP-7C3AED)

**FlexiClaw for Elastic** is a Codex plugin for investigating Elastic observability data with an evidence-first workflow.

It helps Codex connect to Elastic, inspect logs, APM traces, metrics, alerts and streams, generate ES|QL, create dashboard previews, publish approved Kibana Lens dashboards, and write reproducible incident reports.

The goal is not to replace Kibana. The goal is to make Codex a useful investigation partner for Elastic: structured, cautious, and grounded in evidence.

[Quick start](#quick-start) · [What it can do](#what-it-can-do) · [Dashboard workflow](#dashboard-workflow) · [Safety model](#safety-model) · [License](#license)

## Why

Elastic already contains the signals. During an incident, the hard part is usually turning those signals into a clear investigation:

- What services, streams and indices are relevant?
- Did the symptom actually change compared with a baseline?
- Are logs, traces and metrics pointing to the same entity?
- Which hypothesis is supported by evidence, and what is still unknown?
- Which dashboard snapshot should be saved for handoff?

Flexiclaw adds that investigation method to Codex.

## What It Can Do

| Capability | MVP 0.2.0 |
| --- | --- |
| Connect Codex to Elastic with a local config file | Supported |
| Discover services, observability indices and streams | Supported |
| Investigate logs, exceptions and log volume changes | Supported |
| Investigate APM latency, throughput, errors and traces | Supported |
| Inspect hosts, runtime metrics and resource signals | Supported |
| Generate and validate ES\|QL | Supported |
| Create local dashboard previews before saving | Supported |
| Publish approved Kibana Lens dashboards | Supported |
| Write evidence-based incident summaries and RCA drafts | Supported |
| Modify cluster settings, ILM, templates or data streams | Not supported in MVP |

## Quick Start

Install the plugin in Codex:

```sh
codex plugin marketplace add byviz/flexiclaw-for-elastic-codex --ref main
codex plugin add flexiclaw-codex-plugin@flexiclaw
```

Create a user-level config file:

```sh
mkdir -p ~/.config/flexiclaw
nano ~/.config/flexiclaw/config.json
```

Put this content in `~/.config/flexiclaw/config.json`:

```json
{
  "kibanaUrl": "https://your-kibana.example.com",
  "elasticsearchUrl": "https://your-elasticsearch.example.com",
  "apiKey": "your-read-only-api-key",
  "dashboardApiKey": "your-dashboard-write-api-key"
}
```

Do not paste API keys into chat. `~/.config/flexiclaw/config.json` is outside the repository.

On Windows, use `%APPDATA%\Flexiclaw\config.json`.

Open a new Codex thread and ask:

```text
Conecta mi Elastic en Codex.
```

or:

```text
Que puedes ver en mi Elastic?
```

For normal Codex usage, you do not need to find the plugin cache or run `npm` commands.

### Optional Local Validation

If you cloned this repository and want to validate the connection from a terminal, run:

```sh
npm run flexiclaw:setup-check
```

If you want Flexiclaw to publish dashboards, validate dashboard write permissions:

```sh
npm run flexiclaw:setup-check -- --write-probe
```

For local development, `flexiclaw.config.local.json` in the repo root and `.env.local` are still supported as fallbacks.

## Example Prompts

Ask what Flexiclaw can see:

```text
Que puedes ver en mi Elastic?
```

Investigate logs:

```text
Investiga los errores 500 de checkout en produccion durante las ultimas 2 horas.
```

Investigate APM:

```text
Analiza la latencia de payments y comparala con la ventana anterior.
```

Create a dashboard safely:

```text
Crea una preview de dashboard para investigar logs de los ultimos 30 dias. Usa Lens si es posible y no lo guardes en Kibana hasta que lo apruebe.
```

Write a report:

```text
Escribe un resumen RCA con hechos, hipotesis, evidencias y siguientes acciones.
```

## Dashboard Workflow

Flexiclaw uses a preview-first workflow:

```text
Elastic evidence
-> visualization intent
-> Flexiclaw draft
-> local HTML preview
-> explicit approval
-> Kibana Lens dashboard
-> saved-object verification
```

The following commands are optional local helpers for users who cloned the repository.

Create a local logs overview draft:

```sh
npm run flexiclaw:dashboard
```

Create a service incident snapshot:

```sh
npm run flexiclaw:dashboard -- --preset service-incident-overview --service checkout --environment production
```

Create an APM incident snapshot:

```sh
npm run flexiclaw:dashboard -- --preset apm-service-overview --service checkout --environment production
```

Publish only after reviewing the preview:

```sh
npm run flexiclaw:dashboard:publish -- --from-draft artifacts/dashboard-e2e/<dashboard>.draft.json
```

Lens is the default renderer because it creates normal editable Kibana Lens panels. Vega is available only as a fallback for custom visualizations:

```sh
npm run flexiclaw:dashboard:publish -- --renderer vega --from-draft artifacts/dashboard-e2e/<dashboard>.draft.json
```

## Dashboard Presets

| Preset | Purpose |
| --- | --- |
| `logs-overview` | Log volume, log level breakdown and top log datasets |
| `service-incident-overview` | Service-scoped incident view for logs and error/warning trends |
| `apm-service-overview` | APM snapshot with p95/p99 latency, transaction volume, error rate and top transactions |
| `log-volume` | Single-panel smoke test |

The APM preset complements Kibana's native APM app. It is an investigation snapshot, not a replacement for the APM UI.

## Skills

Flexiclaw ships as a skills-first Codex plugin:

- `elastic-connection-setup`
- `elastic-observability-investigator`
- `elastic-logs-investigator`
- `elastic-apm-investigator`
- `elastic-metrics-investigator`
- `elastic-esql-assistant`
- `elastic-dashboard-builder`
- `elastic-report-writer`

These skills route natural user requests to the right Elastic tools, then apply Flexiclaw's evidence method.

## Safety Model

Flexiclaw follows conservative investigation rules:

- No unsupported conclusions.
- No success claims without verification.
- Facts, hypotheses and unknowns are kept separate.
- Aggregate signals are preferred before isolated samples.
- Incident windows should be compared against a baseline when possible.
- Dashboards are not saved without explicit approval.
- Cluster settings, ILM policies, templates and data streams are not modified in MVP 0.2.0.

## Local Development

Install dependencies if needed, then run the validation commands:

```sh
npm run flexiclaw:setup-check
npm run flexiclaw:mvp-smoke -- --draft-only
```

Useful checks:

```sh
node --check plugins/flexiclaw-codex-plugin/scripts/config.mjs
node --check plugins/flexiclaw-codex-plugin/scripts/setup-check.mjs
node --check plugins/flexiclaw-codex-plugin/scripts/dashboard-e2e.mjs
node --check plugins/flexiclaw-codex-plugin/scripts/mvp-smoke.mjs
```

## Current Limitations

MVP 0.2.0 does not yet support:

- Elastic Security-specific investigation flows.
- Automatic remediation.
- Cluster configuration changes.
- ILM/template/data stream operations.
- A hosted setup UI for credentials.
- A packaged release outside Codex plugin installation.

## License

Flexiclaw for Elastic is licensed under [Mozilla Public License 2.0](LICENSE).
