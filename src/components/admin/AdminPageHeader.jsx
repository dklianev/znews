export default function AdminPageHeader({
  title,
  description,
  icon: Icon = null,
  meta = null,
  actions = null,
  className = '',
}) {
  return (
    <div className={`mb-6 flex flex-wrap items-start justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-gray-900">
          {Icon ? <Icon className="h-6 w-6 text-zn-purple" aria-hidden="true" /> : null}
          <span>{title}</span>
        </h1>
        {description ? (
          <p className="mt-1 text-sm font-sans text-gray-500">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
