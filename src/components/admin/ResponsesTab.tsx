import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { apiCall, sourceLabel, type Restaurant, type ResponseRecord, type SourceOption } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface ResponsesTabProps {
  restaurants: Restaurant[];
  filtered: ResponseRecord[];
  sources: SourceOption[];
  selectedRestaurant: string;
  setSelectedRestaurant: (v: string) => void;
  dateRange: string;
  setDateRange: (v: string) => void;
  onDataChanged: () => void;
}

const PAGE_SIZE = 50;

const ResponsesTab = ({
  restaurants,
  filtered,
  sources,
  selectedRestaurant,
  setSelectedRestaurant,
  dateRange,
  setDateRange,
  onDataChanged,
}: ResponsesTabProps) => {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [clearMode, setClearMode] = useState(false);
  const [page, setPage] = useState(0);
  const [sourceFilter, setSourceFilter] = useState("all");

  const finalFiltered = sourceFilter === "all" ? filtered : filtered.filter((r) => r.source === sourceFilter);
  const sorted = [...finalFiltered].reverse();
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "delete_response", response_id: deleteId }),
      });
      toast({ title: "Запись удалена" });
      onDataChanged();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setDeleteId(null);
  };

  const handleClearAll = async () => {
    const rid = selectedRestaurant !== "all" ? Number(selectedRestaurant) : undefined;
    if (!rid) {
      toast({ title: "Выберите конкретный ресторан для очистки", variant: "destructive" });
      setClearMode(false);
      return;
    }
    try {
      const data = await apiCall("sweep-api", {
        method: "POST",
        body: JSON.stringify({ action: "clear_responses", restaurant_id: rid }),
      });
      toast({ title: `Удалено ${data.deleted} записей` });
      onDataChanged();
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setClearMode(false);
  };

  const activeSourceKeys = new Set(filtered.map((r) => r.source));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={selectedRestaurant} onValueChange={(v) => { setSelectedRestaurant(v); setPage(0); }}>
          <SelectTrigger className="w-[200px] bg-white">
            <SelectValue placeholder="Ресторан" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все рестораны</SelectItem>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всё время</SelectItem>
            <SelectItem value="today">Сегодня</SelectItem>
            <SelectItem value="week">7 дней</SelectItem>
            <SelectItem value="month">30 дней</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="Источник" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все источники</SelectItem>
            {sources.filter((s) => activeSourceKeys.has(s.key)).map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {finalFiltered.length} записей
          </span>
          {selectedRestaurant !== "all" && finalFiltered.length > 0 && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setClearMode(true)}>
              <Icon name="Trash2" size={14} className="mr-1.5" />
              Очистить
            </Button>
          )}
        </div>
      </div>
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Дата</TableHead>
                  <TableHead>Ресторан</TableHead>
                  <TableHead>Источник</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      Нет данных
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((r) => (
                    <TableRow key={r.id} className="group">
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {restaurants.find((rest) => rest.id === r.restaurant_id)?.name}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {sourceLabel(r.source, sources)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Icon name="X" size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <Icon name="ChevronLeft" size={14} className="mr-1" />
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} из {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Далее
                <Icon name="ChevronRight" size={14} className="ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>Эта запись будет удалена из статистики безвозвратно.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearMode} onOpenChange={(open) => !open && setClearMode(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Очистить все ответы?</AlertDialogTitle>
            <AlertDialogDescription>
              Все ответы ресторана «{restaurants.find((r) => r.id === Number(selectedRestaurant))?.name}» будут удалены безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить все
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ResponsesTab;
