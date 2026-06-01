---
name: elastic-logs-investigator
description: "Use when the user asks to investigate Elastic logs, log errors, exceptions, throughput spikes, missing logs or log patterns."
metadata:
  flexiclaw:
    capability: logs_investigation
    mode: read_only
    elastic_tool_namespaces:
      - observability
      - platform.core
      - platform.streams
---

# Elastic Logs Investigator

## Purpose

Analyze logs with Elastic while preserving Flexiclaw evidence rules.

## When To Use

Use this skill for:

- HTTP 500 errors
- exceptions
- timeouts
- warning or error spikes
- log volume drops
- log volume spikes
- endpoint, host, pod or version comparisons
- "what changed in logs?"

## Required Workflow

1. Identify relevant streams, data views or indices.
2. Discover schema or top field values before writing detailed filters.
3. Start with aggregate signals:
   - logs over time
   - errors over time
   - top services
   - top messages
   - top exceptions
   - top hosts or pods
4. Compare incident window against baseline.
5. Sample representative events only after aggregates reveal a pattern.
6. Produce queries and explain what each query proves.

## Natural Flow

For broad log questions, start with `observability_get_logs` and use its histogram, categories, samples and top values to narrow the investigation.

For "what changed?" questions, compare a baseline and deviation window with `observability_run_log_rate_analysis`, then confirm with `observability_get_log_change_points` or `observability_get_log_groups`.

For stream-specific questions, use stream schema/quality tools before querying documents.

## Recommended Elastic Tools

- `observability_get_logs`
- `observability_get_log_groups`
- `observability_get_log_change_points`
- `observability_run_log_rate_analysis`
- `observability_get_index_info`
- `platform_streams_get_schema`
- `platform_streams_get_data_quality`
- `platform_streams_get_failed_documents`
- `platform_streams_query_documents`
- `platform_core_index_explorer`
- `platform_core_list_indices`
- `platform_core_generate_esql`
- `platform_core_execute_esql`

## Field Guidance

Prefer these fields when they exist:

- `@timestamp`
- `service.name`
- `service.environment`
- `service.version`
- `log.level`
- `message`
- `error.message`
- `error.exception.type`
- `event.dataset`
- `host.name`
- `kubernetes.pod.name`
- `kubernetes.namespace`
- `url.path`
- `http.response.status_code`

Validate field availability with schema or mapping tools when possible.

## Safety Rules

- Do not start with individual events if aggregate analysis is possible.
- Distinguish error rate from raw error count.
- Check whether a spike is caused by more traffic or worse failure rate.
- State when field names or index names are inferred.
- Keep the workflow read-only.

## Output Format

```markdown
## Log investigation summary

## Scope

## Aggregate findings

## Representative events

## Patterns

## Baseline comparison

## ES|QL / queries used

## Confidence and unknowns
```
