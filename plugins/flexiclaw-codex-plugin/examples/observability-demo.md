# Observability Demo

## Goal

Demonstrate that Codex can investigate an Elastic observability incident using Elastic tools and Flexiclaw evidence rules.

## Demo Prompt

```text
Investigate why checkout is returning 500 errors in production during the last 2 hours. Use logs, traces and metrics. Generate a dashboard recommendation and an evidence-based report.
```

## Expected Flow

1. Scope the incident.
2. Discover services and available data.
3. Inspect aggregate logs, trace metrics and host signals.
4. Compare with baseline.
5. Identify affected transactions, exceptions, hosts or pods.
6. Build hypotheses.
7. Validate strongest hypothesis.
8. Recommend dashboard panels.
9. Produce report with evidence and unknowns.

## Expected Output

- incident summary;
- scope;
- key findings;
- timeline;
- evidence;
- hypotheses;
- most likely cause;
- recommended next actions;
- queries and tools used;
- dashboard recommendation;
- confidence and unknowns.
