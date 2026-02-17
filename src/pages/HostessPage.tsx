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
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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
      })
      .catch(() => setNotFound(true))
      .finally(() => setInitialLoading(false));
  }, [slug]);

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
    if (!restaurant) return;
    setLoading(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "add_response", restaurant_id: restaurant.id, source: sourceKey }),
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить ответ", variant: "destructive" });
    }
    setLoading(false);
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
          <p className="text-muted-foreground">Ответ записан</p>
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
              className="group cursor-pointer border border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => !loading && handleSource(source.key)}
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
      </div>
    </div>
  );
};

export default HostessPage;
