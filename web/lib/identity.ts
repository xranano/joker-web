const ID_KEY = 'joker.playerId';
const NAME_KEY = 'joker.name';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* insecure context (plain http on a LAN IP) */
    }
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let memoryId: string | null = null;

export function getPlayerId(): string {
  const s = store();
  let id = s?.getItem(ID_KEY) ?? memoryId;
  if (!id) {
    id = uuid();
    memoryId = id;
    try {
      s?.setItem(ID_KEY, id);
    } catch {}
  }
  return id;
}

export function getSavedName(): string {
  return store()?.getItem(NAME_KEY) ?? '';
}

export function saveName(name: string): void {
  try {
    store()?.setItem(NAME_KEY, name);
  } catch {}
}
