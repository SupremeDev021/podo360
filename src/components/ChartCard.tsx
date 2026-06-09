type ChartCardProps = {
  title: string;
  subtitle: string;
  data: Array<{ label: string; value: number; secondary?: number }>;
  format?: "currency" | "number" | "percent";
};

function formatValue(value: number, format: ChartCardProps["format"]) {
  if (format === "currency") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  }

  if (format === "percent") {
    return `${value}%`;
  }

  return String(value);
}

export function ChartCard({ title, subtitle, data, format = "number" }: ChartCardProps) {
  const max = Math.max(...data.flatMap((item) => [item.value, item.secondary ?? 0]), 1);

  return (
    <section className="chart-card">
      <div className="section-heading section-heading--compact">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="bar-chart" role="img" aria-label={title}>
        {data.map((item) => (
          <div className="bar-chart__item" key={item.label}>
            <div className="bar-chart__bars">
              <span style={{ height: `${Math.max((item.value / max) * 100, 8)}%` }} />
              {typeof item.secondary === "number" && (
                <span className="bar-chart__secondary" style={{ height: `${Math.max((item.secondary / max) * 100, 8)}%` }} />
              )}
            </div>
            <strong>{item.label}</strong>
            <small>{formatValue(item.value, format)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
