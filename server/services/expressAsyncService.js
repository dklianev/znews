export function asyncHandler(handler) {
  return function wrappedAsyncHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createApiErrorHandler({ publicError }) {
  return function apiErrorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);

    const statusCode = Number.isInteger(error?.statusCode)
      ? error.statusCode
      : Number.isInteger(error?.status)
        ? error.status
        : 500;

    const payload = {
      error: publicError(error, statusCode >= 500 ? 'Server error' : 'Request failed'),
    };

    if (error?.fieldErrors && typeof error.fieldErrors === 'object') {
      payload.fieldErrors = error.fieldErrors;
    }

    return res.status(statusCode).json(payload);
  };
}
