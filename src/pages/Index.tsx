import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import { apiCall, type Restaurant } from "@/lib/store";

const LOGO_URL = "https://cdn.poehali.dev/projects/28c0c781-3d61-4cce-9755-515e9e1a816f/bucket/b439f2b5-53cb-429b-8e86-856855395be6.png";

const Index = () => {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("sweep-api", { method: "POST", body: JSON.stringify({ action: "get_restaurants" }) })
      .then((data) => {
        const list = data.restaurants || [];
        setRestaurants(list);
        if (list.length === 1 && list[0].slug) {
          navigate(`/r/${list[0].slug}`, { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <Icon name="Loader2" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8 animate-fade-in">
        <img src={LOGO_URL} alt="Sweep" className="h-8 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">REF</p>
        <p className="text-muted-foreground mt-2">Выберите ресторан</p>
      </div>
      <div className="w-full max-w-lg space-y-3 animate-fade-in">
        {restaurants.map((r) => (
          <Card
            key={r.id}
            className="group cursor-pointer border border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200"
            onClick={() => r.slug && navigate(`/r/${r.slug}`)}
          >
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/5 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <Icon name="Utensils" size={20} className="text-primary" />
              </div>
              <span className="text-[15px] font-medium text-foreground">{r.name}</span>
              <Icon name="ChevronRight" size={18} className="text-muted-foreground/40 ml-auto group-hover:text-primary transition-colors" />
            </div>
          </Card>
        ))}
      </div>
      <div className="text-center py-8">
        <a href="/admin" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          admin
        </a>
      </div>
    </div>
  );
};

export default Index;
