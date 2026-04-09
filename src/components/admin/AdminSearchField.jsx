import { Search } from 'lucide-react';

export default function AdminSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = '',
  inputClassName = '',
}) {
  return (
    <div className={`relative min-w-[240px] flex-1 ${className}`.trim()}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className={`w-full border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm font-sans text-gray-700 outline-none transition-colors focus:border-zn-purple focus:ring-2 focus:ring-zn-purple/20 ${inputClassName}`.trim()}
      />
    </div>
  );
}
