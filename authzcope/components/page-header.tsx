export function PageHeader({ title }: { title: string }) {
  return (
    <header>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
    </header>
  );
}
