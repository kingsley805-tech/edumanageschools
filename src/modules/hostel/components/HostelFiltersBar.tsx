import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export type HostelFilters = {
  search: string;
  hostelId: string;
  paymentStatus: string;
  occupancyStatus: string;
  className: string;
};

type Props = {
  filters: HostelFilters;
  onChange: (next: HostelFilters) => void;
  hostels: { id: string; name: string }[];
  classes: string[];
  showPayment?: boolean;
  showOccupancy?: boolean;
};

export function HostelFiltersBar({
  filters,
  onChange,
  hostels,
  classes,
  showPayment,
  showOccupancy,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name, admission, room…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      <Select value={filters.hostelId || "all"} onValueChange={(v) => onChange({ ...filters, hostelId: v === "all" ? "" : v })}>
        <SelectTrigger className="w-full lg:w-[180px]">
          <SelectValue placeholder="Hostel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All hostels</SelectItem>
          {hostels.map((h) => (
            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {classes.length > 0 ? (
        <Select value={filters.className || "all"} onValueChange={(v) => onChange({ ...filters, className: v === "all" ? "" : v })}>
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {showPayment ? (
        <Select value={filters.paymentStatus || "all"} onValueChange={(v) => onChange({ ...filters, paymentStatus: v === "all" ? "" : v })}>
          <SelectTrigger className="w-full lg:w-[150px]">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {showOccupancy ? (
        <Select value={filters.occupancyStatus || "all"} onValueChange={(v) => onChange({ ...filters, occupancyStatus: v === "all" ? "" : v })}>
          <SelectTrigger className="w-full lg:w-[160px]">
            <SelectValue placeholder="Occupancy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rooms</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="full">Full</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
