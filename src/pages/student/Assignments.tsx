import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

const Assignments = () => {
  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
          <p className="text-muted-foreground">View and submit your assignments</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Assignments</CardTitle>
            <CardDescription>Pending and completed assignments</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">No assignments yet</p>
              <p className="text-sm text-muted-foreground">New assignments will appear here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Assignments;
