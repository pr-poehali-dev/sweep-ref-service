import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import { apiCall } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "login", username, password }),
      });
      localStorage.setItem("sweep_token", data.token);
      navigate("/admin");
    } catch {
      toast({ title: "Ошибка входа", description: "Неверный логин или пароль", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <Card className="w-full max-w-sm animate-scale-in border-border/60">
        <CardHeader className="text-center pb-2">
          <img src="https://cdn.poehali.dev/projects/28c0c781-3d61-4cce-9755-515e9e1a816f/bucket/b439f2b5-53cb-429b-8e86-856855395be6.png" alt="Sweep" className="h-7 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Вход в админ-панель</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                placeholder="Логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !username || !password}>
              {loading ? <Icon name="Loader2" size={18} className="animate-spin" /> : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;