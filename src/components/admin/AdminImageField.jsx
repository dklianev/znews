import { useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Search, Upload, X, RefreshCw } from 'lucide-react';
import { useData } from '../../context/DataContext';

export default function AdminImageField({
  label = 'Снимка',
  value,
  onChange,
  placeholder = 'https://...',
  helperText = '',
  required = false,
  previewClassName = 'h-32',
  showManualInput = true,
}) {
  const { media, uploadMedia, refreshMedia } = useData();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const filteredMedia = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter((item) => (item.name || '').toLowerCase().includes(q));
  }, [media, query]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(file);
      if (uploaded?.url) onChange(uploaded.url);
      setPickerOpen(true);
    } catch (error) {
      alert(`Грешка при качване: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const labelCls = 'block text-[10px] font-sans font-bold uppercase tracking-wider text-gray-500 mb-1';
  const inputCls = 'w-full px-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple';

  return (
    <div>
      <label className={labelCls}>
        {label}
        {required ? ' *' : ''}
      </label>

      {showManualInput && (
        <input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
      )}

      <div className={`${showManualInput ? 'mt-2' : ''} flex flex-wrap items-center gap-2`}>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-sans font-semibold text-gray-600 hover:text-zn-purple hover:border-zn-purple/40 transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Media Library
        </button>

        <label className={`inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-xs font-sans font-semibold cursor-pointer hover:text-zn-purple hover:border-zn-purple/40 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Качване...' : 'Качи файл'}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
        </label>

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-200 text-xs font-sans font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Изчисти
          </button>
        )}
      </div>

      {helperText && (
        <p className="mt-1.5 text-xs font-sans text-gray-400">{helperText}</p>
      )}

      {value && (
        <div className={`mt-2 border border-gray-200 bg-gray-50 overflow-hidden ${previewClassName}`}>
          <img
            src={value}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
          <div className="bg-white max-w-5xl w-full max-h-[80vh] overflow-hidden border border-gray-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200">
              <h3 className="font-display text-lg font-black text-gray-900 uppercase tracking-wider">Media Library</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshMedia}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-xs font-sans text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Обнови
                </button>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-gray-200">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Търси по име на файл..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 text-sm font-sans text-gray-900 outline-none focus:border-zn-purple"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[58vh]">
              {filteredMedia.length === 0 ? (
                <div className="text-center py-14 border border-dashed border-gray-300 bg-gray-50">
                  <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-sans text-gray-400">Няма снимки в библиотеката</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredMedia.map((item) => {
                    const isSelected = value === item.url;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onChange(item.url);
                          setPickerOpen(false);
                        }}
                        className={`text-left border transition-colors overflow-hidden ${isSelected ? 'border-zn-purple ring-1 ring-zn-purple/30' : 'border-gray-200 hover:border-zn-purple/50'}`}
                      >
                        <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="px-2.5 py-2">
                          <p className="text-[11px] font-sans font-semibold text-gray-700 truncate" title={item.name}>
                            {item.name}
                          </p>
                          <p className="text-[10px] font-sans text-gray-400 mt-0.5">
                            {(item.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
