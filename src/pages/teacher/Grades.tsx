import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";

const Grades = () => {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Grades</h2>
          <p className="text-muted-foreground">Manage student grades and assessments</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grade Management</CardTitle>
            <CardDescription>Enter and update student grades</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Award className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Grade entry interface</p>
              <p className="text-sm text-muted-foreground">Select a class and subject to enter grades</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Grades;
