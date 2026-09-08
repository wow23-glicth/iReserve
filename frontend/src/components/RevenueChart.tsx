import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);
export default function RevenueChart({ points }: { points: { label: string; amount: number }[] }) {
  return <Line role="img" aria-label={'Revenue by day: ' + points.map(p => `${p.label}, ${p.amount} pesos`).join('; ')} data={{
    labels: points.map(p => p.label),
    datasets: [{ label: 'Revenue (₱)', data: points.map(p => p.amount), borderColor: '#27815b', borderWidth: 2.5,
      pointBackgroundColor: '#27815b', pointBorderColor: '#fbfcf7', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
      backgroundColor: 'rgba(94, 177, 126, 0.12)', fill: true, tension: 0.32 }]
  }} options={{
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#153d2d', padding: 12, cornerRadius: 8 } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#627166', font: { size: 11 }, maxRotation: 0 } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: '#e8ede4' }, ticks: { color: '#627166', count: 5, padding: 10, callback: value => '₱' + Number(value).toLocaleString() } }
    }
  }} />;
}
