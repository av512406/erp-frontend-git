import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { addDays, format, subDays } from "date-fns";

interface FinanceOverviewProps {
    selectedSessionId: string;
}

import { getAuthHeaders } from "@/lib/auth";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function FinanceOverview({ selectedSessionId }: FinanceOverviewProps) {
    const [date, setDate] = useState<Date>(new Date());

    const { data: stats, isLoading: isLoadingStats } = useQuery({
        queryKey: ['finance-stats', format(date, 'yyyy-MM-dd'), selectedSessionId],
        queryFn: async () => {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const res = await apiRequest('GET', `/api/finance/stats?date=${formattedDate}&sessionId=${selectedSessionId}`);
            return res.json();
        },
        enabled: !!selectedSessionId
    });

    const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
        queryKey: ['finance-transactions', format(date, 'yyyy-MM-dd'), selectedSessionId],
        queryFn: async () => {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const res = await apiRequest('GET', `/api/finance/transactions?date=${formattedDate}&sessionId=${selectedSessionId}`);
            return res.json();
        },
        enabled: !!selectedSessionId
    });

    const generatePDF = async (period: 'daily' | 'session') => {
        try {
            const params = new URLSearchParams({ sessionId: selectedSessionId });
            if (period === 'daily') {
                params.append('date', format(date, 'yyyy-MM-dd'));
            }

            const res = await fetch(`/api/finance/statement-data?${params.toString()}`, {
                headers: getAuthHeaders()
            });

            if (!res.ok) throw new Error('Failed to fetch statement data');
            const data = await res.json();

            const doc = new jsPDF();

            // Header
            doc.setFontSize(18);
            doc.text(data.school?.name || 'School Name', 14, 15);
            doc.setFontSize(10);
            doc.text(data.school?.address || '', 14, 20);
            doc.text(data.school?.phone || '', 14, 25);

            // Report Info
            doc.line(14, 28, 196, 28);
            doc.setFontSize(12);
            doc.text(data.reportTitle, 14, 35);
            doc.setFontSize(10);
            doc.text(`Period: ${data.reportPeriod}`, 14, 40);
            const genDate = new Date();
            doc.text(`Generated: ${genDate.toLocaleDateString()} ${genDate.toLocaleTimeString()}`, 196, 40, { align: 'right' });

            // Summary Box
            doc.setFillColor(248, 249, 250);
            doc.rect(14, 45, 182, 25, 'F');
            doc.setDrawColor(200);
            doc.rect(14, 45, 182, 25, 'S');

            doc.setFontSize(9);
            doc.text('TOTAL INCOME', 30, 52);
            doc.setFontSize(12);
            doc.setTextColor(16, 185, 129); // Green
            doc.text(`INR ${data.summary.totalIncome.toLocaleString('en-IN')}`, 30, 62);

            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text('TOTAL EXPENSE', 90, 52);
            doc.setFontSize(12);
            doc.setTextColor(239, 68, 68); // Red
            doc.text(`INR ${data.summary.totalExpense.toLocaleString('en-IN')}`, 90, 62);

            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text('NET BALANCE', 150, 52);
            doc.setFontSize(12);
            const net = data.summary.netBalance;
            doc.setTextColor(net >= 0 ? 16 : 239, net >= 0 ? 185 : 68, net >= 0 ? 129 : 68);
            doc.text(`INR ${net.toLocaleString('en-IN')}`, 150, 62);
            doc.setTextColor(0);

            // Table
            const rows = data.transactions.map((t: any) => [
                new Date(t.date).toLocaleDateString('en-IN'),
                `${t.description}\n${t.receiptSerial ? `Receipt #${t.receiptSerial}` : ''}${t.transactionId ? `Txn: ${t.transactionId}` : ''}`,
                t.paymentMode || '-',
                t.type === 'income' ? t.amount.toLocaleString('en-IN') : '-',
                t.type === 'expense' ? t.amount.toLocaleString('en-IN') : '-'
            ]);

            autoTable(doc, {
                startY: 80,
                head: [['Date', 'Description', 'Mode', 'Credit', 'Debit']],
                body: rows,
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                columnStyles: {
                    3: { halign: 'right', textColor: [16, 185, 129] },
                    4: { halign: 'right', textColor: [239, 68, 68] }
                },
                didParseCell: (data) => {
                    // Custom formatting if needed
                }
            });

            // Footer
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('Computer generated report', 105, 290, { align: 'center' });
            }

            doc.save(`${data.reportTitle.toLowerCase().replace(/ /g, '-')}-${period}.pdf`);

        } catch (e: any) {
            console.error(e);
            alert('Failed to generate statement');
        }
    };

    if (isLoadingStats) return <div>Loading stats...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Daily Overview ({format(date, 'MMM dd, yyyy')})</h2>
                <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={() => setDate(subDays(date, 1))}>Previous</Button>
                    <div className="mx-1">
                        <DatePicker date={date} setDate={(d: Date | undefined) => d && setDate(d)} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDate(addDays(date, 1))}>Next</Button>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 w-full md:w-auto">
                    <Button variant="default" size="sm" onClick={() => generatePDF('daily')} className="flex-1 md:flex-none">Today's Statement</Button>
                    <Button variant="secondary" size="sm" onClick={() => generatePDF('session')} className="flex-1 md:flex-none">Session Statement</Button>
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

            <Card>
                <CardHeader>
                    <CardTitle>Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingTransactions ? (
                        <div>Loading transactions...</div>
                    ) : transactions?.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">No transactions found for this date.</div>
                    ) : (
                        <div className="space-y-4">
                            {transactions?.map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-1">
                                        <p className="font-medium">{t.description}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {format(new Date(t.createdAt), 'h:mm a')} • {t.paymentMode}
                                            {t.receiptSerial && ` • Receipt #${t.receiptSerial}`}
                                        </p>
                                    </div>
                                    <div className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
