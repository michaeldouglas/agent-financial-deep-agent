"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  Rectangle,
  ResponsiveContainer,
  Sankey,
  Scatter,
  ScatterChart,
  SunburstChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { downloadFile, filenameSlug } from "./download-file";

export type ChartType =
  | "bar" | "line" | "area" | "pie" | "composed" | "scatter"
  | "radar" | "radialBar" | "treemap" | "funnel" | "sankey" | "sunburst";

export type ChartRow = {
  label?: string;
  name?: string;
  value?: number;
  x?: number;
  y?: number;
  z?: number;
  children?: ChartRow[];
  [key: string]: string | number | ChartRow[] | undefined;
};

export type ChartSeries = {
  key: string;
  name?: string;
  type?: "bar" | "line" | "area";
};

export type ChartSpec = {
  type: ChartType;
  title: string;
  unit?: string;
  data?: ChartRow[];
  series?: ChartSeries[];
  x_key?: string;
  y_key?: string;
  z_key?: string;
  nodes?: { name: string }[];
  links?: { source: number; target: number; value: number }[];
  mock?: boolean;
  as_of?: string;
  colors?: string[];
};

const defaultColors = ["#4f46e5", "#0f766e", "#d97706", "#e11d48", "#0284c7", "#7c3aed"];

function flattenHierarchy(nodes: ChartRow[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const visit = (node: ChartRow, parents: string[]) => {
    const label = String(node.label ?? node.name ?? "");
    const path = [...parents, label];
    const row: Record<string, unknown> = { path: path.join(" / ") };
    for (const [key, value] of Object.entries(node)) {
      if (key !== "children") row[key] = value;
    }
    rows.push(row);
    node.children?.forEach((child) => visit(child, path));
  };
  nodes.forEach((node) => visit(node, []));
  return rows;
}

function chartCsvRows(chart: ChartSpec): Record<string, unknown>[] {
  if (chart.type === "sankey") {
    const nodes = chart.nodes ?? [];
    return (chart.links ?? []).map((link) => ({
      source_index: link.source,
      source_name: nodes[link.source]?.name ?? "",
      target_index: link.target,
      target_name: nodes[link.target]?.name ?? "",
      value: link.value,
    }));
  }

  const data = chart.data ?? [];
  if ((chart.type === "treemap" || chart.type === "sunburst") && data.some((row) => row.children?.length)) {
    return flattenHierarchy(data);
  }
  return data.map((row) => Object.fromEntries(Object.entries(row)));
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '""';
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  const safeText = typeof value === "string" && /^[-=+@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "\uFEFF";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function downloadChartFile(chart: ChartSpec, format: "csv" | "json") {
  const content = format === "json"
    ? JSON.stringify(chart, null, 2)
    : toCsv(chartCsvRows(chart));
  const mime = format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
  downloadFile(filenameSlug(chart.title, format), content, mime);
}

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean;
  payload?: { value?: number; name?: string; color?: string }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-medium text-slate-600">{label}</p>}
      {payload.map((item, index) => (
        <p key={`${item.name ?? "value"}-${index}`} className="font-semibold text-slate-900" style={{ color: item.color }}>
          {item.name ? `${item.name}: ` : ""}{item.value}{unit}
        </p>
      ))}
    </div>
  );
}

function CustomTreemapContent(props: { x?: number; y?: number; width?: number; height?: number; name?: string; index?: number }, colors: string[]) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", index = 0 } = props;
  if (width < 18 || height < 18) return <g />;
  return (
    <g>
      <Rectangle x={x} y={y} width={width} height={height} fill={colors[index % colors.length]} stroke="#fff" />
      {width > 48 && height > 28 && <text x={x + 8} y={y + 19} fill="#fff" fontSize={12}>{name}</text>}
    </g>
  );
}

export default function ChartRenderer({ chart }: { chart: ChartSpec }) {
  const colors = chart.colors?.length ? chart.colors : defaultColors;
  const data = chart.data ?? [];
  const primaryColor = colors[0];
  const common = { data, margin: { top: 12, right: 12, left: 0, bottom: 4 } };
  const axes = <>
    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
    <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: "#64748b", fontSize: 12 }} />
    <Tooltip content={<ChartTooltip unit={chart.unit ?? ""} />} />
  </>;
  const series = chart.series?.length ? chart.series : [{ key: "value", name: "Valor" }];

  return (
    <section className="mt-4 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4" aria-label={`Gráfico: ${chart.title}`}>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{chart.title}</h3>
        <div className="flex shrink-0 gap-2" aria-label="Exportar dados do gráfico">
          <button
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            onClick={() => downloadChartFile(chart, "csv")}
            type="button"
          >
            Baixar CSV
          </button>
          <button
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            onClick={() => downloadChartFile(chart, "json")}
            type="button"
          >
            Baixar JSON
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-amber-700">
        {chart.mock ? "Dados fictícios para demonstração" : "Visualização de dados"}
        {chart.as_of ? ` · ${chart.as_of}` : ""}
      </p>
      <div className="h-72 w-full" role="img" aria-label={`${chart.type} chart`}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {data.map((point, index) => <Cell key={point.label ?? index} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip unit={chart.unit ?? ""} />} />
              <Legend />
            </PieChart>
          ) : chart.type === "line" ? (
            <LineChart {...common}>{axes}<Line type="monotone" dataKey="value" name="Valor" stroke={primaryColor} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart>
          ) : chart.type === "area" ? (
            <AreaChart {...common}>{axes}<Area type="monotone" dataKey="value" name="Valor" stroke={primaryColor} fill={`${primaryColor}33`} strokeWidth={2} /></AreaChart>
          ) : chart.type === "composed" ? (
            <ComposedChart {...common}>
              {axes}
              {series.map((item, index) => {
                const color = colors[index % colors.length];
                if (item.type === "area") return <Area key={item.key} type="monotone" dataKey={item.key} name={item.name ?? item.key} stroke={color} fill={`${color}33`} />;
                if (item.type === "line") return <Line key={item.key} type="monotone" dataKey={item.key} name={item.name ?? item.key} stroke={color} strokeWidth={2} />;
                return <Bar key={item.key} dataKey={item.key} name={item.name ?? item.key} fill={color} radius={[4, 4, 0, 0]} />;
              })}
              <Legend />
            </ComposedChart>
          ) : chart.type === "scatter" ? (
            <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 8 }}>
              <CartesianGrid stroke="#e2e8f0" />
              <XAxis type="number" dataKey={chart.x_key ?? "x"} name={chart.x_key ?? "X"} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis type="number" dataKey={chart.y_key ?? "y"} name={chart.y_key ?? "Y"} tick={{ fill: "#64748b", fontSize: 12 }} />
              <ZAxis type="number" dataKey={chart.z_key ?? "z"} range={[64, 400]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltip unit={chart.unit ?? ""} />} />
              <Scatter name={chart.title} data={data} fill={primaryColor} />
            </ScatterChart>
          ) : chart.type === "radar" ? (
            <RadarChart data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
              <PolarRadiusAxis />
              <Tooltip content={<ChartTooltip unit={chart.unit ?? ""} />} />
              {series.map((item, index) => <Radar key={item.key} name={item.name ?? item.key} dataKey={item.key} stroke={colors[index % colors.length]} fill={colors[index % colors.length]} fillOpacity={0.22} />)}
              <Legend />
            </RadarChart>
          ) : chart.type === "radialBar" ? (
            <RadialBarChart data={data} innerRadius="20%" outerRadius="90%" startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" background label={{ fill: "#fff", position: "insideStart" }}>
                {data.map((point, index) => <Cell key={point.label ?? index} fill={colors[index % colors.length]} />)}
              </RadialBar>
              <Tooltip content={<ChartTooltip unit={chart.unit ?? ""} />} />
              <Legend />
            </RadialBarChart>
          ) : chart.type === "treemap" ? (
            <Treemap data={data} dataKey="value" nameKey="label" content={(props) => CustomTreemapContent(props, colors)}>
              <Tooltip content={<ChartTooltip unit={chart.unit ?? ""} />} />
            </Treemap>
          ) : chart.type === "sunburst" ? (
            <SunburstChart data={data as never} dataKey="value" nameKey="label" innerRadius={30} outerRadius={110}>
              <Tooltip content={<ChartTooltip unit={chart.unit ?? ""} />} />
            </SunburstChart>
          ) : chart.type === "funnel" ? (
            <FunnelChart>
              <Tooltip content={<ChartTooltip unit={chart.unit ?? ""} />} />
              <Funnel data={data} dataKey="value" nameKey="label" isAnimationActive>
                {data.map((point, index) => <Cell key={point.label ?? index} fill={colors[index % colors.length]} />)}
                <LabelList position="right" fill="#334155" stroke="none" dataKey="label" />
              </Funnel>
            </FunnelChart>
          ) : chart.type === "sankey" ? (
            <Sankey data={{ nodes: chart.nodes ?? [], links: chart.links ?? [] }} nodePadding={24} nodeWidth={16} link={{ stroke: "#94a3b8", strokeOpacity: 0.45 }}>
              <Tooltip content={<ChartTooltip unit={chart.unit ?? ""} />} />
            </Sankey>
          ) : (
            <BarChart {...common}>{axes}<Bar dataKey="value" name="Valor" fill={primaryColor} radius={[5, 5, 0, 0]} /></BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
