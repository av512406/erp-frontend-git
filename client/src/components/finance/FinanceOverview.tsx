import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { addDays, format, subDays } from "date-fns";

export function FinanceOverview() {
    const [date, setDate] = useState<Date>(new Date());

    const { data: stats, isLoading } = useQuery({
        queryKey: ['finance-stats', format(date, 'yyyy-MM-dd')],
        queryFn: async () => {
            const res = await apiRequest('GET', `/api/finance/stats?date=${format(date, 'yyyy-MM-dd')}`);
            return res.json();
        }
    });

    if (isLoading) return <div>Loading stats...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Daily Overview ({format(date, 'MMM dd, yyyy')})</h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDate(subDays(date, 1))}>Previous Day</Button>
                    <DatePicker date={date} setDate={(d: Date | undefined) => d && setDate(d)} />
                    <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, 1))}>Next Day</Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Collection</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats?.collection || 0)}</div>
                        <p className="text-xs text-muted-foreground">Fees collected today (active)</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Today's Expenses</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats?.totalExpenses || 0)}</div>
                        <p className="text-xs text-muted-foreground">Operational + Salaries paid today</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                        <Wallet className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${(stats?.netBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(stats?.netBalance || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">Collection - Expenses</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
