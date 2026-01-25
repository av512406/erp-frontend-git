import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinanceOverview } from "@/components/finance/FinanceOverview";
import { ExpenseList } from "@/components/finance/ExpenseList";
import { PayrollList } from "@/components/finance/PayrollList";
import { Card, CardContent } from "@/components/ui/card";

export default function FinancePage() {
    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Finance Management</h1>
                <p className="text-muted-foreground">Manage expenses, payroll, and view financial health.</p>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="expenses">Expenses</TabsTrigger>
                    <TabsTrigger value="payroll">Payroll</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <FinanceOverview />
                </TabsContent>

                <TabsContent value="expenses" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <ExpenseList />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payroll" className="space-y-4">
                    <Card>
                        <CardContent className="pt-6">
                            <PayrollList />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
