import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BookMarked, ExternalLink, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchActivePrograms } from "@/modules/programs/lib/api";
import { isVideoUrl } from "@/modules/programs/lib/uploadProgramMedia";
import type { AcademicProgram } from "@/modules/programs/lib/types";

type PortalRole = "student" | "parent" | "teacher";

type Props = {
  portalRole: PortalRole;
};

export default function ProgramsPortalPanel({ portalRole }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [viewing, setViewing] = useState<AcademicProgram | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!profile?.school_id) {
        setPrograms([]);
        return;
      }
      setPrograms(await fetchActivePrograms(profile.school_id));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Unable to load programs");
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardLayout role={portalRole}>
      <div className="mingo-content space-y-6">
        <div>
          <h2 className="font-display text-[21px] font-semibold tracking-tight text-foreground">
            Academic programs
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Programs published by your school. Only enabled programs appear here.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading programs…
          </div>
        ) : programs.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <BookMarked className="h-10 w-10 opacity-40" />
              <p>No programs available yet.</p>
              <p className="text-xs">When the school enables a program, it will show here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {programs.map((program) => (
              <Card
                key={program.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer overflow-hidden border-border/70 shadow-sm transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setViewing(program)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setViewing(program);
                  }
                }}
              >
                <div className="relative aspect-[16/10] bg-muted">
                  {program.image_url ? (
                    <img
                      src={program.image_url}
                      alt={program.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <BookMarked className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                  {program.video_url ? (
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/95 px-2 py-1 text-[11px] font-medium shadow-sm">
                      <Video className="h-3 w-3" />
                      Video
                    </span>
                  ) : null}
                </div>
                <CardContent className="space-y-2 p-4">
                  <div>
                    <p className="truncate font-semibold leading-tight">{program.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {program.code}
                      {program.department ? ` · ${program.department}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {program.level ? <Badge variant="outline">{program.level}</Badge> : null}
                    {program.credits != null ? (
                      <Badge variant="secondary">{program.credits} credits</Badge>
                    ) : null}
                    {program.duration_years != null ? (
                      <Badge variant="secondary">{program.duration_years} yrs</Badge>
                    ) : null}
                  </div>
                  {program.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{program.description}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          {viewing ? (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.name}</SheetTitle>
                <SheetDescription>
                  {viewing.code}
                  {viewing.department ? ` · ${viewing.department}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 py-4 text-sm">
                <div className="overflow-hidden rounded-xl border bg-muted">
                  {viewing.image_url ? (
                    <img
                      src={viewing.image_url}
                      alt={viewing.name}
                      className="aspect-video w-full object-contain"
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center text-muted-foreground">
                      <BookMarked className="h-8 w-8 opacity-40" />
                    </div>
                  )}
                </div>

                {viewing.video_url ? (
                  <div className="overflow-hidden rounded-lg border bg-black">
                    {isVideoUrl(viewing.video_url) ? (
                      <video src={viewing.video_url} controls className="max-h-64 w-full" />
                    ) : (
                      <Button asChild variant="link" className="text-white">
                        <a href={viewing.video_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open video
                        </a>
                      </Button>
                    )}
                  </div>
                ) : null}

                {viewing.gallery_urls?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {viewing.gallery_urls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="h-20 w-20 rounded-md border object-cover"
                      />
                    ))}
                  </div>
                ) : null}

                <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Faculty</dt>
                    <dd className="font-medium">{viewing.faculty ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Coordinator</dt>
                    <dd className="font-medium">{viewing.coordinator_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Credits</dt>
                    <dd className="font-medium">{viewing.credits ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Duration</dt>
                    <dd className="font-medium">
                      {viewing.duration_years != null ? `${viewing.duration_years} years` : "—"}
                    </dd>
                  </div>
                </dl>

                {viewing.subjects?.length ? (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Subjects
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewing.subjects.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {viewing.description ? (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Description
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {viewing.description}
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
