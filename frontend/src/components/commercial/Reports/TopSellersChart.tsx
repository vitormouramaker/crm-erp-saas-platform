import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TopSellersChartProps = {
  data: { name: string; value: number }[];
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export function TopSellersChart({ data }: TopSellersChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
        <XAxis type="number" tickFormatter={(value) => `R$ ${Number(value) / 1000}k`} />
        <YAxis dataKey="name" type="category" width={100} />
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
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={`seller-cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

