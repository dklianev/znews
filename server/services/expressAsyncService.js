function mapValidationFieldErrors(error) {
  if (!error?.errors || typeof error.errors !== 'object') return null;

  const fieldErrors = Object.entries(error.errors).reduce((acc, [field, entry]) => {
    if (typeof entry?.message === 'string' && entry.message.trim()) {
      acc[field] = entry.message.trim();
    }
    return acc;
  }, {});

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

function mapDuplicateKeyFieldErrors(error) {
  if (Number(error?.code) !== 11000) return null;

  const fieldErrors = {};
  const keyValue = error?.keyValue && typeof error.keyValue === 'object' ? error.keyValue : {};

  Object.keys(keyValue).forEach((field) => {
    fieldErrors[field] = 'Тази стойност вече се използва.';
  });

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

function resolveFieldErrors(error) {
  if (error?.fieldErrors && typeof error.fieldErrors === 'object') {
    return error.fieldErrors;
  }

  if (error?.name === 'ValidationError') {
    return mapValidationFieldErrors(error);
  }

  return mapDuplicateKeyFieldErrors(error);
}

export function asyncHandler(handler) {
  return function wrappedAsyncHandler(req, res, next) {
    return Promise.resolve(handler(req, res, next)).catch((error) => {
      if (typeof next === 'function') {
        return next(error);
      }
      throw error;
    });
  };
}

export function createApiErrorHandler({ publicError }) {
  return function apiErrorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    const statusCode = Number.isInteger(error?.statusCode)
      ? error.statusCode
      : Number.isInteger(error?.status)
        ? error.status
        : error?.name === 'ValidationError'
          ? 400
          : Number(error?.code) === 11000
            ? 409
        : 500;

    const fieldErrors = resolveFieldErrors(error);
    const payload = {
      error: publicError(error, statusCode >= 500 ? 'Server error' : 'Request failed'),
    };

    if (fieldErrors) {
      payload.fieldErrors = fieldErrors;
    }

    return res.status(statusCode).json(payload);
  };
}
