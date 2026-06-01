# ES|QL Observability Patterns

These patterns are conceptual. Use `platform_core_generate_esql` to generate executable ES|QL for the current cluster and schema.

## Error Rate Over Time

Goal:

```text
Count errors per time bucket for a service.
```

Fields to validate:

- `@timestamp`
- `service.name`
- `log.level`
- `http.response.status_code`
- `event.outcome`

## Top Exceptions

Goal:

```text
Find the most common exception types or error messages.
```

Fields to validate:

- `error.exception.type`
- `error.exception.message`
- `error.message`
- `message`

## Latency Percentiles

Goal:

```text
Compare p95/p99 latency by transaction or service over time.
```

Fields to validate:

- `transaction.duration.us`
- `transaction.name`
- `service.name`
- `event.outcome`

## Baseline Versus Incident

Goal:

```text
Compare a current incident window with a previous healthy window.
```

Recommended output:

- metric;
- baseline value;
- incident value;
- delta;
- affected entity.

## Log Volume Change

Goal:

```text
Find which services, hosts or messages drove a log volume increase or drop.
```

Recommended approach:

- bucket by time;
- group by service or host;
- then inspect top changing fields.

## Dashboard Panel Queries

Useful panel goals:

- error rate over time;
- latency p95/p99 over time;
- top exceptions;
- top affected pods or hosts;
- recent relevant logs;
- dependency latency;
- log volume by service.
