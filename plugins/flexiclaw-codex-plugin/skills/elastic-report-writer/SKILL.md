---
name: elastic-report-writer
description: "Use when the user asks to turn an Elastic observability investigation into an evidence-based report, RCA, executive summary or technical incident write-up."
metadata:
  flexiclaw:
    capability: report_writing
    mode: read_only
---

# Elastic Report Writer

## Purpose

Convert an Elastic observability investigation into a clear evidence-based report.

## When To Use

Use this skill for:

- RCA
- incident report
- executive summary
- customer-facing report
- technical investigation summary
- postmortem draft
- dashboard explanation

## Required Workflow

1. Restate the scope.
2. Separate observed facts from hypotheses.
3. Include timeline and evidence.
4. Include impact when known.
5. Include queries, tools and artifacts used.
6. State confidence and unknowns.
7. Recommend next actions.
8. Avoid overstating root cause when only correlation exists.

## Evidence Sources

Label evidence clearly:

- live Elastic evidence;
- generated ES|QL and query results;
- visualization or dashboard artifacts;
- user-provided context;
- general Elastic knowledge.

Do not mix these categories.

## Output Format

```markdown
# Investigation Report

## 1. Executive summary

## 2. Scope

## 3. Timeline

## 4. Key findings

## 5. Evidence

## 6. Root cause hypothesis

## 7. Impact

## 8. Recommended actions

## 9. Follow-up checks

## 10. Queries, tools and artifacts

## 11. Confidence and limitations
```

## Safety Rules

- Do not turn uncertainty into certainty.
- Do not hide missing data.
- Do not claim remediation was performed.
- Keep customer-facing language professional and precise.
- Preserve reproducibility by including queries and tool names when useful.
