export default function UploadWatermarkToggle({
  checked,
  onChange,
  className = '',
}) {
  const classes = `inline-flex items-center gap-2 text-xs font-sans font-semibold text-gray-600 ${className}`.trim();

  return (
    <label className={classes}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-zn-purple"
      />
      <span>Watermark</span>
    </label>
  );
}

