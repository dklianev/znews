export async function allocateNumericId(Model, CounterModel, counterKey = '') {
  const key = String(counterKey || Model?.modelName || '').trim();
  if (!key) throw new Error('Counter key is required');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const counter = await CounterModel.findOneAndUpdate(
      { key },
      {
        $inc: { seq: 1 },
        $set: { updatedAt: new Date() },
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
      }
    ).lean();

    const candidate = Number.parseInt(counter?.seq, 10);
    if (!Number.isInteger(candidate) || candidate <= 0) continue;

    const last = await Model.findOne().sort({ id: -1 }).select({ _id: 0, id: 1 }).lean();
    const floor = Number.parseInt(last?.id, 10);

    if (!Number.isInteger(floor) || candidate > floor) {
      return candidate;
    }

    const synced = await CounterModel.findOneAndUpdate(
      { key, seq: candidate },
      {
        $set: {
          seq: floor + 1,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    ).lean();

    const next = Number.parseInt(synced?.seq, 10);
    if (Number.isInteger(next) && next > floor) {
      return next;
    }
  }

  throw new Error(`Failed to allocate numeric id for ${key}`);
}
