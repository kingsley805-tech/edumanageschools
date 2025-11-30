import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const Schedule = () => {
  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Schedule</h2>
          <p className="text-muted-foreground">View your class timetable</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
            <CardDescription>Your class schedule and timings</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Schedule not available</p>
              <p className="text-sm text-muted-foreground">Your timetable will appear once created</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Schedule;
