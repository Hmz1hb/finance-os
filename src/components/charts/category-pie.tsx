"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const colors = ["#4A90D9", "#27AE60", "#E74C3C", "#F39C12", "#8E44AD", "#7f8c8d", "#16a085", "#d35400"];

export function CategoryPie({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "#222837", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
