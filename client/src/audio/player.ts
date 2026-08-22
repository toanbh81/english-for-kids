export function playUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio(url); a.onended = () => resolve(); a.onerror = () => reject(new Error('audio failed')); void a.play()
  })
}
export async function playBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob)
  try { await playUrl(url) } finally { URL.revokeObjectURL(url) }
}
