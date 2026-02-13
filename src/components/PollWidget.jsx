import { useData } from '../context/DataContext';
import { BarChart3, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

function getVotedPolls() {
  try { return JSON.parse(localStorage.getItem('zn_voted_polls') || '{}'); } catch { return {}; }
}

function markPollVoted(pollId, optionIndex) {
  const voted = getVotedPolls();
  voted[pollId] = optionIndex;
  localStorage.setItem('zn_voted_polls', JSON.stringify(voted));
}

export default function PollWidget() {
  const { polls, votePoll } = useData();
  const activePoll = polls.find(p => p.active);
  const [votedPolls, setVotedPolls] = useState(getVotedPolls);

  if (!activePoll) return null;

  const hasVoted = votedPolls[activePoll.id] !== undefined;
  const votedOption = votedPolls[activePoll.id];
  const totalVotes = activePoll.options.reduce((sum, o) => sum + o.votes, 0);

  const handleVote = (index) => {
    if (hasVoted) return;
    votePoll(activePoll.id, index);
    markPollVoted(activePoll.id, index);
    setVotedPolls(getVotedPolls());
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="newspaper-page comic-panel p-5 pt-6 relative comic-dots comic-sidebar-widget overflow-visible"
      style={{ '--widget-tilt': '-0.25deg' }}
    >
      {/* Tape */}
      <div className="absolute -top-2 right-8 w-12 h-4 bg-yellow-200/70 border border-black/5 transform rotate-4 z-10" style={{boxShadow:'1px 1px 2px rgba(0,0,0,0.1)'}} />
      {!hasVoted && (
        <div className="absolute -top-2 -right-2 z-20">
          <span className="comic-sticker">Гласувай</span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-1 relative z-[2]">
        <BarChart3 className="w-5 h-5 text-zn-purple" />
        <h3 className="font-display font-black text-sm text-zn-black uppercase tracking-widest">Анкета</h3>
      </div>
      <div className="h-1 bg-gradient-to-r from-zn-purple to-zn-hot mb-4 mt-2 relative z-[2]" />

      <p className="font-display font-bold text-sm text-zn-black mb-4 uppercase relative z-[2]">{activePoll.question}</p>

      <div className="space-y-2 relative z-[2]">
        {activePoll.options.map((option, index) => {
          const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
          const isMyVote = votedOption === index;
          return (
            <motion.button
              key={index}
              onClick={() => handleVote(index)}
              disabled={hasVoted}
              className={`w-full text-left group ${hasVoted ? 'cursor-default' : 'cursor-pointer'}`}
              whileHover={!hasVoted ? { scale: 1.02 } : {}}
              whileTap={!hasVoted ? { scale: 0.98 } : {}}
              transition={{ type: 'tween', duration: 0.1 }}
            >
              <div className={`comic-poll-option relative transition-all duration-200 ${
                isMyVote ? 'border-zn-hot bg-zn-hot/5' : hasVoted ? 'border-zn-border' : 'border-zn-border hover:border-zn-purple hover:shadow-comic'
              }`}>
                <motion.div
                  className={`comic-poll-fill absolute inset-0 ${isMyVote ? 'bg-zn-hot/15' : 'bg-zn-hot/5'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: hasVoted ? 0.1 * index : 0 }}
                />
                <div className="relative flex items-center justify-between px-3 py-2.5">
                  <span className={`text-sm font-display font-bold uppercase transition-colors ${
                    isMyVote ? 'text-zn-hot' : 'text-zn-text'
                  } ${!hasVoted ? 'group-hover:text-zn-purple' : ''}`}>
                    {isMyVote && <CheckCircle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                    {option.text}
                  </span>
                  <span className="text-xs font-display font-black text-zn-text-muted">{pct}%</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-[10px] font-display text-zn-text-dim mt-3 text-center uppercase tracking-widest font-black relative z-[2]">
        {totalVotes} гласа {hasVoted ? '· Вие гласувахте' : '· Кликнете за да гласувате'}
      </p>
    </motion.div>
  );
}
