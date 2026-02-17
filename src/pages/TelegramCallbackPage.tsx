import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Icon from "@/components/ui/icon";
import { loadUrls } from "@/lib/store";

const TelegramCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setError("Токен не найден");
      return;
    }

    const exchange = async () => {
      try {
        const urls = await loadUrls();
        const authUrl = urls["telegram-auth"];
        if (!authUrl) throw new Error("Auth endpoint not found");

        const res = await fetch(`${authUrl}?action=callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка авторизации");

        localStorage.setItem("telegram_auth_refresh_token", data.refresh_token);
        localStorage.setItem("telegram_auth_access_token", data.access_token);
        localStorage.setItem("telegram_auth_user", JSON.stringify(data.user));

        setStatus("success");
        setTimeout(() => navigate("/admin"), 1500);
      } catch (e: unknown) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Неизвестная ошибка");
      }
    };

    exchange();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
      <div className="text-center animate-scale-in">
        {status === "loading" && (
          <>
            <Icon name="Loader2" size={40} className="animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Авторизация...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Check" size={32} className="text-green-600" />
            </div>
            <p className="font-medium text-foreground">Вход выполнен!</p>
            <p className="text-sm text-muted-foreground mt-1">Перенаправление...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="X" size={32} className="text-red-600" />
            </div>
            <p className="font-medium text-foreground">Ошибка авторизации</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default TelegramCallbackPage;
