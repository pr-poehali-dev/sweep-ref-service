import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import Icon from "@/components/ui/icon";
import { apiCall, type Restaurant, type SourceOption } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface SettingsTabProps {
  restaurants: Restaurant[];
  sources: SourceOption[];
  onDataChanged: () => void;
}

const SettingsTab = ({ restaurants, sources, onDataChanged }: SettingsTabProps) => {
  const { toast } = useToast();
  const [newRestName, setNewRestName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [savingRest, setSavingRest] = useState(false);
  const [generatedPasswords, setGeneratedPasswords] = useState<Record<number, string>>({});
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [editSourceLabel, setEditSourceLabel] = useState("");
  const [newSourceKey, setNewSourceKey] = useState("");
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [savingSource, setSavingSource] = useState(false);

  const handleCreateRestaurant = async () => {
    if (!newRestName.trim()) return;
    setSavingRest(true);
    try {
      const data = await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "create_restaurant", name: newRestName.trim() }),
      });
      setNewRestName("");
      setGeneratedPasswords((prev) => ({ ...prev, [data.id]: data.password }));
      toast({ title: "Ресторан создан", description: `Пароль: ${data.password}` });
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

  const handleResetPassword = async (id: number) => {
    try {
      const data = await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "reset_restaurant_password", restaurant_id: id }),
      });
      setGeneratedPasswords((prev) => ({ ...prev, [id]: data.password }));
      toast({ title: "Новый пароль сгенерирован" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const handleChangeAdminPassword = async () => {
    if (!oldPassword || !newPassword) return;
    setSavingPw(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "change_password", old_password: oldPassword, new_password: newPassword }),
      });
      setOldPassword("");
      setNewPassword("");
      toast({ title: "Пароль админа изменён" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Неверный старый пароль";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    }
    setSavingPw(false);
  };

  const handleUpdateSource = async (id: number, updates: Partial<{ label: string; active: boolean }>) => {
    setSavingSource(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "update_source", source_id: id, ...updates }),
      });
      if (updates.label) setEditingSourceId(null);
      onDataChanged();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSavingSource(false);
  };

  const handleCreateSource = async () => {
    if (!newSourceKey.trim() || !newSourceLabel.trim()) return;
    setSavingSource(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "create_source", key: newSourceKey.trim(), label: newSourceLabel.trim() }),
      });
      setNewSourceKey("");
      setNewSourceLabel("");
      toast({ title: "Вариант добавлен" });
      onDataChanged();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSavingSource(false);
  };

  const currentHost = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Icon name="Store" size={18} className="text-primary" />
            Рестораны
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {restaurants.map((r) => (
            <div key={r.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center gap-2">
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
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(r.id); setEditName(r.name); }}>
                      <Icon name="Pencil" size={14} />
                    </Button>
                  </>
                )}
              </div>

              {r.slug && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="Link" size={12} />
                  <code className="bg-white px-2 py-1 rounded border text-xs select-all">
                    {currentHost}/r/{r.slug}
                  </code>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleResetPassword(r.id)}>
                  <Icon name="KeyRound" size={14} className="mr-1.5" />
                  Сгенерировать пароль
                </Button>
                {generatedPasswords[r.id] && (
                  <Badge variant="secondary" className="font-mono text-sm select-all">
                    {generatedPasswords[r.id]}
                  </Badge>
                )}
              </div>
            </div>
          ))}

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
            <Icon name="ListChecks" size={18} className="text-primary" />
            Варианты ответов
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {editingSourceId === s.id ? (
                <>
                  <Input
                    value={editSourceLabel}
                    onChange={(e) => setEditSourceLabel(e.target.value)}
                    className="flex-1 bg-white"
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateSource(s.id, { label: editSourceLabel })}
                  />
                  <Button size="sm" onClick={() => handleUpdateSource(s.id, { label: editSourceLabel })} disabled={savingSource}>
                    <Icon name="Check" size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSourceId(null)}>
                    <Icon name="X" size={14} />
                  </Button>
                </>
              ) : (
                <>
                  <Icon name={s.icon} size={16} className="text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium">{s.label}</span>
                  <code className="text-xs text-muted-foreground">{s.key}</code>
                  <Switch
                    checked={s.active}
                    onCheckedChange={(active) => handleUpdateSource(s.id, { active })}
                  />
                  <Button size="sm" variant="ghost" onClick={() => { setEditingSourceId(s.id); setEditSourceLabel(s.label); }}>
                    <Icon name="Pencil" size={14} />
                  </Button>
                </>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Ключ (eng)"
              value={newSourceKey}
              onChange={(e) => setNewSourceKey(e.target.value)}
              className="w-32"
            />
            <Input
              placeholder="Название варианта"
              value={newSourceLabel}
              onChange={(e) => setNewSourceLabel(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleCreateSource()}
            />
            <Button onClick={handleCreateSource} disabled={savingSource || !newSourceKey.trim() || !newSourceLabel.trim()}>
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
            Пароль админ-панели
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
              onClick={handleChangeAdminPassword}
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
