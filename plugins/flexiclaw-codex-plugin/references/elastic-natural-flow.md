# Elastic Natural Flow

Flexiclaw should let the user speak in operational language. The user should not need to know tool names, namespaces or protocols.

## Default Conversation Pattern

1. Restate the investigation scope only when it helps.
2. Ask for missing scope only if it cannot be inferred safely:
   - service or system;
   - environment;
   - time window;
   - symptom;
   - desired artifact, if any.
3. Discover available Elastic data.
4. Use focused observability tools before generic ES|QL.
5. Use aggregate evidence before samples.
6. Compare incident and baseline windows when possible.
7. Correlate across logs, traces, metrics, runtime, alerts and topology.
8. Label facts, hypotheses and unknowns separately.
9. Create dashboard previews only when a visual snapshot improves the investigation.
10. Publish dashboards only after explicit approval.

## Intent Routing

| User intent | Preferred tools |
| --- | --- |
| "What can you see?" | `observability_get_services`, `observability_get_index_info`, `platform_core_list_indices`, `observability_get_alerts` |
| Logs/errors/exceptions | `observability_get_logs`, `observability_get_log_groups`, `observability_get_log_change_points`, `observability_run_log_rate_analysis` |
| APM latency/errors | `observability_get_services`, `observability_get_trace_metrics`, `observability_get_trace_change_points`, `observability_get_apm_correlations` |
| Specific trace | `observability_get_traces`, `platform_core_get_document_by_id` |
| Dependencies | `observability_get_service_topology`, `observability_get_trace_metrics` |
| Hosts/resources | `observability_get_hosts`, `observability_get_runtime_metrics`, `observability_get_metric_change_points` |
| Streams/data quality | `platform_streams_get_schema`, `platform_streams_get_data_quality`, `platform_streams_get_failed_documents`, `platform_streams_query_documents` |
| ES|QL | `platform_core_generate_esql`, then `platform_core_execute_esql` |
| Dashboards | `platform_core_create_visualization`, then Flexiclaw draft/preview/publish flow |
| Elastic docs/integrations | `platform_core_product_documentation`, `platform_core_integration_knowledge` |

## Tool Rules

- Do not invent ES|QL and send it directly to execution. Generate it first unless the user provided it verbatim.
- Do not guess field values. Use field discovery or top-values returned by focused tools.
- Do not treat a visualization attachment as a saved Kibana dashboard.
- Do not claim a dashboard exists until Kibana saved-object publish and verification succeed.
- Do not modify cluster settings, ILM, templates, data streams or mappings in MVP 1.

## Dashboard Rule

Dashboard creation is a product feature, not the core investigation loop.

Natural requests like "show me the preview" or "quiero verlo antes" should generate the preview artifact and return its path. The user should not need to know internal field names such as `previewPath` or `draftPath`.

Use dashboards when they produce reusable incident evidence, for example:

- an incident snapshot for handoff;
- a service investigation view;
- a before/after comparison;
- a compact report artifact.

Prefer a written investigation summary when a dashboard would add noise.
