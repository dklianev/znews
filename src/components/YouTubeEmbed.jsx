import { useState } from 'react';
import { Play } from 'lucide-react';

export default function YouTubeEmbed({ url, title, thumbnailUrl, className = '' }) {
    const [isPlaying, setIsPlaying] = useState(false);

    // Extract Video ID
    const getYouTubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const videoId = getYouTubeId(url);

    if (!videoId) return null;

    // If we don't have a poster image, use the default maxresdefault from youtube
    const posterUrl = thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return (
        <div className={`relative w-full aspect-video bg-black rounded overflow-hidden group border-4 border-zn-black ${className}`} style={{ boxShadow: '4px 4px 0 #1C1428' }}>
            {!isPlaying ? (
                <button
                    onClick={() => setIsPlaying(true)}
                    className="absolute inset-0 w-full h-full cursor-pointer focus:outline-none"
                    aria-label={`Play video ${title}`}
                >
                    <img
                        src={posterUrl}
                        alt={title || "YouTube video thumbnail"}
                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 bg-zn-hot rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-[#ff0000] transition-all duration-300 z-10 border-2 border-white/20">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                    </div>
                </button>
            ) : (
                <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                    title={title || "YouTube video player"}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                />
            )}
        </div>
    );
}
