import React from 'react';
import { schoolConfig } from '@/lib/schoolConfig';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { amountToIndianWords } from '@/lib/amountWords';
import { createRoot } from 'react-dom/client';

export interface ReceiptItem {
	label: string;
	amount: number; // 0 if not applied
}

export interface ReceiptProps {
	student: {
		name: string;
		fatherName?: string;
		grade?: string;
		section?: string;
		admissionNumber?: string;
	};
	items: ReceiptItem[]; // expects rows in desired order except total
	paymentDate: string; // YYYY-MM-DD
	serial?: number; // if not provided will auto-generate
	session?: string; // override session
	// Optional fee summary details
	yearlyFeeAmount?: number; // total annual fee for student
	paidSoFar?: number; // cumulative paid INCLUDING current transaction
	remainingFee?: number; // if not supplied, computed from yearlyFeeAmount - paidSoFar
}

// Ensure defined order / fallback labels
const DEFAULT_ORDER = [
	'Admission Fee',
	'Teaching Fee',
	'Exam. Fee',
	'Computer Fee',
	'Development',
	'Other Fee/Late Fee'
];

export const Receipt: React.FC<ReceiptProps> = ({ student, items, paymentDate, serial, session, yearlyFeeAmount, paidSoFar, remainingFee }) => {
	// Load dynamic config (will fallback to defaults until fetched)
	useSchoolConfig();
	const displaySerial = serial != null ? String(serial).padStart(4,'0') : '----';
	// Normalize item list into ordered rows
	const map: Record<string, number> = {};
	items.forEach(i => { map[i.label] = i.amount; });
	const ordered = DEFAULT_ORDER.map(label => ({ label, amount: map[label] ?? 0 }));
	const total = ordered.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
	const amountWords = amountToIndianWords(total);
	const cls = [student.grade ? `Class ${student.grade}` : '', student.section ? `Section ${student.section}` : ''].filter(Boolean).join(' ');
	const sessionValue = session || schoolConfig.session;

	// Two copies (Student & Office) share same data; differentiate by copy label.
	const copies = ['Student Copy', 'Office Copy'];
	const showSummary = typeof yearlyFeeAmount === 'number' && typeof paidSoFar === 'number';
	const computedRemaining = showSummary ? (typeof remainingFee === 'number' ? remainingFee : (yearlyFeeAmount! - paidSoFar!)) : undefined;

	return (
		<div className="print-receipt font-serif">
			{copies.map(copy => (
				<div key={copy} className="receipt border border-black p-3 mb-4 break-inside-avoid">
					<div className="text-center mb-2">
						{/* Compact centered header: logo + school name side-by-side to save vertical space */}
						<div className="flex items-center justify-center gap-4 mb-1 min-h-[56px]">
							{schoolConfig.logoUrl && (
								<img src={schoolConfig.logoUrl} alt="School Logo" className="h-14 object-contain" />
							)}
							<h1 className="text-2xl font-bold tracking-wide">{schoolConfig.name}</h1>
						</div>
						<p className="text-xs italic">{schoolConfig.addressLine}</p>
						{/* Merge Fee Receipt and copy label to save vertical space */}
						<div className="inline-flex items-center gap-2 border px-2 py-0.5 text-sm font-semibold mt-1">
							<span>Fee Receipt</span>
							<span className="text-[11px] font-normal">({copy})</span>
						</div>
					</div>
					<div className="text-[11px] leading-4 space-y-0.5 mb-2">
						<div className="flex justify-between"><span>Serial No.: <strong>{displaySerial}</strong></span><span>Date: {paymentDate}</span></div>
						<div>Name of the Student: <strong>{student.name}</strong></div>
						{student.fatherName && <div>Father's Name: <strong>{student.fatherName}</strong></div>}
						<div className="flex justify-between"><span>Class: <strong>{cls || '—'}</strong></span><span>Session: <strong>{sessionValue}</strong></span></div>
						{student.admissionNumber && <div>Admission No.: <strong>{student.admissionNumber}</strong></div>}
					</div>
					<table className="w-full text-[11px] border border-black border-collapse mb-2">
						<thead>
							<tr className="bg-gray-100">
								<th className="border border-black w-10 py-1">S.No.</th>
								<th className="border border-black py-1">Particulars</th>
								<th className="border border-black w-24 py-1">Amount (₹)</th>
							</tr>
						</thead>
						<tbody>
							{ordered.map((row, idx) => (
								<tr key={row.label}>
									<td className="border border-black text-center align-top py-1">{idx + 1}.</td>
									<td className="border border-black px-2 py-1">{row.label}</td>
									<td className="border border-black text-right pr-2 py-1">{row.amount ? row.amount.toFixed(2) : ''}</td>
								</tr>
							))}
							<tr className="font-semibold">
								<td className="border border-black text-center py-1">{ordered.length + 1}.</td>
								<td className="border border-black px-2 py-1">Total Amount</td>
								<td className="border border-black text-right pr-2 py-1">{total.toFixed(2)}</td>
							</tr>
						</tbody>
					</table>
					<div className="text-[10px] mb-2">Amount In Words: <em>{amountWords}</em></div>
					{showSummary && (
						<div className="text-[10px] mb-3 border border-black px-2 py-1 leading-tight">
							<span className="font-semibold">Yearly:</span> ₹{yearlyFeeAmount!.toFixed(2)}
							<span className="mx-1">•</span>
							<span className="font-semibold">Total Paid:</span> ₹{paidSoFar!.toFixed(2)}
							<span className="mx-1">•</span>
							<span className="font-semibold">Remaining:</span> <span className={computedRemaining! <= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>₹{computedRemaining! >= 0 ? computedRemaining!.toFixed(2) : `${Math.abs(computedRemaining!).toFixed(2)} (Over)`}</span>
						</div>
					)}
					<div className="flex justify-end mt-8">
						<div className="text-center text-[11px]">
							<div className="h-10" />
							<div className="border-t border-black pt-1">Signature</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
};

// Print helper: opens a new window with receipt HTML and triggers print.
export function printReceipt(props: ReceiptProps & { copies?: number }) {
	// Use iframe approach (most reliable: avoids popup blockers & styling race)
	const iframe = document.createElement('iframe');
	iframe.style.position = 'fixed';
	iframe.style.right = '0';
	iframe.style.bottom = '0';
	iframe.style.width = '0';
	iframe.style.height = '0';
	iframe.style.border = '0';
	iframe.setAttribute('aria-hidden', 'true');
	document.body.appendChild(iframe);

	const doc = iframe.contentDocument || iframe.contentWindow?.document;
	if (!doc) {
		console.warn('Iframe print document unavailable, fallback inline');
		printReceiptInline(props);
		return;
	}

	// Build a single physical page that already contains both sub-copies (Student & Office)
	const plain = buildPlainHtml({ ...props });
	// Treat props.copies as number of physical pages to duplicate (rarely needed). Default 1.
	const physicalPages = props.copies && props.copies > 0 ? props.copies : 1;
	const repeated = Array.from({ length: physicalPages }).map(() => plain).join('<div style="page-break-after:always"></div>');
	// Use static title for receipt print window
	const html = `<!DOCTYPE html><html><head><title>Receipt</title><style>
@page { size: A4 portrait; margin: 8mm; }
html, body { height: auto; margin: 0; }
.layout { padding: 0; }
/* Target approx half-page per receipt to keep two on one sheet */
.receipt { page-break-inside: avoid; box-sizing: border-box; margin: 0 0 4mm 0; padding: 4mm; height: 134mm; overflow: hidden; }
table { width:100%; border-collapse:collapse; }
th,td { border:1px solid #000; padding:3px; }
thead th { background:#f3f3f3; }
img { max-height:50px; }
.summary-box { font-size:10px; border:1px solid #000; padding:3px 6px; margin:4px 0 6px; }
</style></head><body><div class="layout">${repeated}</div></body></html>`;

	doc.open();
	doc.write(html);
	doc.close();

	const ensureImagesLoaded = () => {
		const imgs = Array.from(doc.querySelectorAll('img')) as HTMLImageElement[];
		if (imgs.length === 0) return Promise.resolve();
		return Promise.all(imgs.map(img => img.complete ? Promise.resolve(null) : new Promise(res => { img.onload = img.onerror = () => res(null); })));
	};

	ensureImagesLoaded().then(() => {
		iframe.contentWindow?.focus();
		iframe.contentWindow?.print();
		// Cleanup after a delay to allow print dialog
		setTimeout(() => {
			iframe.parentNode?.removeChild(iframe);
		}, 2000);
	});
}

// Build a minimal plain HTML version (no Tailwind dependency) for fallback printing.
function buildPlainHtml(props: ReceiptProps): string {
	const serial = props.serial != null ? String(props.serial).padStart(4,'0') : '----';
	const sessionValue = props.session || schoolConfig.session;
	const map: Record<string, number> = {};
	props.items.forEach(i => { map[i.label] = i.amount; });
	const ordered = DEFAULT_ORDER.map(label => ({ label, amount: map[label] ?? 0 }));
	const total = ordered.reduce((s, r) => s + r.amount, 0);
	const words = amountToIndianWords(total);
	const cls = [props.student.grade ? `Class ${props.student.grade}` : '', props.student.section ? `Section ${props.student.section}` : ''].filter(Boolean).join(' ');
	const copies = ['Student Copy','Office Copy'];
	const showSummary = typeof props.yearlyFeeAmount === 'number' && typeof props.paidSoFar === 'number';
	const remaining = showSummary ? (typeof props.remainingFee === 'number' ? props.remainingFee : (props.yearlyFeeAmount! - props.paidSoFar!)) : undefined;
	const rowsHtml = (copy: string) => `
	<div style="border:1px solid #000;margin:0 0 4mm 0;font-size:10px;font-family:serif;box-sizing:border-box;padding:4mm;height:134mm;overflow:hidden;">
		<div style="text-align:center;margin-bottom:6px;">
			<div style="display:flex;align-items:center;justify-content:center;gap:12px;min-height:54px;margin-bottom:2px;">
				${schoolConfig.logoUrl ? `<img src="${schoolConfig.logoUrl}" alt="Logo" style="height:50px;object-fit:contain;"/>` : ''}
				<div style="font-size:19px;font-weight:700;letter-spacing:.5px;">${schoolConfig.name}</div>
			</div>
			<div style="font-size:10px;font-style:italic;">${schoolConfig.addressLine}</div>
			<div style="display:inline-flex;align-items:center;gap:6px;border:1px solid #000;padding:2px 6px;font-size:12px;font-weight:600;margin-top:4px;">Fee Receipt <span style="font-size:10px;font-weight:400;">(${copy})</span></div>
		</div>
		<div style="line-height:1.3;margin-bottom:6px;">
			<div style="display:flex;justify-content:space-between;"><span>Serial No.: <strong>${serial}</strong></span><span>Date: ${props.paymentDate}</span></div>
			<div>Name of the Student: <strong>${props.student.name}</strong></div>
			${props.student.fatherName ? `<div>Father's Name: <strong>${props.student.fatherName}</strong></div>` : ''}
			<div style="display:flex;justify-content:space-between;"><span>Class: <strong>${cls || '—'}</strong></span><span>Session: <strong>${sessionValue}</strong></span></div>
			${props.student.admissionNumber ? `<div>Admission No.: <strong>${props.student.admissionNumber}</strong></div>` : ''}
		</div>
		<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px;">
			<thead>
				<tr>
					<th style="border:1px solid #000;width:32px;padding:4px;">S.No.</th>
					<th style="border:1px solid #000;padding:4px;">Particulars</th>
					<th style="border:1px solid #000;width:90px;padding:4px;">Amount (₹)</th>
				</tr>
			</thead>
			<tbody>
				${ordered.map((r,i)=>`<tr><td style="border:1px solid #000;text-align:center;padding:4px;">${i+1}.</td><td style="border:1px solid #000;padding:4px;">${r.label}</td><td style="border:1px solid #000;text-align:right;padding:4px;">${r.amount? r.amount.toFixed(2): ''}</td></tr>`).join('')}
				<tr style="font-weight:600;"><td style="border:1px solid #000;text-align:center;padding:4px;">${ordered.length+1}.</td><td style="border:1px solid #000;padding:4px;">Total Amount</td><td style="border:1px solid #000;text-align:right;padding:4px;">${total.toFixed(2)}</td></tr>
			</tbody>
		</table>
		<div style="font-size:10px;margin-bottom:4px;">Amount In Words: <em>${words}</em></div>
		${showSummary ? `<div style="font-size:10px;border:1px solid #000;padding:3px 6px;margin-bottom:8px;">
			<strong>Yearly:</strong> ₹${props.yearlyFeeAmount!.toFixed(2)} • <strong>Total Paid:</strong> ₹${props.paidSoFar!.toFixed(2)} • <strong>Remaining:</strong> <span style="color:${remaining! <= 0 ? '#0a7a0a' : '#b10000'};">₹${remaining! >= 0 ? remaining!.toFixed(2) : `${Math.abs(remaining!).toFixed(2)} (Over)`}</span>
		</div>` : ''}
		<div style="text-align:right;font-size:11px;margin-top:20px;">
			<div style="height:40px;"></div>
			<div style="border-top:1px solid #000;padding-top:4px;display:inline-block;">Signature</div>
		</div>
	</div>`;
	return copies.map(rowsHtml).join('');
}

// Inline print alternative: inject hidden container into current document and print.
export function printReceiptInline(props: ReceiptProps & { copies?: number }) {
	const id = 'inline-print-receipt-container';
	let host = document.getElementById(id);
	if (!host) {
		host = document.createElement('div');
		host.id = id;
		host.style.position = 'fixed';
		host.style.left = '-9999px'; // hide off-screen
		host.style.top = '0';
		host.style.width = '210mm';
		host.style.zIndex = '0';
		document.body.appendChild(host);
		// Add print styles once
		const style = document.createElement('style');
		style.textContent = `@page { size: A4 portrait; margin: 8mm; }\n#${id} .receipt { page-break-inside: avoid; }`;
		document.head.appendChild(style);
	}
	const physicalPages = props.copies && props.copies > 0 ? props.copies : 1;
	const plain = buildPlainHtml(props);
	host.innerHTML = Array.from({ length: physicalPages }).map(()=> plain).join('');
	// Keep original document title unchanged (static receipt naming reverted)
	// Attempt React enhancement (optional)
	try {
		const reactWrapper = document.createElement('div');
		host.appendChild(reactWrapper);
		createRoot(reactWrapper).render(<Receipt {...props} />);
	} catch {}
	setTimeout(() => window.print(), 200); // slight delay for layout
}

export default Receipt;

