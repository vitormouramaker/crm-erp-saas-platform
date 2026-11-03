import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Legend, Tooltip } from "recharts";
import "./chart.css";

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

interface ChartContainerProps extends HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
  children: ReactNode;
}

export function ChartContainer({ className, config, style, children, ...props }: ChartContainerProps) {
  const colorVars = Object.entries(config).reduce((acc, [key, value]) => {
    if (value.color) {
      acc[`--color-${key}`] = value.color;
    }
    return acc;
  }, {} as Record<string, string>);

  return (
    <div
      className={cx("ui-chart-container", className)}
      style={{ ...(colorVars as CSSProperties), ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export const ChartTooltip = Tooltip;
export const ChartLegend = Legend;

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    name?: string;
    value?: number | string;
    color?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string | number;
  hideLabel?: boolean;
  nameKey?: string;
  labelFormatter?: (value: string | number) => string;
  valueFormatter?: (value: number | string) => string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel,
  nameKey,
  labelFormatter,
  valueFormatter,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="ui-chart-tooltip">
      {!hideLabel && label !== undefined && (
        <div className="ui-chart-tooltip-label">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      )}
      <div className="ui-chart-tooltip-list">
        {payload.map((entry, index) => (
          <div className="ui-chart-tooltip-item" key={`${entry.dataKey || entry.name}-${index}`}>
            <span className="ui-chart-dot" style={{ background: entry.color || "#64748b" }} />
            <span className="ui-chart-item-name">
              {nameKey && entry.payload?.[nameKey] !== undefined
                ? String(entry.payload[nameKey])
                : entry.name || entry.dataKey}
            </span>
            <strong className="ui-chart-item-value">
              {valueFormatter ? valueFormatter(entry.value ?? 0) : entry.value ?? 0}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChartLegendContentProps {
  payload?: Array<{
    value?: string;
    dataKey?: string;
    color?: string;
  }>;
}

export function ChartLegendContent({ payload }: ChartLegendContentProps) {
  if (!payload?.length) return null;

  return (
    <div className="ui-chart-legend">
      {payload.map((item, index) => (
        <div className="ui-chart-legend-item" key={`${item.dataKey || item.value}-${index}`}>
          <span className="ui-chart-dot" style={{ background: item.color || "#64748b" }} />
          <span>{item.value || item.dataKey}</span>
        </div>
      ))}
    </div>
  );
}
