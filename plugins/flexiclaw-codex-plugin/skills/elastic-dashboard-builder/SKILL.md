---
name: elastic-dashboard-builder
description: "Use when the user asks to create, propose or refine Elastic observability dashboards or visualization panels for incident investigation."
metadata:
  flexiclaw:
    capability: dashboard_builder
    mode: read_only
    elastic_tool_namespaces:
      - platform.core
      - observability
      - platform.streams
---

# Elastic Dashboard Builder

## Purpose

Create actionable observability dashboard previews and saved Kibana dashboards using Elastic connectivity and Flexiclaw dashboard rules.

This skill is important for turning an investigation into reusable panels. It is a feature, not the core Flexiclaw loop.

## When To Use

Use this skill when the user asks:

- create an investigation dashboard
- build a dashboard for service errors
- create panels for latency and logs
- visualize log spikes
- dashboard for APM latency
- dashboard for a production incident

## Required Workflow

1. Identify dashboard objective.
2. Identify audience:
   - SRE
   - developer
   - platform team
   - incident commander
   - customer-facing report
3. Identify filters:
   - time range
   - `service.name`
   - environment
   - host or pod
   - namespace
4. Define actionable panels. Every panel must answer a question.
5. Generate ES|QL per panel when useful.
6. Use `platform_core_create_visualization` for visualization intent/configuration when available and authorized.
7. Create a local Flexiclaw preview before publishing.
8. Do not claim a Kibana saved dashboard was created unless saved-object creation and verification succeed.

## Persistent Dashboard Flow

When the user asks for a dashboard that should exist in Kibana:

1. When authorized, use Elastic's visualization tool to create or validate the visualization intent and capture:
   - `attachment_id`;
   - `tool_result_id`;
   - ES|QL;
   - visualization config.
2. Treat the attachment as a draft artifact, not a Kibana saved object.
3. Build a Flexiclaw dashboard draft and preview before publishing when possible.
4. Publish to Kibana only through an explicit saved-object or dashboard API path.
5. Require a separate dashboard-write API key for publishing. Do not use broad cluster-management permissions.

If `platform_core_create_visualization` returns `Unauthorized to get actions`, do not treat that as proof that Flexiclaw cannot create a Kibana dashboard. It means the Elastic visualization attachment flow is not authorized for the current key. Fall back to the Flexiclaw local draft and preview flow, then validate the actual publish path with:

```sh
npm run flexiclaw:setup-check -- --write-probe
```

If the write probe passes, Flexiclaw can publish Lens saved objects through the dashboard API even if the Elastic attachment tool is unavailable.

The repository includes dashboard commands for preview and publish validation:

```sh
npm run flexiclaw:setup-check
npm run flexiclaw:mvp-smoke
npm run flexiclaw:dashboard
npm run flexiclaw:dashboard:publish -- --from-draft artifacts/dashboard-e2e/<dashboard>.draft.json
npm run flexiclaw:dashboard:publish -- --renderer vega --from-draft artifacts/dashboard-e2e/<dashboard>.draft.json
```

The default renderer is Lens because it creates editable Kibana Lens saved objects. Use `--renderer vega` only for custom visualizations that Lens cannot express cleanly.

Use this workflow as the MVP dashboard path.
After creating a draft, give the user the generated preview file, draft file, short status and publish command. The user should not need to ask for `previewPath`, `draftPath`, `visualizationIntentStatus` or `nextCommand` by name.

## Preview Handling

The local HTML preview is a file artifact, not a website.

Interpret natural phrases such as "show me the dashboard preview", "let me see it", "open the preview", "ensename la preview" or "quiero verla antes" as a request to generate the local preview artifact and report where it is. Do not ask the user to rewrite the prompt with technical fields.

Do not use Browser Use, the in-app browser, raw CDP, `file://` navigation, localhost workarounds or alternate browser surfaces to open the generated `.preview.html` file. This is an internal safety rule; do not mention browser policy in the normal user response unless the user explicitly asks why it was not opened.

After creating a draft:

1. Report the absolute `previewPath`.
2. Report the absolute `draftPath`.
3. Summarize the panel count, filters and `visualizationIntentStatus`.
4. Provide the exact `nextCommand`.
5. Ask the user to review the preview file manually and reply with explicit approval before publishing.

User-facing wording should stay simple, for example:

```text
La preview se ha generado aqui: <previewPath>
Draft: <draftPath>
Paneles: <count>
Cuando la revises y la apruebes, puedo publicarla con:
<nextCommand>
```

Available presets:

- `logs-overview`: log volume over time, log level breakdown and top log datasets by volume.
- `service-incident-overview`: service-scoped incident dashboard with log volume, error/warning trend, severity breakdown, affected hosts and error/warning datasets.
- `apm-service-overview`: APM incident snapshot with p95/p99 latency, transaction volume, error rate and top transactions.
- `log-volume`: single-panel validation flow.

Use `--service <service.name>` and `--environment <service.environment>` when the user asks for a service-specific dashboard.
Use `apm-service-overview` when the user wants an incident snapshot for APM evidence; do not position it as a replacement for Kibana's native APM app.

## Recommended Elastic Tools

- `platform_core_create_visualization`
- `platform_core_generate_esql`
- `platform_core_execute_esql`
- `platform_core_index_explorer`
- `platform_core_list_indices`
- `observability_get_services`
- `observability_get_logs`
- `observability_get_trace_metrics`
- `observability_get_hosts`
- `observability_get_runtime_metrics`
- `observability_get_alerts`
- `observability_get_index_info`
- `platform_streams_get_schema`

## Recommended Panels

For service incidents:

- error rate over time
- request or transaction volume over time
- latency p95/p99 over time
- top endpoints or transactions by errors
- top exception types
- affected hosts or pods
- slow traces or dependencies
- recent relevant logs

For log volume incidents:

- log throughput over time
- top fields driving change
- top services by log volume
- top error messages
- sample logs for selected pattern

For infrastructure correlation:

- CPU over time by host or pod
- memory over time by host or pod
- runtime metrics for affected service
- error rate versus resource signal

## Safety Rules

- Avoid decorative dashboards.
- Do not create panels without an investigation question.
- Prefer fewer useful panels over many noisy panels.
- Do not save dashboards or saved objects without explicit confirmation and a verified tool path.
- If `platform_core_create_visualization` stores an attachment rather than a saved dashboard, say so clearly.
- If `platform_core_create_visualization` fails with `Unauthorized to get actions`, say the Elastic visualization attachment tool is unavailable with the current key, then continue with Flexiclaw preview/publish validation. Do not say Lens itself is broken.
- Keep the investigation read-only. The only MVP write path is explicit dashboard publishing after preview approval.

## Output Format

```markdown
## Dashboard objective

## Audience

## Global filters

## Proposed panels

## Preview file

## Draft file

## Next command

## ES|QL per panel

## Visualization configs created

## Save confirmation required

## Limitations
```
