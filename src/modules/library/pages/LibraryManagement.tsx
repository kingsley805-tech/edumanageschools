import { useCallback, useEffect, useState } from "react";
import { Eye, Library, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import { useModuleAccess } from "@/modules/lib/useModuleAccess";
import { ModuleAccessDenied } from "@/modules/lib/ModuleAccessDenied";
import { ExportMenu } from "@/modules/lib/ExportMenu";
import { isMissingTableError, operationsSchemaSetupMessage } from "@/modules/lib/missingSchema";
import { OperationsSchemaSetupCard } from "@/modules/lib/OperationsSchemaSetupCard";
import { toast } from "sonner";

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  copies_total: number;
  copies_available: number;
  shelf_location: string | null;
};

export default function LibraryManagementPage() {
  const { currentSchool } = useSchoolInfo();
  const schoolId = currentSchool?.id ?? null;
  const access = useModuleAccess("library_management");
  const [rows, setRows] = useState<BookRow[]>([]);
  const [open, setOpen] = useState(false);
  const [viewBook, setViewBook] = useState<BookRow | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [category, setCategory] = useState("");
  const [copies, setCopies] = useState("1");
  const [shelf, setShelf] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);

  const handleDbError = (error: { code?: string; message?: string; status?: number }) => {
    if (isMissingTableError(error)) {
      setSchemaMissing(true);
      toast.error(operationsSchemaSetupMessage());
      return true;
    }
    toast.error(error.message ?? "Request failed");
    return false;
  };

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("library_books")
      .select("*")
      .eq("school_id", schoolId)
      .order("title");

    if (error) {
      handleDbError(error);
      return;
    }
    setSchemaMissing(false);
    setRows((data ?? []) as BookRow[]);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!schoolId || !title.trim()) {
      toast.error("Title is required.");
      return;
    }
    const total = Math.max(1, Number(copies) || 1);
    const { error } = await supabase.from("library_books").insert({
      school_id: schoolId,
      title: title.trim(),
      author: author.trim() || null,
      isbn: isbn.trim() || null,
      category: category.trim() || null,
      copies_total: total,
      copies_available: total,
      shelf_location: shelf.trim() || null,
    });
    if (error) {
      handleDbError(error);
      return;
    }
    toast.success("Book added");
    setOpen(false);
    setTitle("");
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("library_books").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  };

  if (!access.canView) return <ModuleAccessDenied label="Library Management" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Library className="h-6 w-6" />
            Library Management
          </h1>
          <p className="text-sm text-muted-foreground">Catalog books and track available copies.</p>
        </div>
        <div className="flex gap-2">
          {access.canExport ? (
            <ExportMenu
              filename="library-books"
              title="Library Books"
              headers={["Title", "Author", "ISBN", "Category", "Copies", "Available", "Shelf"]}
              rows={rows.map((r) => [
                r.title,
                r.author,
                r.isbn,
                r.category,
                r.copies_total,
                r.copies_available,
                r.shelf_location,
              ])}
            />
          ) : null}
          {access.canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add book
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add library book</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Author</Label>
                    <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>ISBN</Label>
                      <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Copies</Label>
                      <Input type="number" min={1} value={copies} onChange={(e) => setCopies(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Shelf</Label>
                      <Input value={shelf} onChange={(e) => setShelf(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={() => void create()}>Save book</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      {schemaMissing ? (
        <OperationsSchemaSetupCard moduleLabel="Library" quickScript="apply-library-tables.sql" />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Book catalog</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>ISBN</TableHead>
                <TableHead>Copies</TableHead>
                <TableHead>Shelf</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.author ?? "—"}</TableCell>
                  <TableCell>{r.isbn ?? "—"}</TableCell>
                  <TableCell>
                    {r.copies_available}/{r.copies_total}
                  </TableCell>
                  <TableCell>{r.shelf_location ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewBook(r)} title="View book details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {access.canDelete ? (
                        <Button variant="ghost" size="icon" onClick={() => void remove(r.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewBook} onOpenChange={(v) => !v && setViewBook(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-6">
              <span>{viewBook?.title}</span>
              <span className="text-xs font-semibold text-primary">
                {viewBook ? `${viewBook.copies_available}/${viewBook.copies_total} Available` : null}
              </span>
            </DialogTitle>
          </DialogHeader>
          {viewBook ? (
            <dl className="grid gap-2.5 text-sm sm:grid-cols-2 py-2">
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Author</dt>
                <dd className="font-medium mt-0.5">{viewBook.author ?? "—"}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Category</dt>
                <dd className="font-medium mt-0.5">{viewBook.category ?? "—"}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">ISBN</dt>
                <dd className="font-mono text-xs mt-0.5">{viewBook.isbn ?? "—"}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Shelf Location</dt>
                <dd className="font-medium mt-0.5">{viewBook.shelf_location ?? "—"}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Total Copies</dt>
                <dd className="font-medium mt-0.5">{viewBook.copies_total}</dd>
              </div>
              <div className="rounded-md border bg-muted/20 p-2">
                <dt className="text-xs text-muted-foreground">Available Copies</dt>
                <dd className="font-medium mt-0.5">{viewBook.copies_available}</dd>
              </div>
            </dl>
          ) : null}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setViewBook(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
