# Example Prompts

## Connect Elastic

```text
Quiero conectar Elastic a Flexiclaw. Indicame como rellenar ~/.config/flexiclaw/config.json sin pegar la API key en el chat.
```

```text
Ya tengo ~/.config/flexiclaw/config.json configurado. Valida la conexion y dime si Flexiclaw puede usar Elastic.
```

## What Can Flexiclaw See?

```text
Que puedes ver en mi Elastic? Dame servicios, indices/streams relevantes, alertas y datos disponibles para observabilidad.
```

## Incident Investigation

```text
Investigate why checkout is returning 500 errors in production during the last 2 hours. Use Elastic logs, APM traces and metrics. Produce an evidence-based summary.
```

## Latency Spike

```text
Analyze the latency spike for payments in the last 6 hours. Compare it with the previous 6 hours and identify the most likely cause with evidence.
```

## Log Volume Change

```text
Find what changed in nginx logs during the last hour. Show aggregate drivers first, then representative examples.
```

## Metrics Correlation

```text
Check whether CPU, memory or runtime metrics correlate with the API latency spike for checkout.
```

## Dashboard

```text
Create a dashboard preview to investigate logs from the last 30 days. Use Lens if possible. Don't save it to Kibana until I approve it; show me the dashboard preview.
```

```text
Crea una preview de dashboard para investigar checkout durante las ultimas 2 horas. Usa Lens si es posible y no lo guardes en Kibana hasta que lo apruebe.
```

## ES|QL

```text
Generate ES|QL queries to compare error rates for checkout before and after the last deployment. Validate fields before executing.
```
