import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { apiCall, type Restaurant, type SourceOption } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const LOGO_URL = "https://cdn.poehali.dev/projects/28c0c781-3d61-4cce-9755-515e9e1a816f/bucket/b439f2b5-53cb-429b-8e86-856855395be6.png";

const HostessPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [lastSource, setLastSource] = useState("");
  const [lastResponseId, setLastResponseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [undoTimer, setUndoTimer] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!slug) return;
    setInitialLoading(true);
    apiCall("sweep-api", { method: "POST", body: JSON.stringify({ action: "get_restaurant_by_slug", slug }) })
      .then((data) => {
        setRestaurant(data.restaurant);
        setSources(data.sources || []);
        const authed = sessionStorage.getItem(`sweep_auth_${data.restaurant.id}`);
        if (data.restaurant && !authed) {
          setNeedsAuth(true);
        }
        return apiCall("sweep-api", {
          method: "POST",
          body: JSON.stringify({ action: "get_today_count", restaurant_id: data.restaurant.id }),
        });
      })
      .then((data) => setTodayCount(data.today_count || 0))
      .catch(() => setNotFound(true))
      .finally(() => setInitialLoading(false));
  }, [slug]);

  useEffect(() => {
    if (undoTimer <= 0) return;
    const interval = setInterval(() => {
      setUndoTimer((t) => {
        if (t <= 1) {
          setSubmitted(false);
          setLastResponseId(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [undoTimer]);

  const handleAuth = async () => {
    if (!restaurant || !password) return;
    setAuthLoading(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "check_restaurant_password", restaurant_id: restaurant.id, password }),
      });
      sessionStorage.setItem(`sweep_auth_${restaurant.id}`, "1");
      setNeedsAuth(false);
    } catch {
      toast({ title: "Неверный пароль", variant: "destructive" });
    }
    setAuthLoading(false);
  };

  const handleSource = async (sourceKey: string) => {
    if (!restaurant || loading) return;
    setLoading(true);
    try {
      const data = await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "add_response", restaurant_id: restaurant.id, source: sourceKey }),
      });
      setLastResponseId(data.response_id);
      setLastSource(sources.find((s) => s.key === sourceKey)?.label || sourceKey);
      setTodayCount(data.today_count || todayCount + 1);
      setSubmitted(true);
      setUndoTimer(5);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить ответ", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleUndo = async () => {
    if (!restaurant || !lastResponseId) return;
    try {
      const data = await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "undo_response", response_id: lastResponseId, restaurant_id: restaurant.id }),
      });
      setTodayCount(data.today_count);
      setLastResponseId(null);
      setSubmitted(false);
      setUndoTimer(0);
      toast({ title: "Ответ отменён" });
    } catch {
      toast({ title: "Не удалось отменить", variant: "destructive" });
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <Icon name="Loader2" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
        <div className="text-center">
          <img src={LOGO_URL} alt="Sweep" className="h-8 mx-auto mb-4" />
          <p className="text-muted-foreground">Ресторан не найден</p>
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
        <div className="w-full max-w-sm text-center animate-scale-in">
          <img src={LOGO_URL} alt="Sweep" className="h-8 mx-auto mb-4" />
          <p className="text-lg font-medium mb-1">{restaurant?.name}</p>
          <p className="text-sm text-muted-foreground mb-6">Введите пароль для доступа</p>
          <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }} className="space-y-3">
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={authLoading || !password}>
              {authLoading ? <Icon name="Loader2" size={18} className="animate-spin" /> : "Войти"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
        <div className="text-center animate-scale-in">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="Check" size={40} className="text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Спасибо!</h2>
          <p className="text-muted-foreground mb-1">Ответ записан: <span className="font-medium text-foreground">{lastSource}</span></p>
          <p className="text-sm text-muted-foreground mb-6">
            Сегодня: <span className="font-bold text-primary">{todayCount}</span> ответов
          </p>
          {lastResponseId && undoTimer > 0 && (
            <Button variant="outline" size="sm" onClick={handleUndo} className="mb-3">
              <Icon name="Undo2" size={14} className="mr-1.5" />
              Отменить ({undoTimer}с)
            </Button>
          )}
          <p className="text-xs text-muted-foreground animate-pulse">Возврат через {undoTimer}с...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
        <div className="text-center mb-8 animate-fade-in">
          <img src={LOGO_URL} alt="Sweep" className="h-8 mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">{restaurant?.name}</p>
          <p className="text-muted-foreground mt-2 text-lg">Откуда вы о нас узнали?</p>
        </div>

        <div className="w-full space-y-3 animate-fade-in">
          {sources.map((source, i) => (
            <Card
              key={source.key}
              className="group cursor-pointer border border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => handleSource(source.key)}
            >
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <Icon name={source.icon} size={20} className="text-primary" />
                </div>
                <span className="text-[15px] font-medium text-foreground">{source.label}</span>
                <Icon name="ChevronRight" size={18} className="text-muted-foreground/40 ml-auto group-hover:text-primary transition-colors" />
              </div>
            </Card>
          ))}
        </div>

        {todayCount > 0 && (
          <div className="mt-6 text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-white/80 border border-border/40 rounded-full px-4 py-2 text-sm">
              <Icon name="BarChart3" size={14} className="text-primary" />
              <span className="text-muted-foreground">Сегодня:</span>
              <span className="font-bold text-primary">{todayCount}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HostessPage;
