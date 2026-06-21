import { useCallback, useEffect, useState } from "react";
import { Download, Library, Plus, Trash2 } from "lucide-react";
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
import { downloadCsv } from "@/modules/lib/exportCsv";
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
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [category, setCategory] = useState("");
  const [copies, setCopies] = useState("1");
  const [shelf, setShelf] = useState("");

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error } = await supabase
      .from("library_books")
      .select("*")
      .eq("school_id", schoolId)
      .order("title");

    if (error) {
      if (error.message.includes("library_books")) {
        toast.error("Run public/sql/apply-operations-modules.sql in Supabase first.");
      } else {
        toast.error(error.message);
      }
      return;
    }
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
      toast.error(error.message);
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                downloadCsv(
                  "library-books.csv",
                  ["Title", "Author", "ISBN", "Category", "Copies", "Available", "Shelf"],
                  rows.map((r) => [
                    r.title,
                    r.author,
                    r.isbn,
                    r.category,
                    r.copies_total,
                    r.copies_available,
                    r.shelf_location,
                  ]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
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
                    {access.canDelete ? (
                      <Button variant="ghost" size="icon" onClick={() => void remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
