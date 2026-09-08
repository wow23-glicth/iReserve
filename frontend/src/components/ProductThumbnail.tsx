import { useState } from 'react';
import { Package } from 'lucide-react';
export default function ProductThumbnail({url, name}: {url?: string | null; name: string}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className="product-thumbnail">{url && url !== failedUrl
    ? <img src={url} alt={`${name} product photo`} loading="lazy" onError={() => setFailedUrl(url)} />
    : <Package size={20} aria-label="No product photo" />}</span>;
}
