export default function AdminEmptyState({
  title = 'Няма резултати',
  description = '',
  className = '',
}) {
  return (
    <div className={`border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center ${className}`.trim()}>
      <p className="text-sm font-display font-bold uppercase tracking-wider text-gray-700">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-2xl text-sm font-sans text-gray-500">{description}</p>
      ) : null}
    </div>
  );
}
