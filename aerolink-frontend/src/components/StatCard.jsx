export default function StatCard({ title, value, icon: Icon, colorClass = "text-blue-600", bgClass = "bg-blue-50" }) {
  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-6 flex items-center gap-4 transition-shadow hover:shadow-md">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bgClass} ${colorClass}`}>
        {Icon && <Icon className="h-6 w-6" />}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
    </div>
  );
}
