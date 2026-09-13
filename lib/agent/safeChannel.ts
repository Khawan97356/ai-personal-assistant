export async function safeChannelSend<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error("Channel error:", err);
    return null;
  }
}
