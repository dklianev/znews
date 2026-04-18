import { useState } from 'react';
import { Play, VideoOff, ExternalLink } from 'lucide-react';
import {
    extractYouTubeId,
    getYouTubePosterUrl,
    getYouTubeThumbnailAlt,
    getYouTubeUnavailableMessageParts,
    isCefYouTubeFallbackEnvironment,
} from '../utils/youtubeEmbeds';

export default function YouTubeEmbed({ url, title, thumbnailUrl, className = '', articleId = null }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const isCEF = isCefYouTubeFallbackEnvironment();
    const videoId = extractYouTubeId(url);
    const safeTitle = title || 'Видео';
    const thumbnailAlt = getYouTubeThumbnailAlt(title);
    const unavailableMessage = getYouTubeUnavailableMessageParts(articleId);

    if (!videoId) return null;

    // If we don't have a poster image, use the default maxresdefault from youtube
    const posterUrl = getYouTubePosterUrl(videoId, thumbnailUrl);

    if (isCEF) {
        return (
            <div className={`relative w-full aspect-video bg-black rounded overflow-hidden border-4 border-zn-black ${className}`} style={{ boxShadow: '4px 4px 0 #1C1428' }}>
                <img src={posterUrl} alt={thumbnailAlt} width="1280" height="720" className="absolute inset-0 w-full h-full object-cover opacity-20" loading="lazy" />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                    <VideoOff className="w-12 h-12 text-zinc-500 mb-3" />
                    <p className="text-zn-hot font-display text-2xl uppercase tracking-wide mb-1 drop-shadow-md">{unavailableMessage.heading}</p>
                    <p className="text-white/80 text-sm max-w-sm drop-shadow">
                        {unavailableMessage.prefix}{' '}
                        <span className="font-bold text-white">{unavailableMessage.articlePath}</span>{' '}
                        {unavailableMessage.suffix}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative w-full aspect-video bg-black rounded overflow-hidden group border-4 border-zn-black ${className}`} style={{ boxShadow: '4px 4px 0 #1C1428' }}>
            {!isPlaying ? (
                <button
                    onClick={() => setIsPlaying(true)}
                    className="absolute inset-0 w-full h-full cursor-pointer focus:outline-none"
                    aria-label={`Пусни видеото ${safeTitle}`}
                >
                    <img
                        src={posterUrl}
                        alt={thumbnailAlt}
                        width="1280"
                        height="720"
                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 bg-zn-hot rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-[#ff0000] transition-all duration-300 z-10 border-2 border-white/20">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                    </div>
                </button>
            ) : (
                <>
                    <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                        title={title ? `Видео плейър на YouTube: ${title}` : 'Видео плейър на YouTube'}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                    <a
                        href={`https://www.youtube.com/watch?v=${videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-3 right-3 bg-[#1C1428]/90 hover:bg-zn-hot text-white text-xs font-display tracking-widest px-3 py-2 rounded-lg border border-white/20 transition-colors flex items-center gap-1.5 z-20 shadow-lg backdrop-blur-sm"
                        title="Отвори видеото в нов прозорец"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        ГЛЕДАЙ В YOUTUBE
                    </a>
                </>
            )}
        </div>
    );
}
