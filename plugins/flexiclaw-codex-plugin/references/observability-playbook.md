# Observability Investigation Playbook

## Incident Flow

1. Confirm scope:
   - service;
   - environment;
   - time window;
   - symptom;
   - impact.
2. Discover signals:
   - services;
   - logs;
   - traces;
   - hosts;
   - streams;
   - relevant indices.
3. Establish aggregate symptoms:
   - error rate;
   - latency;
   - throughput;
   - resource pressure;
   - log volume.
4. Compare against baseline.
5. Identify affected entities:
   - service;
   - transaction;
   - endpoint;
   - host;
   - pod;
   - version.
6. Correlate signals.
7. Build and validate hypotheses.
8. Produce report and dashboard recommendation.

## Useful Questions

- Did the symptom start suddenly or gradually?
- Is it isolated to one service or broader?
- Is it tied to one endpoint, transaction, host, pod or version?
- Did traffic increase, or did the failure rate worsen?
- Do logs and traces point to the same error?
- Do resource metrics change before, during or after the symptom?
- Is there a baseline window with normal behavior?

## Common Pitfalls

- Starting with individual logs before aggregate analysis.
- Treating correlation as root cause.
- Ignoring missing data.
- Mixing user assumptions with live Elastic evidence.
- Creating dashboards with too many panels and no clear question.
