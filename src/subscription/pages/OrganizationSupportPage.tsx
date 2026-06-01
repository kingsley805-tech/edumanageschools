// @ts-nocheck
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";

export default function OrganizationSupportPage() {
  return (
    <DashboardLayout role="admin" hideSidebar>
      <div className="mx-auto max-w-lg space-y-6 p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/subscription">
            <ArrowLeft className="mr-1 h-4 w-4" /> Subscription
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-muted-foreground">
            Need help with billing or activating your organization?
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact us
            </CardTitle>
            <CardDescription>
              Our team can help with subscription plans, payments, and account access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" asChild>
              <Link to="/contact">
                <MessageCircle className="mr-2 h-4 w-4" />
                Open contact page
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Include your school name and the email used to register when contacting support.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
