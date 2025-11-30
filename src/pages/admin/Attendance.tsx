import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const Attendance = () => {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Attendance Reports</h2>
          <p className="text-muted-foreground">View and analyze attendance data</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Overview</CardTitle>
            <CardDescription>School-wide attendance statistics</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Attendance reports will appear here</p>
              <p className="text-sm text-muted-foreground">Data will be available once attendance is recorded</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
