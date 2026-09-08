import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
export default function StatCard({ label, value, detail, icon, tone = 'green', loading = false }: {
  label: string; value: ReactNode; detail: string; icon: ReactNode; tone?: 'green' | 'amber' | 'red'; loading?: boolean;
}) {
  return <div className={`stat-card stat-${tone}`}>
    <div className="stat-info"><p>{label}</p><h2>{loading ? <Loader2 size={23} className="animate-spin" aria-label="Loading" /> : value}</h2><span>{detail}</span></div>
    <div className="stat-icon-wrapper" aria-hidden="true">{icon}</div>
  </div>;
}
