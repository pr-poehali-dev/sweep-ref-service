import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import { SOURCES, apiCall, type Restaurant, type ResponseRecord } from "@/lib/store";
import DashboardTab from "@/components/admin/DashboardTab";
import ResponsesTab from "@/components/admin/ResponsesTab";
import SettingsTab from "@/components/admin/SettingsTab";

const LOGO_URL = "https://cdn.poehali.dev/projects/28c0c781-3d61-4cce-9755-515e9e1a816f/bucket/b439f2b5-53cb-429b-8e86-856855395be6.png";

const sourceLabel = (id: string) =>
  SOURCES.find((s) => s.id === id)?.label || id;

const AdminPage = () => {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [loading, setLoading] = useState(true);

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
            <DashboardTab
              restaurants={restaurants}
              filtered={filtered}
              responses={responses}
              selectedRestaurant={selectedRestaurant}
              setSelectedRestaurant={setSelectedRestaurant}
              dateRange={dateRange}
              setDateRange={setDateRange}
              onRefresh={fetchData}
              onExport={handleExport}
            />
          </TabsContent>

          <TabsContent value="responses">
            <ResponsesTab
              restaurants={restaurants}
              filtered={filtered}
              selectedRestaurant={selectedRestaurant}
              setSelectedRestaurant={setSelectedRestaurant}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SettingsTab
              restaurants={restaurants}
              onDataChanged={fetchData}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPage;
