import { Card, CardContent } from "@/components/ui/card";
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
import { sourceLabel, type Restaurant, type ResponseRecord, type SourceOption } from "@/lib/store";

interface ResponsesTabProps {
  restaurants: Restaurant[];
  filtered: ResponseRecord[];
  sources: SourceOption[];
  selectedRestaurant: string;
  setSelectedRestaurant: (v: string) => void;
  dateRange: string;
  setDateRange: (v: string) => void;
}

const ResponsesTab = ({
  restaurants,
  filtered,
  sources,
  selectedRestaurant,
  setSelectedRestaurant,
  dateRange,
  setDateRange,
}: ResponsesTabProps) => {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
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
        <Select value={dateRange} onValueChange={setDateRange}>
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
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} записей
        </span>
      </div>
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Ресторан</TableHead>
                  <TableHead>Источник</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      Нет данных
                    </TableCell>
                  </TableRow>
                ) : (
                  [...filtered].reverse().map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {new Date(r.created_at).toLocaleString("ru-RU")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {restaurants.find((rest) => rest.id === r.restaurant_id)?.name}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {sourceLabel(r.source, sources)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResponsesTab;
