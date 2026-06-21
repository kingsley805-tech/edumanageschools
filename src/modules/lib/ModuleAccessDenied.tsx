export function ModuleAccessDenied({ label }: { label: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground">
      You do not have permission to access {label}.
    </div>
  );
}
