---
name: elastic-metrics-investigator
description: "Use when the user asks to investigate Elastic infrastructure metrics, hosts, runtime metrics, CPU, memory, disk, network or resource pressure."
metadata:
  flexiclaw:
    capability: metrics_investigation
    mode: read_only
    elastic_tool_namespaces:
      - observability
      - platform.core
---

# Elastic Metrics Investigator

## Purpose

Investigate infrastructure, host and runtime signals with Elastic tools.

## When To Use

Use this skill for:

- CPU spikes
- memory pressure
- disk pressure
- network errors
- container or pod restarts
- JVM/runtime issues
- host saturation
- resource correlation with application symptoms

## Required Workflow

1. Define affected service, host, pod or environment.
2. Discover hosts and runtime visibility.
3. Compare incident window with baseline.
4. Review CPU, memory, disk and network signals when available.
5. Review runtime metrics for JVM or service runtime issues when available.
6. Use metric change points when the user asks what changed.
7. Correlate host/resource signals with logs and traces.
8. Determine whether symptoms appear local, regional, service-wide or dependency-driven.

## Natural Flow

Use `observability_get_hosts` for broad infrastructure health. Use `observability_get_runtime_metrics` for service runtime pressure, especially JVM services. Use `observability_get_metric_change_points` when the question is about spikes, drops or changes.

If host-level metrics are missing, state that limitation and fall back to service, trace and log evidence.

## Recommended Elastic Tools

- `observability_get_hosts`
- `observability_get_metric_change_points`
- `observability_get_runtime_metrics`
- `observability_get_services`
- `observability_get_trace_metrics`
- `observability_get_logs`
- `platform_core_generate_esql`
- `platform_core_execute_esql`
- `platform_core_index_explorer`
- `platform_core_list_indices`

## Safety Rules

- Do not claim resource saturation caused the incident unless timing and affected entities match.
- Separate correlation from causation.
- Mention missing metric visibility explicitly.
- Keep the workflow read-only.

## Output Format

```markdown
## Metrics investigation summary

## Affected infrastructure

## Resource signals

## Correlation with application symptoms

## Likely cause

## Recommended actions

## Confidence and unknowns
```
