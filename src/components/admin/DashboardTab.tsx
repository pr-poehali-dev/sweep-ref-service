import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { sourceLabel, type Restaurant, type ResponseRecord, type SourceOption } from "@/lib/store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

const COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#7c3aed"];

interface DashboardTabProps {
  restaurants: Restaurant[];
  filtered: ResponseRecord[];
  sources: SourceOption[];
  selectedRestaurant: string;
  setSelectedRestaurant: (v: string) => void;
  dateRange: string;
  setDateRange: (v: string) => void;
  onRefresh: () => void;
  onExport: () => void;
}

const DashboardTab = ({
  restaurants,
  filtered,
  sources,
  selectedRestaurant,
  setSelectedRestaurant,
  dateRange,
  setDateRange,
  onRefresh,
  onExport,
}: DashboardTabProps) => {
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => {
      counts[r.source] = (counts[r.source] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([key, value]) => ({ name: sourceLabel(key, sources), value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, sources]);

  const barData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => {
      counts[r.source] = (counts[r.source] || 0) + 1;
    });
    return sources.filter(s => s.active).map((s) => ({
      name: s.label.length > 16 ? s.label.slice(0, 16) + "…" : s.label,
      fullName: s.label,
      count: counts[s.key] || 0,
    }));
  }, [filtered, sources]);

  const lineData = useMemo(() => {
    const dateMap: Record<string, number> = {};
    filtered.forEach((r) => {
      const d = new Date(r.created_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      });
      dateMap[d] = (dateMap[d] || 0) + 1;
    });
    return Object.entries(dateMap)
      .map(([date, count]) => ({ date, count }))
      .slice(-30);
  }, [filtered]);

  const topSource = pieData[0]?.name || "—";
  const todayCount = filtered.filter((r) => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
          <SelectTrigger className="w-[200px] bg-white">
            <SelectValue placeholder="Ресторан" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все рестораны</SelectItem>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всё время</SelectItem>
            <SelectItem value="today">Сегодня</SelectItem>
            <SelectItem value="week">7 дней</SelectItem>
            <SelectItem value="month">30 дней</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <Icon name="RefreshCw" size={14} />
            <span className="ml-1.5">Обновить</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Icon name="Download" size={14} />
            <span className="ml-1.5">Экспорт CSV</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="Users" size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filtered.length}</p>
                <p className="text-sm text-muted-foreground">Всего ответов</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="TrendingUp" size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayCount}</p>
                <p className="text-sm text-muted-foreground">Сегодня</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="Award" size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold truncate max-w-[160px]">{topSource}</p>
                <p className="text-sm text-muted-foreground">Топ источник</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">По источникам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [value, "Ответов"]}
                    labelFormatter={(label: string) => {
                      const item = barData.find((d) => d.name === label);
                      return item?.fullName || label;
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(221, 83%, 53%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Распределение</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, "Ответов"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {lineData.length > 1 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Динамика по дням</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [value, "Ответов"]} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(221, 83%, 53%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardTab;
