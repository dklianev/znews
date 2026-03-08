export function writeJsonChunk(res, chunk) {
  return new Promise((resolve, reject) => {
    const canContinue = res.write(chunk, 'utf8', (error) => {
      if (error) reject(error);
    });
    if (canContinue) {
      resolve();
      return;
    }
    res.once('drain', resolve);
  });
}

export async function streamJsonArray(res, cursor, transform = (item) => item) {
  let first = true;
  try {
    for await (const item of cursor) {
      const value = transform(item);
      const prefix = first ? '' : ',';
      first = false;
      await writeJsonChunk(res, `${prefix}${JSON.stringify(value)}`);
    }
  } finally {
    await cursor.close().catch(() => {});
  }
}
