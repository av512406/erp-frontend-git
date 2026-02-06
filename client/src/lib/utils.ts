import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Sort grades numerically/logically: Play, LKG, UKG, 1, 2, ... 10, 11, 12
export function sortGrades(grades: string[]) {
  const order: Record<string, number> = {
    'play': -3, 'playgroup': -3, 'pre-nursery': -3, 'nursery': -2.5,
    'lkg': -2, 'pp1': -2,
    'ukg': -1, 'pp2': -1,
  };

  return [...grades].sort((a, b) => {
    const normA = a.toLowerCase().trim().replace(/^class\s+/i, ''); // Strip "Class " if present in data
    const normB = b.toLowerCase().trim().replace(/^class\s+/i, '');

    const valA = order[normA] !== undefined ? order[normA] : parseInt(normA);
    const valB = order[normB] !== undefined ? order[normB] : parseInt(normB);

    // If both undefined/NaN (e.g. "A", "B" sections treated as grades?), revert to string sort
    if (isNaN(valA) && isNaN(valB)) return normA.localeCompare(normB, undefined, { numeric: true });
    if (isNaN(valA)) return 1; // Put non-numeric at end
    if (isNaN(valB)) return -1;

    return valA - valB;
  });
}

export function formatClass(grade: string, section?: string) {
  return section ? `${grade} - ${section}` : `${grade}`;
}
