/** Display order and labels for platform module categories */
export const PLATFORM_MODULE_CATEGORIES: { key: string; label: string }[] = [
  { key: "academic", label: "Academic Modules" },
  { key: "financial", label: "Financial Modules" },
  { key: "communication", label: "Communication Modules" },
  { key: "hr", label: "HR Modules" },
  { key: "library", label: "Library Modules" },
  { key: "transport", label: "Transport Modules" },
  { key: "hostel", label: "Hostel Modules" },
  { key: "inventory", label: "Inventory Modules" },
  { key: "learning", label: "Learning Modules" },
];

export function categoryLabel(key: string): string {
  return PLATFORM_MODULE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}
