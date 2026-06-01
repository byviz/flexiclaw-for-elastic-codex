---
name: elastic-observability-investigator
description: "Use when the user asks to investigate an Elastic observability incident across logs, APM traces, metrics, services, hosts or streams."
metadata:
  flexiclaw:
    capability: observability_investigation
    mode: read_only
    elastic_tool_namespaces:
      - observability
      - platform.core
      - platform.streams
---

# Elastic Observability Investigator

## Purpose

Investigate production incidents using Elastic connectivity and the Flexiclaw evidence method.

This skill is the main entry point for incidents that may involve logs, services, traces, latency, infrastructure metrics, streams or ES|QL.

## When To Use

Use this skill when the user asks:

- investigate this incident
- why is service X failing?
- checkout is returning 500 errors
- latency increased
- logs dropped or spiked
- what happened between two times?
- root cause analysis
- RCA

## Required Workflow

1. Define scope only as much as needed:
   - service or system
   - environment
   - time window
   - symptom
   - observed impact
2. Discover available Elastic signals:
   - services
   - logs
   - traces
   - hosts
   - runtime metrics
   - alerts
   - streams
   - relevant indices
3. Query aggregate signals before individual events.
4. Compare incident window against a baseline when possible.
5. Correlate logs, APM traces and metrics.
6. Create hypotheses with evidence for and against each one.
7. Validate the strongest hypothesis with additional queries.
8. Report findings, uncertainty, next actions and reproducible queries.

## Natural Flow

When the user asks a broad question such as "que puedes ver en mi Elastic?", start with:

- `observability_get_services`
- `observability_get_index_info`
- `platform_core_list_indices`
- `observability_get_alerts`

Then summarize what data exists and suggest the next useful investigation paths.

When the user describes an incident, choose the focused tool path first:

- logs/errors: log tools;
- latency/APM: trace and service tools;
- resource pressure: host and runtime metric tools;
- data quality: stream tools;
- custom aggregation: ES|QL generation and execution.

Do not force dashboard creation. Offer or create a dashboard only when it improves investigation handoff or evidence review.

## Recommended Elastic Tools

Start with these tools when relevant:

- `observability_get_services`
- `observability_get_alerts`
- `observability_get_logs`
- `observability_get_log_groups`
- `observability_get_log_change_points`
- `observability_run_log_rate_analysis`
- `observability_get_traces`
- `observability_get_trace_metrics`
- `observability_get_trace_change_points`
- `observability_get_apm_correlations`
- `observability_get_service_topology`
- `observability_get_hosts`
- `observability_get_metric_change_points`
- `observability_get_runtime_metrics`
- `observability_get_index_info`
- `platform_core_index_explorer`
- `platform_core_list_indices`
- `platform_core_generate_esql`
- `platform_core_execute_esql`
- `platform_streams_get_schema`
- `platform_streams_get_data_quality`
- `platform_streams_get_failed_documents`
- `platform_streams_query_documents`

Use `platform_core_generate_esql` before `platform_core_execute_esql` unless the user provides a verbatim ES|QL query.

## Safety Rules

- Keep the workflow read-only.
- Do not claim a root cause without evidence.
- Separate observed facts, hypotheses and uncertainty.
- Do not modify cluster settings, ILM, templates or data streams.
- Do not save dashboards unless the user explicitly asks for it and approves the preview.
- Do not present isolated events as representative unless aggregate evidence supports them.
- If a tool returns partial data or fails due to permissions, state the limitation.

## Output Format

```markdown
## Incident summary

## Scope

## Key signals

## Timeline

## Evidence

## Hypotheses

## Most likely cause

## Recommended next actions

## Queries and tools used

## Confidence and unknowns
```

## Example

User:

```text
Investigate why checkout is returning 500 errors in production during the last 2 hours.
```

Expected behavior:

- identify checkout service and time range;
- inspect service, logs, traces and hosts;
- compare the last 2 hours with a previous baseline;
- find top errors, affected transactions and resource signals;
- produce an evidence-based incident report.
