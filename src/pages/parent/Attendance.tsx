import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const Attendance = () => {
  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Attendance</h2>
          <p className="text-muted-foreground">View your child's attendance records</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Overview</CardTitle>
            <CardDescription>Monthly attendance tracking</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Attendance data will appear here</p>
              <p className="text-sm text-muted-foreground">Check back once attendance has been recorded</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
