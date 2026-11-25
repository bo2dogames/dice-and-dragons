import { requireSupabase } from './supabase'

const keys = [
  'dnd-campaigns', 'dnd-sessions', 'dnd-maps', 'dnd-active-campaign', 'dnd-master-name', 'dnd-rules-system',
  'dnd-party', 'dice-and-dragons-npcs', 'dnd-player-characters', 'dnd-active-player-character',
  'dnd-player-memberships', 'dice-and-dragons-active-map', 'dice-and-dragons-map-tokens', 'dnd-active-session', 'dice-and-dragons-dm-notes',
]

const defaultHeroNames = new Set(['Артур', 'Элира', 'Торин', 'Лира'])
const defaultNpcNames = new Set(['Капитан Олдер Торн', 'Мира Шепот Леса', 'Брум Железный'])
let accountDataReady = false
let activeUserId = ''
const pendingWrites = new Map<string, string | null>()
let writeTimer: ReturnType<typeof setTimeout> | undefined

function emitSyncStatus(status: 'saving' | 'saved' | 'error') {
  window.dispatchEvent(new CustomEvent('dnd-sync-status', { detail: status }))
}

async function persist(key: string, value: string | null) {
  if (!keys.includes(key) || !activeUserId) return
  const client = requireSupabase()
  const result = value === null
    ? await client.from('account_data').delete().eq('user_id', activeUserId).eq('data_key', key)
    : await client.from('account_data').upsert({ user_id: activeUserId, data_key: key, data_value: JSON.parse(value) }, { onConflict: 'user_id,data_key' })
  if (result.error) throw result.error
}

async function sendPendingWrites() {
  clearTimeout(writeTimer)
  if (!accountDataReady || pendingWrites.size === 0) return
  emitSyncStatus('saving')
  const batch = new Map(pendingWrites)
  pendingWrites.clear()
  try {
    await Promise.all([...batch].map(([key, value]) => persist(key, value)))
    emitSyncStatus('saved')
  } catch {
    for (const [key, value] of batch) pendingWrites.set(key, value)
    emitSyncStatus('error')
  }
}

function scheduleWrite(key: string, value: string | null) {
  if (!accountDataReady || !keys.includes(key)) return
  pendingWrites.set(key, value)
  clearTimeout(writeTimer)
  writeTimer = setTimeout(() => { void sendPendingWrites() }, 350)
}

export function writeAccountValue(key: string, value: string) {
  localStorage.setItem(key, value)
  scheduleWrite(key, value)
}

export function removeAccountValue(key: string) {
  localStorage.removeItem(key)
  scheduleWrite(key, null)
}

function readLegacyAccountData() {
  const data: Record<string, unknown> = {}
  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value === null) continue
    try { data[key] = JSON.parse(value) } catch { data[key] = value }
  }

  if (Array.isArray(data['dnd-campaigns'])) data['dnd-campaigns'] = data['dnd-campaigns'].filter((item) => item?.id !== 'campaign-ash-crown')
  if (Array.isArray(data['dnd-sessions'])) data['dnd-sessions'] = data['dnd-sessions'].filter((item) => item?.id !== 'session-ash-02')
  if (Array.isArray(data['dnd-party'])) data['dnd-party'] = data['dnd-party'].filter((item) => item?.characterId || !defaultHeroNames.has(item?.name))
  if (Array.isArray(data['dice-and-dragons-npcs'])) data['dice-and-dragons-npcs'] = data['dice-and-dragons-npcs'].filter((item) => !defaultNpcNames.has(item?.name))
  if (data['dnd-active-campaign'] === 'campaign-ash-crown') delete data['dnd-active-campaign']
  if (!Array.isArray(data['dnd-campaigns']) || data['dnd-campaigns'].length === 0) {
    delete data['dnd-campaigns']
    delete data['dnd-active-campaign']
  }
  if (!Array.isArray(data['dnd-sessions']) || data['dnd-sessions'].length === 0) delete data['dnd-sessions']
  if (Array.isArray(data['dnd-party']) && data['dnd-party'].length === 0) delete data['dnd-party']
  if (Array.isArray(data['dice-and-dragons-npcs']) && data['dice-and-dragons-npcs'].length === 0) delete data['dice-and-dragons-npcs']
  return data
}

export async function hydrateAccountData(userId: string) {
  accountDataReady = false
  activeUserId = userId
  pendingWrites.clear()
  const client = requireSupabase()
  const { data: rows, error } = await client.from('account_data').select('data_key,data_value').eq('user_id', userId)
  if (error) throw error
  let data: Record<string, unknown> = Object.fromEntries((rows ?? []).map((row) => [row.data_key, row.data_value]))

  const ownerId = localStorage.getItem('dnd-local-user-id')
  if (Object.keys(data).length === 0 && (!ownerId || ownerId === userId)) {
    const legacy = readLegacyAccountData()
    if (Object.keys(legacy).length > 0) {
      await Promise.all(Object.entries(legacy).map(([key, value]) => persistForUser(userId, key, value)))
      data = legacy
    }
  }

  for (const key of keys) {
    if (Object.hasOwn(data, key)) localStorage.setItem(key, typeof data[key] === 'string' ? data[key] as string : JSON.stringify(data[key]))
    else localStorage.removeItem(key)
  }
  localStorage.setItem('dnd-local-user-id', userId)
  accountDataReady = true
  emitSyncStatus('saved')
}

async function persistForUser(userId: string, key: string, value: unknown) {
  const { error } = await requireSupabase().from('account_data').upsert({ user_id: userId, data_key: key, data_value: value }, { onConflict: 'user_id,data_key' })
  if (error) throw error
}

export async function flushAccountWrites() {
  await sendPendingWrites()
}

export async function signOutAccount() {
  await flushAccountWrites()
  accountDataReady = false
  activeUserId = ''
  pendingWrites.clear()
  clearTimeout(writeTimer)
  for (const key of keys) localStorage.removeItem(key)
  localStorage.removeItem('dnd-local-user-id')
}
