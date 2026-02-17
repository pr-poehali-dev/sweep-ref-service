import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import { SOURCES, apiCall, type Restaurant, type ResponseRecord } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
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

const LOGO_URL = "https://cdn.poehali.dev/projects/28c0c781-3d61-4cce-9755-515e9e1a816f/bucket/b439f2b5-53cb-429b-8e86-856855395be6.png";
const COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#7c3aed"];

const sourceLabel = (id: string) =>
  SOURCES.find((s) => s.id === id)?.label || id;

const AdminPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [newRestName, setNewRestName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingRest, setSavingRest] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("sweep_token");
    if (!token) {
      navigate("/login");
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "get_stats" }),
      });
      setRestaurants(data.restaurants || []);
      setResponses(data.responses || []);
    } catch {
      localStorage.removeItem("sweep_token");
      navigate("/login");
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = responses;
    if (selectedRestaurant !== "all") {
      result = result.filter((r) => r.restaurant_id === Number(selectedRestaurant));
    }
    if (dateRange !== "all") {
      const now = new Date();
      const cutoff = new Date();
      if (dateRange === "today") cutoff.setHours(0, 0, 0, 0);
      else if (dateRange === "week") cutoff.setDate(now.getDate() - 7);
      else if (dateRange === "month") cutoff.setMonth(now.getMonth() - 1);
      result = result.filter((r) => new Date(r.created_at) >= cutoff);
    }
    return result;
  }, [responses, selectedRestaurant, dateRange]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => {
      counts[r.source] = (counts[r.source] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: sourceLabel(name), value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const barData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((r) => {
      counts[r.source] = (counts[r.source] || 0) + 1;
    });
    return SOURCES.map((s) => ({
      name: s.label.length > 16 ? s.label.slice(0, 16) + "…" : s.label,
      fullName: s.label,
      count: counts[s.id] || 0,
    }));
  }, [filtered]);

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
  const todayCount = responses.filter((r) => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const handleExport = () => {
    const headers = ["Дата", "Ресторан", "Источник"];
    const rows = filtered.map((r) => [
      new Date(r.created_at).toLocaleString("ru-RU"),
      restaurants.find((rest) => rest.id === r.restaurant_id)?.name || "",
      sourceLabel(r.source),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sweep-ref-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateRestaurant = async () => {
    if (!newRestName.trim()) return;
    setSavingRest(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "create_restaurant", name: newRestName.trim() }),
      });
      setNewRestName("");
      toast({ title: "Ресторан создан" });
      fetchData();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSavingRest(false);
  };

  const handleRenameRestaurant = async (id: number) => {
    if (!editName.trim()) return;
    setSavingRest(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "rename_restaurant", restaurant_id: id, name: editName.trim() }),
      });
      setEditingId(null);
      toast({ title: "Название обновлено" });
      fetchData();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSavingRest(false);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return;
    setSavingPw(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "change_password", old_password: oldPassword, new_password: newPassword }),
      });
      setOldPassword("");
      setNewPassword("");
      toast({ title: "Пароль изменён" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Неверный старый пароль";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    }
    setSavingPw(false);
  };

  const logout = () => {
    localStorage.removeItem("sweep_token");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader2" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 to-white">
      <header className="border-b border-border/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Sweep" className="h-7" />
            <span className="text-sm font-medium text-muted-foreground">REF</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <Icon name="Monitor" size={16} />
              <span className="ml-1.5 hidden sm:inline">Хостес</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <Icon name="LogOut" size={16} />
              <span className="ml-1.5 hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">
              <Icon name="BarChart3" size={14} className="mr-1.5" />
              Статистика
            </TabsTrigger>
            <TabsTrigger value="responses">
              <Icon name="List" size={14} className="mr-1.5" />
              Ответы
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Icon name="Settings" size={14} className="mr-1.5" />
              Настройки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
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
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <Icon name="RefreshCw" size={14} />
                  <span className="ml-1.5">Обновить</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
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
          </TabsContent>

          <TabsContent value="responses">
            <div className="flex flex-wrap items-center gap-3 mb-4">
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
              <span className="text-sm text-muted-foreground ml-auto">
                {filtered.length} записей
              </span>
            </div>
            <Card className="border-border/60">
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Ресторан</TableHead>
                        <TableHead>Источник</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                            Нет данных
                          </TableCell>
                        </TableRow>
                      ) : (
                        [...filtered].reverse().map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm">
                              {new Date(r.created_at).toLocaleString("ru-RU")}
                            </TableCell>
                            <TableCell className="text-sm">
                              {restaurants.find((rest) => rest.id === r.restaurant_id)?.name}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {sourceLabel(r.source)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Icon name="Store" size={18} className="text-primary" />
                  Рестораны
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {restaurants.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      {editingId === r.id ? (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 bg-white"
                            onKeyDown={(e) => e.key === "Enter" && handleRenameRestaurant(r.id)}
                          />
                          <Button size="sm" onClick={() => handleRenameRestaurant(r.id)} disabled={savingRest}>
                            <Icon name="Check" size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <Icon name="X" size={14} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Icon name="Utensils" size={16} className="text-muted-foreground" />
                          <span className="flex-1 font-medium text-sm">{r.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingId(r.id); setEditName(r.name); }}
                          >
                            <Icon name="Pencil" size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    placeholder="Название нового ресторана"
                    value={newRestName}
                    onChange={(e) => setNewRestName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateRestaurant()}
                  />
                  <Button onClick={handleCreateRestaurant} disabled={savingRest || !newRestName.trim()}>
                    <Icon name="Plus" size={16} className="mr-1.5" />
                    Добавить
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Icon name="Lock" size={18} className="text-primary" />
                  Смена пароля
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-sm space-y-3">
                  <Input
                    type="password"
                    placeholder="Текущий пароль"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                  <Input
                    type="password"
                    placeholder="Новый пароль (мин. 4 символа)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button
                    onClick={handleChangePassword}
                    disabled={savingPw || !oldPassword || newPassword.length < 4}
                  >
                    {savingPw ? (
                      <Icon name="Loader2" size={16} className="animate-spin mr-1.5" />
                    ) : (
                      <Icon name="Save" size={16} className="mr-1.5" />
                    )}
                    Сохранить
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPage;