import { useMemo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  AreaChart,
  Area,
} from "recharts";

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#be185d", "#4f46e5"];

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
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(onRefresh, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

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
    })).sort((a, b) => b.count - a.count);
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

  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hours[h] = 0;
    filtered.forEach((r) => {
      const h = new Date(r.created_at).getHours();
      hours[h] = (hours[h] || 0) + 1;
    });
    return Object.entries(hours).map(([hour, count]) => ({
      hour: `${hour}:00`,
      count,
    }));
  }, [filtered]);

  const restaurantComparison = useMemo(() => {
    if (restaurants.length <= 1) return [];
    const counts: Record<number, number> = {};
    filtered.forEach((r) => {
      counts[r.restaurant_id] = (counts[r.restaurant_id] || 0) + 1;
    });
    return restaurants.map((r) => ({
      name: r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name,
      fullName: r.name,
      count: counts[r.id] || 0,
    })).sort((a, b) => b.count - a.count);
  }, [filtered, restaurants]);

  const topSource = pieData[0]?.name || "—";
  const todayCount = filtered.filter((r) => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const yesterdayCount = filtered.filter((r) => {
    const d = new Date(r.created_at);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return d.toDateString() === yesterday.toDateString();
  }).length;

  const todayDiff = yesterdayCount > 0 ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100) : 0;

  const avgPerDay = useMemo(() => {
    if (filtered.length === 0) return 0;
    const dates = new Set(filtered.map((r) => new Date(r.created_at).toDateString()));
    return Math.round(filtered.length / dates.size);
  }, [filtered]);

  const peakHour = useMemo(() => {
    const max = hourlyData.reduce((a, b) => (a.count > b.count ? a : b), { hour: "—", count: 0 });
    return max.count > 0 ? max.hour : "—";
  }, [hourlyData]);

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

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <span className="hidden sm:inline">Авто</span>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <Icon name="RefreshCw" size={14} />
            <span className="ml-1.5 hidden sm:inline">Обновить</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Icon name="Download" size={14} />
            <span className="ml-1.5 hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="Users" size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filtered.length}</p>
                <p className="text-xs text-muted-foreground">Всего</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Icon name="TrendingUp" size={18} className="text-green-600" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-bold">{todayCount}</p>
                  {todayDiff !== 0 && (
                    <span className={`text-xs font-medium ${todayDiff > 0 ? "text-green-600" : "text-red-500"}`}>
                      {todayDiff > 0 ? "+" : ""}{todayDiff}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Сегодня</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Icon name="Clock" size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{peakHour}</p>
                <p className="text-xs text-muted-foreground">Пик</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Icon name="Award" size={18} className="text-violet-600" />
              </div>
              <div>
                <p className="text-lg font-bold truncate max-w-[120px]">{topSource}</p>
                <p className="text-xs text-muted-foreground">Топ</p>
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
              {barData.length > 0 ? (
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
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Нет данных</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Распределение</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {pieData.length > 0 ? (
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
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Нет данных</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {lineData.length > 1 && (
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                Динамика
                <span className="text-xs font-normal text-muted-foreground">~{avgPerDay}/день</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [value, "Ответов"]} />
                    <Area type="monotone" dataKey="count" stroke="hsl(221, 83%, 53%)" fill="hsl(221, 83%, 53%)" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">По часам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [value, "Ответов"]} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {restaurantComparison.length > 1 && selectedRestaurant === "all" && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Сравнение ресторанов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={restaurantComparison} margin={{ left: 0, right: 16 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value, "Ответов"]}
                    labelFormatter={(label: string) => {
                      const item = restaurantComparison.find((d) => d.name === label);
                      return item?.fullName || label;
                    }}
                  />
                  <Bar dataKey="count" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardTab;
