import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Save } from "lucide-react";

const Attendance = () => {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Attendance</h2>
            <p className="text-muted-foreground">Mark and manage student attendance</p>
          </div>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            Save Attendance
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>Mark attendance for your classes</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Attendance marking interface</p>
              <p className="text-sm text-muted-foreground">Select a class to begin marking attendance</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
