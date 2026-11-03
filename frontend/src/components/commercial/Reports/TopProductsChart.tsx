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

type TopProductsChartProps = {
  data: { name: string; value: number; quantity: number }[];
};

const COLORS = ["#82ca9d", "#8884d8", "#ffc658", "#ff7300", "#d0ed57"];

export function TopProductsChart({ data }: TopProductsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
        <XAxis type="number" />
        <YAxis dataKey="name" type="category" width={120} style={{ fontSize: "0.8rem" }} />
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
          formatter={(value: number, name: string) => {
            if (name === "value") {
              return new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(value);
            }
            return value;
          }}
          cursor={{ fill: "transparent" }}
        />
        <Bar dataKey="quantity" name="Quantidade" fill="#82ca9d" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((_, index) => (
            <Cell key={`product-cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

