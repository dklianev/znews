const DEFAULT_ALLOWED_MIME_MESSAGE = 'Only JPEG, PNG, GIF, and WebP files are allowed';

function createImageFieldPayload(fieldMessage, errorMessage = fieldMessage) {
  return {
    error: errorMessage,
    fieldErrors: {
      image: fieldMessage,
    },
  };
}

export function createImageUploadErrorHelpers({
  uploadMaxFileSizeMb = 10,
  allowedMimeMessage = DEFAULT_ALLOWED_MIME_MESSAGE,
} = {}) {
  const maxFileSizeMessage = `Качи изображение до ${uploadMaxFileSizeMb} MB.`;

  return {
    buildMissingFilePayload(message = 'Качи изображение, за да продължиш.') {
      return createImageFieldPayload(message);
    },
    buildEmptyBufferPayload(message = 'Каченият файл е празен. Опитай с друго изображение.') {
      return createImageFieldPayload(message);
    },
    buildUploadErrorPayload(error) {
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return createImageFieldPayload(maxFileSizeMessage, 'Файлът е твърде голям.');
      }

      if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
        return createImageFieldPayload('Качи само едно изображение.', 'Качен е неочакван файл.');
      }

      if (typeof error?.message === 'string' && error.message.includes(allowedMimeMessage)) {
        return createImageFieldPayload(
          'Разрешени са само JPEG, PNG, GIF и WebP изображения.',
          'Неподдържан файлов формат.',
        );
      }

      const fallbackMessage = typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Качването на изображението не успя.';

      return createImageFieldPayload(fallbackMessage);
    },
  };
}
