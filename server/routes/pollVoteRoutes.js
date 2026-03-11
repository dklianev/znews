export function registerPollVoteRoutes(app, deps) {
  const {
    Poll,
    PollVote,
    getWindowKey,
    hashClientFingerprint,
    isMongoDuplicateKeyError,
    pollVoteLimiter,
    pollVoteWindowMs,
    publicError,
  } = deps;

  app.post('/api/polls/:id/vote', pollVoteLimiter, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const optionIndex = Number.parseInt(req.body.optionIndex, 10);
      if (!Number.isInteger(id) || !Number.isInteger(optionIndex)) {
        return res.status(400).json({ error: 'Invalid vote payload' });
      }

      const poll = await Poll.findOne({ id }).lean();
      if (!poll || !poll.options?.[optionIndex]) return res.status(404).json({ error: 'Not found' });

      const voterHash = hashClientFingerprint(req, `poll:${id}`);
      const windowKey = getWindowKey(pollVoteWindowMs);
      const expiresAt = new Date(Date.now() + pollVoteWindowMs + (15 * 60 * 1000));

      try {
        await PollVote.create({
          pollId: id,
          voterHash,
          windowKey,
          optionIndex,
          expiresAt,
        });
      } catch (error) {
        if (isMongoDuplicateKeyError(error)) {
          return res.status(429).json({ error: 'You already voted in this poll from this network' });
        }
        throw error;
      }

      const optionPath = `options.${optionIndex}.votes`;
      const updated = await Poll.findOneAndUpdate(
        { id, [`options.${optionIndex}`]: { $exists: true } },
        { $inc: { [optionPath]: 1 } },
        { new: true }
      ).lean();

      if (!updated) return res.status(404).json({ error: 'Not found' });
      delete updated._id;
      delete updated.__v;
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: publicError(e) });
    }
  });
}
