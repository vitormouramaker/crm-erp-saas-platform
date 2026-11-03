import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MonthlySalesChartProps = {
  data: { month: string; value: number }[];
};

export function MonthlySalesChart({ data }: MonthlySalesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" axisLine={false} tickLine={false} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `R$ ${Number(value) / 1000}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            color: "var(--color-text-primary)",
          }}
          itemStyle={{ color: "var(--color-text-primary)" }}
          labelStyle={{ color: "var(--color-text-secondary)", fontWeight: 600, marginBottom: "4px" }}
          formatter={(value: number) =>
            new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(value)
          }
          cursor={{ fill: "transparent" }}
        />
        <Bar dataKey="value" fill="#3182ce" radius={[4, 4, 0, 0]} barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
