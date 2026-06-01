---
name: elastic-apm-investigator
description: "Use when the user asks to investigate Elastic APM latency, traces, transactions, service dependencies, errors or correlations."
metadata:
  flexiclaw:
    capability: apm_investigation
    mode: read_only
    elastic_tool_namespaces:
      - observability
      - platform.core
---

# Elastic APM Investigator

## Purpose

Investigate latency, errors, traces, transactions and dependencies using Elastic observability tools.

## When To Use

Use this skill for:

- latency spikes
- slow services
- slow transactions
- increased error rate
- dependency latency
- APM traces
- suspected code path or downstream service issues

## Required Workflow

1. Identify service, environment and time window.
2. Check service health and active alerts.
3. Identify affected transactions.
4. Review latency p95 and p99 when available.
5. Compare affected window with baseline.
6. Inspect trace metrics, change points and representative traces.
7. Identify slow spans and downstream dependencies.
8. Correlate with logs from the same service.
9. Correlate with host or runtime metrics.
10. Report candidate code areas only as hypotheses unless trace evidence supports them.

## Natural Flow

For "which service is unhealthy?", start with `observability_get_services`.

For a known service, use:

- `observability_get_trace_metrics` grouped by `transaction.name`;
- `observability_get_trace_change_points` for sudden latency, throughput or failure-rate changes;
- `observability_get_apm_correlations` to identify over-represented dimensions;
- `observability_get_traces` only after metrics identify a useful trace scope;
- `observability_get_service_topology` when dependency or blast-radius questions appear.

## Recommended Elastic Tools

- `observability_get_services`
- `observability_get_alerts`
- `observability_get_trace_metrics`
- `observability_get_traces`
- `observability_get_trace_change_points`
- `observability_get_apm_correlations`
- `observability_get_runtime_metrics`
- `observability_get_service_topology`
- `observability_get_logs`
- `platform_core_generate_esql`
- `platform_core_execute_esql`

## Dashboard Snapshot

When the user asks to create or save an APM investigation dashboard from Codex, use the `elastic-dashboard-builder` flow with:

```sh
npm run flexiclaw:dashboard -- --preset apm-service-overview --service <service.name> --environment <service.environment>
```

Treat the result as an incident snapshot that complements Kibana's native APM app.
Do not create this dashboard automatically for every APM investigation.

## Field Guidance

Use these fields when ES|QL is needed and mappings confirm them:

- `service.name`
- `service.environment`
- `service.version`
- `transaction.name`
- `transaction.type`
- `transaction.duration.us`
- `transaction.result`
- `event.outcome`
- `trace.id`
- `span.id`
- `span.type`
- `span.subtype`
- `span.destination.service.resource`
- `error.exception.type`
- `error.exception.message`

## Safety Rules

- Do not assume a slow dependency is the root cause without correlation.
- Do not infer a deployment regression unless service version or deployment evidence exists.
- Keep logs, traces and metrics connected to the same time window.
- Keep the workflow read-only.

## Output Format

```markdown
## APM investigation summary

## Affected services and transactions

## Latency analysis

## Error analysis

## Slow spans and dependencies

## Correlation with logs

## Correlation with metrics

## Candidate cause

## Next debugging steps

## Confidence and unknowns
```
