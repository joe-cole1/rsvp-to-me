export function compressImage(
  file: File,
  { maxWidth, maxHeight, quality = 0.85 }: { maxWidth: number; maxHeight: number; quality?: number }
): Promise<File> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    const releaseUrl = () => URL.revokeObjectURL(objectUrl);

    image.onload = () => {
      releaseUrl();
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Image compression is unavailable"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    image.onerror = () => {
      releaseUrl();
      reject(new Error("Could not read image"));
    };
    image.src = objectUrl;
  });
}
