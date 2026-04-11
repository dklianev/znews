export default function StrandsHelpModal({ open, onClose }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 px-4 backdrop-blur-sm dark:bg-black/80" onClick={onClose}>
            <div className="comic-panel max-w-md bg-white p-6 dark:bg-zinc-900" onClick={(event) => event.stopPropagation()}>
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-zn-purple">Как се играе</p>
                <h2 className="mt-3 text-3xl font-black uppercase font-display text-slate-900 dark:text-white">Нишки</h2>
                <div className="mt-5 space-y-3 text-sm leading-6 text-slate-700 dark:text-zinc-300">
                    <p>Свързвай съседни букви във всички 8 посоки, за да откриеш тематичните думи в борда.</p>
                    <p>Всяка клетка принадлежи на точно една дума. Когато откриеш всички думи, завършваш дневния пъзел.</p>
                    <p>Спанграмата е специалната нишка, която минава от край до край на мрежата и подсказва общата тема.</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="btn-primary mt-6 w-full justify-center px-5 py-3 text-sm font-black uppercase tracking-[0.24em]"
                >
                    Ясно
                </button>
            </div>
        </div>
    );
}
