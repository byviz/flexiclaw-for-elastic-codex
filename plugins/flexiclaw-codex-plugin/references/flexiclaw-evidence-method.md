# Flexiclaw Evidence Method

## Principle

Do not claim more than the evidence supports.

Every investigation should separate:

- observed facts;
- hypotheses;
- uncertainty;
- recommended next actions.

## Evidence Categories

### Live Elastic Evidence

Data returned by Elastic tools:

- logs;
- traces;
- metrics;
- streams;
- mappings;
- ES|QL results;
- visualization artifacts.

Use phrases such as:

```text
Based on live Elastic evidence...
```

### User Context

Information supplied by the user:

- incident description;
- deployment time;
- affected service;
- business impact;
- expected behavior.

Use phrases such as:

```text
The user-provided context says...
```

### General Knowledge

Elastic or operational knowledge not proven by the cluster data.

Use phrases such as:

```text
A plausible explanation is...
```

## Required Investigation Shape

1. Scope.
2. Signal discovery.
3. Aggregate evidence.
4. Baseline comparison.
5. Correlation.
6. Hypotheses.
7. Validation.
8. Findings.
9. Uncertainty.
10. Next actions.

## Confidence

Use:

- `high`: multiple independent signals support the conclusion and no major contradiction was found.
- `medium`: evidence supports the conclusion but one important signal is missing or ambiguous.
- `low`: evidence is partial, indirect or only establishes correlation.

Never use confidence to hide missing data.
