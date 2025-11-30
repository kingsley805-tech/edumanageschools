import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

const Classes = () => {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Classes</h2>
          <p className="text-muted-foreground">View and manage your assigned classes</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Class List</CardTitle>
            <CardDescription>Your assigned classes and students</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Users className="h-16 w-16 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Your classes will appear here</p>
              <p className="text-sm text-muted-foreground">Contact admin to assign classes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Classes;
