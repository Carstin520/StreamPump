let hlsModulePromise: Promise<typeof import("hls.js")> | null = null;

export const primeHlsJs = () => {
  if (!hlsModulePromise) {
    hlsModulePromise = import("hls.js");
  }

  return hlsModulePromise;
};
