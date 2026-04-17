import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

const TetrisExperience = lazy(() => import('../components/games/tetris/TetrisExperience.jsx'));

function TetrisPageFallback() {
  return (
    <div className="min-h-screen bg-[#07071f] text-white flex items-center justify-center px-4">
      <div className="text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-yellow-400" />
        <p className="mt-4 font-display text-xs font-black uppercase tracking-[0.24em] text-indigo-300">
          Зареждаме Тетрис...
        </p>
      </div>
    </div>
  );
}

export default function GameTetrisPage() {
  return (
    <Suspense fallback={<TetrisPageFallback />}>
      <TetrisExperience />
    </Suspense>
  );
}
