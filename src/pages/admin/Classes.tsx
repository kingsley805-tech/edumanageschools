import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Users } from "lucide-react";

const Classes = () => {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Classes</h2>
            <p className="text-muted-foreground">Manage class sections and subjects</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Class
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Grade 10 - A", students: 32, teacher: "Dr. Sarah Williams" },
            { name: "Grade 10 - B", students: 28, teacher: "Prof. John Smith" },
            { name: "Grade 9 - A", students: 30, teacher: "Ms. Emily Davis" },
          ].map((classItem) => (
            <Card key={classItem.name} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>{classItem.name}</CardTitle>
                <CardDescription>Class Teacher: {classItem.teacher}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{classItem.students} Students</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Classes;
