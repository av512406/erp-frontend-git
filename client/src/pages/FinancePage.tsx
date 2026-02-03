import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinanceOverview } from "@/components/finance/FinanceOverview";
import { ExpenseList } from "@/components/finance/ExpenseList";
import { PayrollList } from "@/components/finance/PayrollList";
import { StaffManagement } from "@/components/finance/StaffManagement";
import { Card, CardContent } from "@/components/ui/card";

interface FinancePageProps {
    selectedSessionId: string;
}

export default function FinancePage({ selectedSessionId }: FinancePageProps) {
    return (
        <div className="container mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Finance Management</h1>
                <p className="text-muted-foreground">Manage expenses, staff, payroll, and view financial health.</p>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="h-auto flex-wrap justify-start w-full">
                    <TabsTrigger value="overview" className="flex-1 md:flex-none">Overview</TabsTrigger>
                    <TabsTrigger value="expenses" className="flex-1 md:flex-none">Expenses</TabsTrigger>
                    <TabsTrigger value="staff" className="flex-1 md:flex-none">Staff</TabsTrigger>
                    <TabsTrigger value="payroll" className="flex-1 md:flex-none">Payroll</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <FinanceOverview selectedSessionId={selectedSessionId} />
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <ExpenseList selectedSessionId={selectedSessionId} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="staff" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <StaffManagement selectedSessionId={selectedSessionId} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payroll" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <PayrollList selectedSessionId={selectedSessionId} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
