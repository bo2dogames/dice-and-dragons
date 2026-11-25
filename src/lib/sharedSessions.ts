import { requireSupabase } from './supabase'

const sharedKeys = [
  'dnd-campaigns', 'dnd-sessions', 'dnd-maps', 'dnd-active-campaign', 'dnd-party',
  'dice-and-dragons-npcs', 'dice-and-dragons-active-map', 'dice-and-dragons-map-tokens',
  'dnd-active-session', 'dice-and-dragons-dm-notes',
]

export type SharedGame = {
  code: string
  owner_id: string
  title: string
  snapshot: Record<string, unknown>
  members?: { user_id: string; character: Record<string, unknown> }[]
}

export function readSharedSnapshot() {
  const snapshot: Record<string, unknown> = {}
  for (const key of sharedKeys) {
    const value = localStorage.getItem(key)
    if (value === null) continue
    try { snapshot[key] = JSON.parse(value) } catch { snapshot[key] = value }
  }
  return snapshot
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stableValue(entry)]))
  return value
}

export function sharedSnapshotsMatch(left: Record<string, unknown>, right: Record<string, unknown>) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
}

export function applySharedSnapshot(snapshot: Record<string, unknown>) {
  for (const key of sharedKeys) {
    if (Object.hasOwn(snapshot, key)) {
      const value = snapshot[key]
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    } else localStorage.removeItem(key)
  }
  window.dispatchEvent(new CustomEvent('dnd-account-data-change', { detail: { keys: sharedKeys, source: 'remote' } }))
}

export async function shareMediaWithGame(source: string, category: string, code: string) {
  let blob: Blob
  if (source.startsWith('storage://')) {
    const url = await resolveMedia(source)
    const response = await fetch(url)
    if (!response.ok) throw new Error('Не удалось перенести сохранённое изображение в общую сессию.')
    blob = await response.blob()
  } else if (source.startsWith('data:image/')) {
    blob = await (await fetch(source)).blob()
  } else return source
  const file = new File([blob], `${category}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type })
  return uploadMedia(file, category, code)
}

export async function createSharedGame(title: string) {
  const { data, error } = await requireSupabase().rpc('create_shared_game', { p_title: title, p_snapshot: {} })
  if (error) throw error
  const code = String(data)
  const snapshot = readSharedSnapshot()
  const moved = new Map<string, string>()
  const move = async (source: string, category: string) => {
    if (!moved.has(source)) moved.set(source, await shareMediaWithGame(source, category, code))
    return moved.get(source)!
  }
  if (Array.isArray(snapshot['dnd-maps'])) {
    const maps = snapshot['dnd-maps'] as { image?: string; [key: string]: unknown }[]
    snapshot['dnd-maps'] = await Promise.all(maps.map(async (map) => map.image ? { ...map, image: await move(map.image, 'maps') } : map))
  }
  const activeMap = snapshot['dice-and-dragons-active-map']
  if (typeof activeMap === 'string' && activeMap) snapshot['dice-and-dragons-active-map'] = await move(activeMap, 'maps')
  await requireSupabase().rpc('update_shared_game', { p_code: code, p_snapshot: snapshot }).then(({ error: updateError }) => { if (updateError) throw updateError })
  applySharedSnapshot(snapshot)
  return code
}

export async function readSharedGame(code: string) {
  const { data, error } = await requireSupabase().rpc('read_shared_game', { p_code: code.toUpperCase() })
  if (error) throw error
  return data as SharedGame
}

export async function joinSharedGame(code: string, character: Record<string, unknown>) {
  const { data, error } = await requireSupabase().rpc('join_shared_game', { p_code: code.toUpperCase(), p_character: character })
  if (error) throw error
  return data as SharedGame
}

export async function updateSharedGame(code: string, snapshot = readSharedSnapshot()) {
  const { error } = await requireSupabase().rpc('update_shared_game', { p_code: code.toUpperCase(), p_snapshot: snapshot })
  if (error) throw error
}

export function gameInviteLink(code: string) {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin)
  return `${base.href}#/game?join=${encodeURIComponent(code)}`
}

export function normalizeGameCode(value: string) {
  const fromLink = value.match(/[?&]join=([A-HJ-NP-Z2-9]{5})/i)?.[1]
  const candidate = (fromLink ?? value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^[A-HJ-NP-Z2-9]{5}$/.test(candidate) ? candidate : ''
}

export async function uploadMedia(file: File, category: string, gameCode?: string) {
  if (!file.type.startsWith('image/')) throw new Error('Выберите файл изображения.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Изображение должно быть не больше 10 МБ.')
  const userId = (await requireSupabase().auth.getUser()).data.user?.id
  if (!userId) throw new Error('Войдите в аккаунт, чтобы сохранить изображение.')
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(-70) || 'image'
  const root = gameCode ? `games/${gameCode.toUpperCase()}` : `users/${userId}`
  const path = `${root}/${category}/${crypto.randomUUID()}-${safeName}`
  const { error } = await requireSupabase().storage.from('dnd-media').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return `storage://${path}`
}

export async function resolveMedia(source: string) {
  if (!source.startsWith('storage://')) return source
  const path = source.slice('storage://'.length)
  const { data, error } = await requireSupabase().storage.from('dnd-media').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

