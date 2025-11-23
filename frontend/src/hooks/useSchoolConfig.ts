import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { schoolConfig as currentConfig, setSchoolConfig, SchoolConfig, defaultSchoolConfig } from '@/lib/schoolConfig';
import { useEffect } from 'react';

const QUERY_KEY = ['api','admin','config'];

export function useSchoolConfig() {
  const qc = useQueryClient();
  const query = useQuery<SchoolConfig>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/admin/config', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load config');
      return await res.json();
    }
  });

  // Sync global singleton when data changes
  useEffect(() => {
    if (query.data) setSchoolConfig(query.data);
  }, [query.data]);

  // Client-side hydration fallback: if initial load had default phone (SSR/no localStorage) attempt localStorage restore after mount
  useEffect(() => {
    if (!query.data) {
      try {
        const raw = localStorage.getItem('schoolConfig');
        if (raw) {
          const cached = JSON.parse(raw);
          // Only apply if cached phone looks different from current singleton
          if (cached.phone && cached.phone !== currentConfig.phone) {
            setSchoolConfig(cached);
          }
        }
      } catch { /* ignore */ }
    }
  }, []);

  const mutation = useMutation({
    mutationFn: async (payload: Partial<SchoolConfig & { logoFile?: File | null }>) => {
      let logoUrl = payload.logoUrl;
      if (payload.logoFile) {
        logoUrl = await fileToOptimizedDataUrl(payload.logoFile);
      }
      const body = {
        name: payload.name ?? currentConfig.name,
        addressLine: payload.addressLine ?? currentConfig.addressLine,
        phone: payload.phone ?? currentConfig.phone,
        session: payload.session ?? currentConfig.session,
        logoUrl: logoUrl ?? currentConfig.logoUrl
      };
      const res = await apiRequest('POST','/api/admin/config', body);
      return await res.json();
    },
    onSuccess(data) {
      setSchoolConfig(data);
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    }
  });

  return {
    config: query.data ?? currentConfig ?? defaultSchoolConfig,
    isLoading: query.isLoading,
    error: query.error,
    updateConfig: mutation.mutateAsync,
    isSaving: mutation.isPending
  };
}

async function fileToOptimizedDataUrl(file: File): Promise<string> {
  // If already small (<220KB) just convert directly (base64 expansion ~1.33x stays <300KB decoded)
  if (file.size < 220 * 1024) {
    return readFileAsDataURL(file);
  }
  // Downscale using canvas for PNG/JPEG to reduce size; target max width/height 500px
  const img = await readFileAsImage(file);
  const canvas = document.createElement('canvas');
  const maxSide = 500;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return readFileAsDataURL(file);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Export as JPEG (quality 0.8) unless original is SVG
  const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');
  if (isSvg) return readFileAsDataURL(file); // don't rasterize SVG
  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  // Iteratively reduce quality if still too big decoded
  for (let i = 0; i < 5; i++) {
    const rawBytes = estimateBase64DecodedBytes(dataUrl);
    if (rawBytes <= 300 * 1024) break;
    quality -= 0.15;
    if (quality <= 0.4) break;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

function estimateBase64DecodedBytes(dataUrl: string) {
  const m = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!m) return 0;
  const b64 = m[1];
  const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  return (b64.length * 3) / 4 - padding;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    readFileAsDataURL(file).then(url => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = url;
    }).catch(reject);
  });
}

export default useSchoolConfig;