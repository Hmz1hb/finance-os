"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MonthlyBars({ data }: { data: Array<{ month: string; income: number; expenses: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="month" stroke="#9ca8ba" tickLine={false} axisLine={false} />
          <YAxis stroke="#9ca8ba" tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{ background: "#222837", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8 }}
          />
          <Bar dataKey="income" fill="#27AE60" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" fill="#E74C3C" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
