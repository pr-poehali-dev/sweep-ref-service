import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import { apiCall, type Restaurant } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface SettingsTabProps {
  restaurants: Restaurant[];
  onDataChanged: () => void;
}

const SettingsTab = ({ restaurants, onDataChanged }: SettingsTabProps) => {
  const { toast } = useToast();
  const [newRestName, setNewRestName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingRest, setSavingRest] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

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
      onDataChanged();
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
      onDataChanged();
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

  return (
    <div className="space-y-6">
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
    </div>
  );
};

export default SettingsTab;
