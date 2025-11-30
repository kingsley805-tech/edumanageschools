import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen } from "lucide-react";

const Assignments = () => {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
            <p className="text-muted-foreground">Create and manage assignments</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Assignment
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Assignments</CardTitle>
            <CardDescription>View and manage all your assignments</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">No assignments yet</p>
              <p className="text-sm text-muted-foreground">Create your first assignment to get started</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Assignments;
