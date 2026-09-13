export const STORAGE_KEY = "iabrian.chats.v1";
export function readChats(storage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(data)) return [];
    return data.filter(c => typeof c?.id === "string" && typeof c.title === "string" && Array.isArray(c.messages))
      .slice(0, 30).map(c => ({id:c.id, title:c.title.slice(0,80), messages:c.messages
        .filter(m => ["user","assistant"].includes(m?.role) && typeof m.content === "string" && m.content.trim())
        .slice(-100).map(m => ({role:m.role,content:m.content.slice(0,16000)}))}));
  } catch { return []; }
}
export function contextMessages(messages, maxBytes = 2800) {
  const enc = new TextEncoder();
  const result = [];
  let size = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const nextSize = enc.encode(m.content).length + 30;
    if(size + nextSize > maxBytes) break;
    result.unshift({role:m.role,content:m.content});
    size += nextSize;
  }
  while(result[0]?.role === "assistant") result.shift();
  return result;
}
