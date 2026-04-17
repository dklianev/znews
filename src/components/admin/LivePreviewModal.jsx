import { X, Smartphone, Monitor } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useSettingsData, useTaxonomyData } from '../../context/DataContext';
import ComicNewsCard from '../ComicNewsCard';
import { getComicCardStyle } from '../../utils/comicCardDesign';

export default function LivePreviewModal({ form, onClose }) {
    const { authors, categories } = useTaxonomyData();
    const { siteSettings } = useSettingsData();
    const [viewMode, setViewMode] = useState('article');
    const [deviceMap, setDeviceMap] = useState('desktop');

    // Create a fake article object from the form
    const article = {
        ...form,
        id: form.id || 99999,
        date: form.date || new Date().toISOString().split('T')[0],
        views: 0,
        authorId: form.authorId,
        category: form.category,
    };

    const author = authors.find(a => a.id === article.authorId);
    const category = categories.find(c => c.id === article.category);

    // Faux article presentation
    const articlePresentation = useMemo(() => {
        return {
            html: article.content || '<p>Няма съдържание</p>',
            pullQuote: article.excerpt || ''
        };
    }, [article.content, article.excerpt]);

    return (
        <div className="fixed inset-0 z-[100] bg-zinc-900/95 backdrop-blur-sm flex flex-col items-center justify-start overflow-hidden">
            {/* HEADER */}
            <div className="w-full bg-white border-b border-gray-200 p-3 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-md">
                        <button onClick={() => setViewMode('article')} className={`px-4 py-1.5 text-sm font-sans font-semibold rounded ${viewMode === 'article' ? 'bg-white shadow text-zn-purple' : 'text-gray-500 hover:text-gray-700'}`}>Статия</button>
                        <button onClick={() => setViewMode('card')} className={`px-4 py-1.5 text-sm font-sans font-semibold rounded ${viewMode === 'card' ? 'bg-white shadow text-zn-purple' : 'text-gray-500 hover:text-gray-700'}`}>Като миниатюра</button>
                        <button onClick={() => setViewMode('social')} className={`px-4 py-1.5 text-sm font-sans font-semibold rounded ${viewMode === 'social' ? 'bg-white shadow text-zn-purple' : 'text-gray-500 hover:text-gray-700'}`}>Social Share</button>
                    </div>
                    <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block" />
                    <div className="hidden sm:flex items-center gap-1 text-gray-400">
                        <button onClick={() => setDeviceMap('mobile')} className={`p-1.5 rounded hover:bg-gray-100 ${deviceMap === 'mobile' ? 'text-zn-purple bg-purple-50' : ''}`} title="Мобилен изглед"><Smartphone className="w-4 h-4" /></button>
                        <button onClick={() => setDeviceMap('desktop')} className={`p-1.5 rounded hover:bg-gray-100 ${deviceMap === 'desktop' ? 'text-zn-purple bg-purple-50' : ''}`} title="Desktop изглед"><Monitor className="w-4 h-4" /></button>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors flex items-center gap-2 px-4 shadow-sm">
                    <span className="text-sm font-sans font-bold hidden sm:inline">ЗАТВОРИ ПРЕВЮТО</span>
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className={`flex-1 w-full overflow-y-auto pt-6 pb-20 transition-all duration-300 flex justify-center ${deviceMap === 'mobile' ? 'px-0' : 'px-4'}`}>
                <div className={`bg-white shadow-2xl relative transition-all duration-300 my-auto ${deviceMap === 'mobile' ? 'w-full max-w-[400px] min-h-[800px] border-x border-gray-200' : 'w-full max-w-6xl rounded-t-lg min-h-[80vh]'}`}>

                    {viewMode === 'article' && (
                        <div className="p-6 md:p-12">
                            {/* Category & badges */}
                            <div className="flex items-center gap-2 mb-4">
                                {article.breaking && (
                                    <span className="px-2 py-1 text-xs font-display font-black uppercase tracking-wider bg-red-600 text-white">Извънредно</span>
                                )}
                                {category && (
                                    <span className="px-3 py-1 text-xs font-display font-bold uppercase tracking-wide bg-zn-purple text-white">
                                        {category.name}
                                    </span>
                                )}
                            </div>
                            <h1 className="font-display text-4xl md:text-5xl font-black text-zn-text leading-tight mb-6 tracking-wider uppercase text-shadow-brutal">
                                {article.title || 'Въведете заглавие'}
                            </h1>

                            <div className="mb-8 comic-panel comic-dots relative p-2 bg-white flex justify-center border-4 border-[#1C1428] shadow-[4px_4px_0_#1c1428]">
                                {article.image ? (
                                    <img src={article.image} alt="Cover" className="w-full h-auto object-cover relative z-[2] border-2 border-[#1C1428]" />
                                ) : (
                                    <div className="w-full aspect-[16/9] bg-gray-200 flex items-center justify-center text-gray-400 font-sans font-bold text-sm relative z-[2] border-2 border-[#1C1428]">
                                        Няма избрана снимка
                                    </div>
                                )}
                            </div>

                            <p className="font-sans text-xl md:text-2xl text-zinc-600 leading-relaxed mb-8 font-medium italic border-l-4 border-zn-hot pl-4">
                                {article.excerpt || 'Тук ще се покаже резюмето на статията.'}
                            </p>

                            <div
                                className="prose prose-lg md:prose-xl max-w-none mb-8 article-body font-sans text-gray-800
                  [&_p]:font-sans [&_p]:leading-relaxed [&_p]:mb-6
                  [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-black [&_h2]:mt-10 [&_h2]:mb-4
                  [&_h3]:font-display [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-4
                  [&_img]:w-full [&_img]:h-auto [&_img]:my-8 [&_img]:border-4 [&_img]:border-[#1c1428] [&_img]:shadow-[4px_4px_0_#1c1428]
                "
                                dangerouslySetInnerHTML={{ __html: articlePresentation.html }}
                            />
                        </div>
                    )}

                    {viewMode === 'card' && (
                        <div className="p-8 bg-zinc-50 min-h-[80vh] flex flex-col items-center gap-12">
                            <div className="w-full max-w-sm">
                                <h3 className="font-display font-bold text-gray-400 mb-4 uppercase text-xs tracking-widest text-center">Изглед - Стандартна</h3>
                                <ComicNewsCard article={article} />
                            </div>
                            <div className="w-full max-w-sm">
                                <h3 className="font-display font-bold text-gray-400 mb-4 uppercase text-xs tracking-widest text-center">Изглед - Featured</h3>
                                {(() => {
                                    const design = getComicCardStyle('heroMap', 0, article, siteSettings?.layoutPresets?.heroMap);
                                    return <ComicNewsCard article={article} variant={design.variant} tilt={design.tilt} stripe={design.stripe} sticker="Featured" />
                                })()}
                            </div>
                            <div className="w-full max-w-full">
                                <h3 className="font-display font-bold text-gray-400 mb-4 uppercase text-xs tracking-widest text-center">Изглед - Хоризонтална</h3>
                                <ComicNewsCard article={article} compact={true} />
                            </div>
                        </div>
                    )}

                    {viewMode === 'social' && (
                        <div className="p-8 bg-zinc-100 min-h-[80vh] flex items-center justify-center">
                            <div className="w-full max-w-[500px] bg-white border border-gray-300 rounded-lg overflow-hidden shadow-xl transform scale-110">
                                {/* Fake Facebook share card */}
                                <div className="bg-[#f0f2f5] p-3 flex items-center gap-3 border-b border-gray-200">
                                    <div className="w-8 h-8 bg-[#0866FF] text-white flex items-center justify-center font-bold rounded-full font-sans text-lg">f</div>
                                    <div>
                                        <p className="text-sm font-bold text-[#1c1e21] leading-tight">Facebook News Feed</p>
                                        <p className="text-[11px] text-[#65676B]">Приблизителен изглед при споделяне от читател</p>
                                    </div>
                                </div>
                                <div className="relative aspect-[1.91/1] bg-[#e4e6eb] border-b border-gray-200">
                                    {(article.shareImage || article.image) ? (
                                        <img src={article.shareImage || article.image} alt="Share" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center font-bold text-[#65676B]">Няма снимка</div>
                                    )}
                                </div>
                                <div className="p-3 bg-[#f2f3f5]">
                                    <p className="text-[12px] text-[#65676B] uppercase mb-1 font-sans">ZEMUN-NEWS.COM</p>
                                    <p className="text-[16px] font-bold text-[#050505] leading-tight mb-1 truncate font-sans">
                                        {article.shareTitle || article.title || 'Въведете заглавие'}
                                    </p>
                                    <p className="text-[14px] text-[#65676B] line-clamp-1 font-sans">
                                        {article.shareSubtitle || article.excerpt || 'Резюме липсва...'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
