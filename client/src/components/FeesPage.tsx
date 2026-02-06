import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import PaymentEntryTab from "./fees/PaymentEntryTab";
import PendingFeesTab from "./fees/PendingFeesTab";
import type { Student, FeeTransaction } from '@/types';

interface FeesPageProps {
  students: Student[];
  transactions: FeeTransaction[];
  selectedSessionId: string;
  sessionName: string;
  userRole?: string;
}

export default function FeesPage({ students, transactions, selectedSessionId, sessionName, userRole = 'admin' }: FeesPageProps) {
  const { toast } = useToast();
  const [location] = useLocation();
  const [filterDate, setFilterDate] = useState<string | null>(null);

  const [smsEnabled, setSmsEnabled] = useState(false);
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/school-config', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          setSchoolName(data.name || "School");
          let features = data.features;
          if (typeof features === 'string') {
            try { features = JSON.parse(features); } catch { features = {}; }
          }
          setSmsEnabled(!!features?.sms);
        }
      } catch (e) { console.error(e); }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('filter') === 'today') {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setFilterDate(today);
    } else {
      setFilterDate(null);
    }
  }, [location]);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Fee Management</h1>
        <p className="text-muted-foreground">Record payments and view history.</p>
        {filterDate && (
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded mt-2 flex items-center justify-between">
            <span>Showing transactions for: <strong>{filterDate}</strong></span>
            <button
              onClick={() => {
                setFilterDate(null);
                window.history.replaceState(null, '', '/fees');
              }}
              className="text-sm underline hover:text-blue-900"
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      <Tabs defaultValue="entry" className="space-y-6">
        <TabsList>
          <TabsTrigger value="entry">Payment Entry</TabsTrigger>
          <TabsTrigger value="pending">Pending Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="entry">
          <PaymentEntryTab
            students={students}
            transactions={transactions}
            selectedSessionId={selectedSessionId}
            sessionName={sessionName}
            userRole={userRole}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
          />
        </TabsContent>

        <TabsContent value="pending">
          <PendingFeesTab
            students={students}
            transactions={transactions}
            schoolName={schoolName}
            smsEnabled={smsEnabled}
            sessionName={sessionName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
