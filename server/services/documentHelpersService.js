export function createDocumentHelpers() {
  function stripDocumentMetadata(item) {
    if (!item || typeof item !== 'object') return item;
    const next = { ...item };
    delete next._id;
    delete next.__v;
    return next;
  }

  function stripDocumentList(items) {
    return (Array.isArray(items) ? items : []).map((item) => stripDocumentMetadata(item));
  }

  function cleanExportItem(item) {
    const next = stripDocumentMetadata(item);
    if (next && typeof next === 'object') {
      delete next.password;
    }
    return next;
  }

  return {
    cleanExportItem,
    stripDocumentList,
    stripDocumentMetadata,
  };
}
