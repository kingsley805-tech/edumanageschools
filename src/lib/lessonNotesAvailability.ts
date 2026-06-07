// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "school_hub_lesson_notes_available";

let cached: boolean | null = null;
let probe: Promise<boolean> | null = null;

function readSessionFlag(): boolean | null {
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return null;
}

function writeSessionFlag(ok: boolean) {
  try {
    if (ok) sessionStorage.setItem(SESSION_KEY, "1");
    else sessionStorage.setItem(SESSION_KEY, "0");
  } catch {
    /* ignore */
  }
}

export function isLessonNotesMissingError(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.status === 404 ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    msg.includes("lesson_notes") ||
    msg.includes("could not find the table") ||
    (msg.includes("does not exist") && msg.includes("lesson"))
  );
}

/** One lightweight probe per session; skips repeat 404s when migration is not applied. */
export async function isLessonNotesAvailable(): Promise<boolean> {
  if (cached !== null) return cached;

  const sessionCached = readSessionFlag();
  if (sessionCached !== null) {
    cached = sessionCached;
    return sessionCached;
  }

  if (!probe) {
    probe = (async () => {
      const { error } = await supabase.from("lesson_notes").select("id").limit(1);
      if (!error) {
        cached = true;
        writeSessionFlag(true);
        return true;
      }
      if (isLessonNotesMissingError(error as { code?: string; message?: string; status?: number })) {
        cached = false;
        writeSessionFlag(false);
        probe = null;
        return false;
      }
      cached = true;
      writeSessionFlag(true);
      return true;
    })();
  }

  return probe;
}
