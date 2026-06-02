/**
 * Image helper utilities for Eventspace ERP
 */

export function compressImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's a PDF, do not compress, just read normal
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string); // Fallback
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Default to image/jpeg for powerful compression unless it is explicitly image/png or image/webp
        const mimeType = (file.type === 'image/png' || file.type === 'image/svg+xml') ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(reader.result as string); // Fallback to raw if image loading fails
      };
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
