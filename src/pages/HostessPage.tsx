import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import { SOURCES, apiCall, type Restaurant } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const HostessPage = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    apiCall("sweep-api", { method: "POST", body: JSON.stringify({ action: "get_restaurants" }) })
      .then((data) => {
        setRestaurants(data.restaurants || []);
        if (data.restaurants?.length === 1) {
          setSelectedRestaurant(data.restaurants[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleSource = async (sourceId: string) => {
    if (!selectedRestaurant) return;
    setLoading(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({
          action: "add_response",
          restaurant_id: selectedRestaurant,
          source: sourceId,
        }),
      });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось сохранить ответ", variant: "destructive" });
    }
    setLoading(false);
  };

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
          <img src="https://cdn.poehali.dev/projects/28c0c781-3d61-4cce-9755-515e9e1a816f/bucket/b439f2b5-53cb-429b-8e86-856855395be6.png" alt="Sweep" className="h-8 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">REF</p>
          {restaurants.length > 1 && (
            <div className="mt-4 flex gap-2 flex-wrap justify-center">
              {restaurants.map((r) => (
                <Button
                  key={r.id}
                  variant={selectedRestaurant === r.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedRestaurant(r.id)}
                >
                  {r.name}
                </Button>
              ))}
            </div>
          )}
          {selectedRestaurant && (
            <p className="text-muted-foreground mt-3 text-lg">
              Откуда вы о нас узнали?
            </p>
          )}
        </div>

        {selectedRestaurant && (
          <div className="w-full space-y-3 animate-fade-in">
            {SOURCES.map((source, i) => (
              <Card
                key={source.id}
                className="group cursor-pointer border border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => !loading && handleSource(source.id)}
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
        )}
      </div>

      <div className="text-center py-4">
        <a href="/admin" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          admin
        </a>
      </div>
    </div>
  );
};

export default HostessPage;