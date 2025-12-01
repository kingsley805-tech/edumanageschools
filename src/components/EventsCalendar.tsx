import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  date: string;
  type: "announcement" | "exam";
  description?: string;
}

export const EventsCalendar = () => {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [announcementsRes, examsRes] = await Promise.all([
        supabase
          .from("announcements")
          .select("id, title, created_at, body")
          .gte("created_at", today)
          .order("created_at", { ascending: true })
          .limit(5),
        supabase
          .from("exams")
          .select("id, title, exam_date, description")
          .gte("exam_date", today)
          .order("exam_date", { ascending: true })
          .limit(5)
      ]);

      const allEvents: Event[] = [
        ...(announcementsRes.data || []).map(a => ({
          id: a.id,
          title: a.title,
          date: a.created_at,
          type: "announcement" as const,
          description: a.body
        })),
        ...(examsRes.data || []).map(e => ({
          id: e.id,
          title: e.title,
          date: e.exam_date,
          type: "exam" as const,
          description: e.description
        }))
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setEvents(allEvents.slice(0, 5));
    };

    fetchEvents();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Events</CardTitle>
        <CardDescription>Announcements and exams</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="flex gap-3 pb-3 border-b last:border-0">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  event.type === "exam" ? "bg-warning/10" : "bg-primary/10"
                }`}>
                  {event.type === "exam" ? (
                    <FileText className="h-4 w-4 text-warning" />
                  ) : (
                    <Calendar className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.date), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
