import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";

const Grades = () => {
  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Grades</h2>
          <p className="text-muted-foreground">View your academic performance</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Academic Performance</CardTitle>
            <CardDescription>Your grades by subject and term</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Award className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">No grades yet</p>
              <p className="text-sm text-muted-foreground">Your grades will appear once published</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Grades;
