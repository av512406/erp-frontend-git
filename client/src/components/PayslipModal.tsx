import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, CheckCircle } from "lucide-react";
import type { FeeTransaction } from "./FeesPage";
import { useDocumentTemplate } from '@/hooks/useDocumentTemplate';
import { schoolConfig } from '@/lib/schoolConfig';

interface PayslipModalProps {
  transaction: FeeTransaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PayslipModal({ transaction, isOpen, onClose }: PayslipModalProps) {
  const { data: template } = useDocumentTemplate('payslip');

  const handlePrint = () => {
    if (!transaction) return;

    if (template) {
      const printWindow = window.open('', '', 'width=800,height=600');
      if (printWindow) {
        let html = template.content;
        // Basic replacements
        html = html.replace(/{{transactionId}}/g, transaction.transactionId);
        html = html.replace(/{{date}}/g, new Date(transaction.date).toLocaleDateString());
        html = html.replace(/{{studentName}}/g, transaction.studentName);
        html = html.replace(/{{amount}}/g, transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        html = html.replace(/{{schoolName}}/g, schoolConfig.name);
        html = html.replace(/{{schoolAddress}}/g, schoolConfig.addressLine);

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    } else {
      window.print();
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="print:hidden">
          <DialogTitle>Payment Payslip</DialogTitle>
        </DialogHeader>

        <div className="space-y-6" id="payslip-content">
          <div className="text-center border-b pb-4">
            <h1 className="text-2xl font-semibold">{schoolConfig.name}</h1>
            <p className="text-sm text-muted-foreground">Fee Payment Receipt</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Transaction ID</p>
              <p className="font-mono font-semibold">{transaction.transactionId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Date</p>
              <p className="font-semibold">{new Date(transaction.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Student Name</p>
              <p className="font-semibold">{transaction.studentName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="text-2xl font-bold text-primary">₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 bg-primary/10 text-primary p-4 rounded-lg">
            <CheckCircle className="w-6 h-6" />
            <span className="font-semibold text-lg">PAID</span>
          </div>

          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>This is a computer-generated receipt and does not require a signature.</p>
            <p>For any queries, please contact the school office.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint} className="gap-2" data-testid="button-print-payslip">
            <Printer className="w-4 h-4" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
