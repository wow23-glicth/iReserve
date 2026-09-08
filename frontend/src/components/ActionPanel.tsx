import { ChevronDown, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
export default function ActionPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <details className="action-panel glass-panel">
    <summary><span className="action-panel-intro"><strong>{title}</strong><span>{description}</span></span><span className="action-panel-toggle"><Plus size={17} /><span>{title}</span><ChevronDown size={16} className="disclosure-chevron" /></span></summary>
    <div className="action-panel-body">{children}</div>
  </details>;
}
