import { useEffect } from 'react';
import { Delete } from 'lucide-react';

const BG_KEYBOARD = [
    ['Я', 'В', 'Е', 'Р', 'Т', 'Ъ', 'У', 'И', 'О', 'П', 'Ю'],
    ['А', 'С', 'Д', 'Ф', 'Г', 'Х', 'Й', 'К', 'Л', 'Ш', 'Щ'],
    ['ENTER', 'З', 'Ь', 'Ц', 'Ж', 'Б', 'Н', 'М', 'Ч', 'BACKSPACE']
];

export default function WordKeyboard({ onChar, onDelete, onEnter, statuses }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') onEnter();
            else if (e.key === 'Backspace') onDelete();
            else {
                const char = e.key.toUpperCase();
                // matches Bulgarian cyrillic
                if (/^[А-ЯЬЮЯ]$/.test(char)) {
                    onChar(char);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onChar, onDelete, onEnter]);

    return (
        <div className="w-full max-w-2xl mx-auto px-1 select-none">
            {BG_KEYBOARD.map((row, i) => (
                <div key={i} className="flex justify-center gap-1 mb-2">
                    {row.map(key => {
                        const isEnter = key === 'ENTER';
                        const isBackspace = key === 'BACKSPACE';
                        const status = statuses[key];

                        let bgClass = 'bg-zinc-700 hover:bg-zinc-600 text-white';
                        if (status === 'correct') bgClass = 'bg-emerald-600 text-white';
                        else if (status === 'present') bgClass = 'bg-yellow-600 text-white';
                        else if (status === 'absent') bgClass = 'bg-zinc-900 text-zinc-500';

                        const widthClass = isEnter || isBackspace ? 'w-16 md:w-20' : 'w-8 md:w-12';
                        const textClass = isEnter ? 'text-xs' : 'text-lg font-bold';

                        return (
                            <button
                                key={key}
                                onClick={() => {
                                    if (isEnter) onEnter();
                                    else if (isBackspace) onDelete();
                                    else onChar(key);
                                }}
                                className={`${widthClass} h-12 rounded flex items-center justify-center transition-colors active:scale-95 ${bgClass} ${textClass}`}
                            >
                                {isBackspace ? <Delete className="w-5 h-5" /> : key}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
