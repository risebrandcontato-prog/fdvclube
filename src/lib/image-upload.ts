const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const TARGET_MAX_BYTES = 500 * 1024;
const MAX_DIMENSION = 1600;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    img.src = dataUrl;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo da imagem."));
    reader.readAsDataURL(file);
  });
}

export async function prepareImageForUpload(file: File): Promise<string> {
  const originalDataUrl = await fileToDataUrl(file);
  if (file.size <= MAX_UPLOAD_BYTES) return originalDataUrl;

  const img = await loadImage(originalDataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falha ao preparar imagem para upload.");

  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.86;
  let output = canvas.toDataURL("image/jpeg", quality);
  while (output.length > TARGET_MAX_BYTES * 1.37 && quality > 0.45) {
    quality -= 0.08;
    output = canvas.toDataURL("image/jpeg", quality);
  }

  return output;
}
