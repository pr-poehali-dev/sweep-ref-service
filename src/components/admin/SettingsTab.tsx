import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Icon from "@/components/ui/icon";
import { apiCall, type Restaurant, type SourceOption, type AppSettings } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface SettingsTabProps {
  restaurants: Restaurant[];
  sources: SourceOption[];
  settings: AppSettings;
  onDataChanged: () => void;
}

const SettingsTab = ({ restaurants, sources, settings, onDataChanged }: SettingsTabProps) => {
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

  const [deleteRestId, setDeleteRestId] = useState<number | null>(null);
  const [deleteSourceId, setDeleteSourceId] = useState<number | null>(null);

  const [tgChatId, setTgChatId] = useState(settings.telegram_chat_id);
  const [tgNotifications, setTgNotifications] = useState(settings.telegram_notifications_enabled);
  const [savingTg, setSavingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [sendingSummary, setSendingSummary] = useState<string | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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

  const handleDeleteRestaurant = async () => {
    if (!deleteRestId) return;
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "delete_restaurant", restaurant_id: deleteRestId }),
      });
      toast({ title: "Ресторан удалён" });
      onDataChanged();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setDeleteRestId(null);
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

  const handleDeleteSource = async () => {
    if (!deleteSourceId) return;
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "delete_source", source_id: deleteSourceId }),
      });
      toast({ title: "Вариант удалён" });
      onDataChanged();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setDeleteSourceId(null);
  };

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); dragOverItem.current = index; };
  const handleDrop = async () => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return;
    const reordered = [...sources];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);
    dragItem.current = null;
    dragOverItem.current = null;
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "reorder_sources", order: reordered.map((s) => s.id) }),
      });
      onDataChanged();
    } catch {
      toast({ title: "Ошибка сортировки", variant: "destructive" });
    }
  };

  const handleSaveTelegram = async () => {
    setSavingTg(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({
          action: "save_settings",
          telegram_chat_id: tgChatId.trim(),
          telegram_notifications_enabled: tgNotifications,
        }),
      });
      toast({ title: "Настройки Telegram сохранены" });
      onDataChanged();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSavingTg(false);
  };

  const handleTestTelegram = async () => {
    if (!tgChatId.trim()) {
      toast({ title: "Введите Chat ID", variant: "destructive" });
      return;
    }
    setTestingTg(true);
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "test_telegram", chat_id: tgChatId.trim() }),
      });
      toast({ title: "Тестовое сообщение отправлено" });
    } catch {
      toast({ title: "Ошибка отправки", description: "Проверьте Chat ID и что бот добавлен в чат", variant: "destructive" });
    }
    setTestingTg(false);
  };

  const handleSendSummary = async (period: "today" | "all") => {
    if (!tgChatId.trim()) {
      toast({ title: "Введите Chat ID", variant: "destructive" });
      return;
    }
    setSendingSummary(period);
    try {
      const data = await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "get_summary", period }),
      });
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "send_summary_telegram", chat_id: tgChatId.trim(), text: data.text }),
      });
      toast({ title: "Сводка отправлена в Telegram" });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setSendingSummary(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  };

  const currentHost = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <Card className="border-border/60 border-blue-200/60 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Icon name="Send" size={18} className="text-[#0088cc]" />
            Telegram-уведомления
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Chat ID</Label>
            <div className="flex gap-2">
              <Input
                placeholder="-1001234567890"
                value={tgChatId}
                onChange={(e) => setTgChatId(e.target.value)}
                className="flex-1 bg-white"
              />
              <Button variant="outline" size="sm" onClick={handleTestTelegram} disabled={testingTg || !tgChatId.trim()}>
                {testingTg ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Send" size={14} />}
                <span className="ml-1.5">Тест</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Добавьте бота @sweepref_bot в группу — он пришлёт Chat ID в приветственном сообщении
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-border/40">
            <div>
              <p className="text-sm font-medium">Уведомления о новых ответах</p>
              <p className="text-xs text-muted-foreground">Бот будет присылать сообщение при каждом новом ответе</p>
            </div>
            <Switch
              checked={tgNotifications}
              onCheckedChange={setTgNotifications}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveTelegram} disabled={savingTg} size="sm">
              {savingTg ? <Icon name="Loader2" size={14} className="animate-spin mr-1.5" /> : <Icon name="Save" size={14} className="mr-1.5" />}
              Сохранить
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => handleSendSummary("today")}
              disabled={sendingSummary !== null || !tgChatId.trim()}
            >
              {sendingSummary === "today" ? <Icon name="Loader2" size={14} className="animate-spin mr-1.5" /> : <Icon name="BarChart3" size={14} className="mr-1.5" />}
              Сводка за день
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => handleSendSummary("all")}
              disabled={sendingSummary !== null || !tgChatId.trim()}
            >
              {sendingSummary === "all" ? <Icon name="Loader2" size={14} className="animate-spin mr-1.5" /> : <Icon name="TrendingUp" size={14} className="mr-1.5" />}
              За всё время
            </Button>
          </div>
        </CardContent>
      </Card>

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
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 bg-white"
                      onKeyDown={(e) => e.key === "Enter" && handleRenameRestaurant(r.id)} />
                    <Button size="sm" onClick={() => handleRenameRestaurant(r.id)} disabled={savingRest}><Icon name="Check" size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><Icon name="X" size={14} /></Button>
                  </>
                ) : (
                  <>
                    <Icon name="Utensils" size={16} className="text-muted-foreground" />
                    <span className="flex-1 font-medium text-sm">{r.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(r.id); setEditName(r.name); }}><Icon name="Pencil" size={14} /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteRestId(r.id)}><Icon name="Trash2" size={14} /></Button>
                  </>
                )}
              </div>
              {r.slug && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => copyToClipboard(`${currentHost}/r/${r.slug}`)}>
                  <Icon name="Link" size={12} />
                  <code className="bg-white px-2 py-1 rounded border text-xs">{currentHost}/r/{r.slug}</code>
                  <Icon name="Copy" size={12} className="opacity-50" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleResetPassword(r.id)}>
                  <Icon name="KeyRound" size={14} className="mr-1.5" />Сгенерировать пароль
                </Button>
                {generatedPasswords[r.id] && (
                  <Badge variant="secondary" className="font-mono text-sm cursor-pointer hover:bg-secondary/80"
                    onClick={() => copyToClipboard(generatedPasswords[r.id])}>
                    {generatedPasswords[r.id]}<Icon name="Copy" size={10} className="ml-1.5 opacity-50" />
                  </Badge>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2 border-t">
            <Input placeholder="Название нового ресторана" value={newRestName} onChange={(e) => setNewRestName(e.target.value)}
              className="flex-1" onKeyDown={(e) => e.key === "Enter" && handleCreateRestaurant()} />
            <Button onClick={handleCreateRestaurant} disabled={savingRest || !newRestName.trim()}>
              <Icon name="Plus" size={16} className="mr-1.5" />Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Icon name="ListChecks" size={18} className="text-primary" />
            Варианты ответов
            <span className="text-xs text-muted-foreground font-normal ml-auto">
              <Icon name="GripVertical" size={12} className="inline mr-1" />Перетащите для сортировки
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sources.map((s, index) => (
            <div key={s.id} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={handleDrop}
              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 cursor-grab active:cursor-grabbing hover:bg-muted/80 transition-colors">
              <Icon name="GripVertical" size={16} className="text-muted-foreground/50 flex-shrink-0" />
              <div className="w-8 h-8 rounded bg-primary/5 flex items-center justify-center flex-shrink-0">
                <Icon name={s.icon} size={16} className="text-primary" />
              </div>
              {editingSourceId === s.id ? (
                <Input value={editSourceLabel} onChange={(e) => setEditSourceLabel(e.target.value)}
                  className="flex-1 h-8 bg-white text-sm" autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateSource(s.id, { label: editSourceLabel });
                    if (e.key === "Escape") setEditingSourceId(null);
                  }} />
              ) : (
                <span className="flex-1 text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                  onClick={() => { setEditingSourceId(s.id); setEditSourceLabel(s.label); }}>{s.label}</span>
              )}
              <code className="text-[10px] text-muted-foreground/60 bg-white px-1.5 py-0.5 rounded border hidden sm:block">{s.key}</code>
              <Switch checked={s.active} onCheckedChange={(checked) => handleUpdateSource(s.id, { active: checked })} disabled={savingSource} />
              {editingSourceId === s.id ? (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleUpdateSource(s.id, { label: editSourceLabel })}><Icon name="Check" size={12} /></Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingSourceId(null)}><Icon name="X" size={12} /></Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteSourceId(s.id)}>
                  <Icon name="Trash2" size={12} />
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-3 border-t">
            <Input placeholder="Ключ (англ.)" value={newSourceKey} onChange={(e) => setNewSourceKey(e.target.value)} className="w-[140px]" />
            <Input placeholder="Название" value={newSourceLabel} onChange={(e) => setNewSourceLabel(e.target.value)}
              className="flex-1" onKeyDown={(e) => e.key === "Enter" && handleCreateSource()} />
            <Button onClick={handleCreateSource} disabled={savingSource || !newSourceKey.trim() || !newSourceLabel.trim()}>
              <Icon name="Plus" size={16} className="mr-1.5" />Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Icon name="Shield" size={18} className="text-primary" />Пароль администратора
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Input type="password" placeholder="Старый пароль" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-[200px]" />
            <Input type="password" placeholder="Новый пароль" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-[200px]" onKeyDown={(e) => e.key === "Enter" && handleChangeAdminPassword()} />
            <Button onClick={handleChangeAdminPassword} disabled={savingPw || !oldPassword || !newPassword}>Изменить</Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteRestId !== null} onOpenChange={(open) => !open && setDeleteRestId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить ресторан?</AlertDialogTitle>
            <AlertDialogDescription>
              Ресторан «{restaurants.find((r) => r.id === deleteRestId)?.name}» и все его ответы будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRestaurant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteSourceId !== null} onOpenChange={(open) => !open && setDeleteSourceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить вариант ответа?</AlertDialogTitle>
            <AlertDialogDescription>
              Вариант «{sources.find((s) => s.id === deleteSourceId)?.label}» будет удалён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSource} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsTab;
