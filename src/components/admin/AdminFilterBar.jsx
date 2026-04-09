export default function AdminFilterBar({ children, className = '' }) {
  return (
    <div className={`mb-5 flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {children}
    </div>
  );
}
