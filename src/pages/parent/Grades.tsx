import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";

const Grades = () => {
  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Grades & Report Cards</h2>
          <p className="text-muted-foreground">View your child's academic performance</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Academic Performance</CardTitle>
            <CardDescription>Grades by subject and term</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Award className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Grade data will appear here</p>
              <p className="text-sm text-muted-foreground">Check back once grades have been published</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Grades;
