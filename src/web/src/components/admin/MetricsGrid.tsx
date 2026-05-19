interface MetricsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
}

export function MetricsGrid({ children, columns = 4 }: MetricsGridProps) {
  const colsClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
  }[columns];

  return <div className={`grid gap-4 mb-6 ${colsClass}`}>{children}</div>;
}
