# Dashboard Patterns

## Principle

A dashboard panel must answer a specific investigation question.

Avoid decorative panels.

## Service Incident Dashboard

Audience:

- SRE;
- developer;
- incident commander.

Global filters:

- time range;
- `service.name`;
- environment;
- namespace;
- host or pod when needed.

Panels:

- error rate over time;
- request or transaction volume over time;
- latency p95/p99 over time;
- top endpoints or transactions by errors;
- top exceptions;
- affected hosts or pods;
- slow traces or dependencies;
- recent relevant logs.

## Log Volume Dashboard

Panels:

- log throughput over time;
- error and warning volume over time;
- top services by log volume;
- top log messages;
- fields driving rate changes;
- recent samples for selected pattern.

## APM Latency Dashboard

Panels:

- p50/p95/p99 latency over time;
- top slow transactions;
- top dependencies by latency;
- error rate by transaction;
- trace samples;
- service topology when available.

## Metrics Correlation Dashboard

Panels:

- CPU by host or pod;
- memory by host or pod;
- runtime metrics;
- error rate overlay;
- latency overlay;
- affected hosts or pods table.

## Save Rule

In the MVP, create visualization configurations through Elastic connectivity, then use Flexiclaw's draft/preview/publish flow for persistent dashboards. Do not claim a saved Kibana dashboard exists unless Kibana saved-object creation and verification succeed.
