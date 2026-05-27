import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchoolsList } from "@/report/hooks/use-platform-data";
import { Label } from "@/components/ui/label";

export function PlatformSchoolFilter({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (schoolId: string) => void;
  className?: string;
}) {
  const { data: schools, isLoading } = useSchoolsList();

  return (
    <div className={className}>
      <Label className="sr-only">Filter by school</Label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="All schools" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All schools</SelectItem>
          {(schools ?? []).map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
