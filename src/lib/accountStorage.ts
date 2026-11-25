import { requireSupabase } from './supabase'
import { useEffect } from 'react'

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
const lastSeenUpdates = new Map<string, string>()
let writeTimer: ReturnType<typeof setTimeout> | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryDelay = 1000
let writeInFlight: Promise<boolean> | null = null
let syncTimer: ReturnType<typeof setInterval> | undefined
let syncInFlight = false
let syncGeneration = 0

type AccountChange = { keys: string[]; source: 'local' | 'remote' | 'hydrate' }
const emptySyncList: unknown[] = []

function readStoredValue<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key)
  if (stored === null) return fallback
  if (typeof fallback === 'string') return stored as T
  try { return JSON.parse(stored) as T } catch { return fallback }
}

function emitAccountChange(keys: string[], source: AccountChange['source']) {
  if (keys.length) window.dispatchEvent(new CustomEvent<AccountChange>('dnd-account-data-change', { detail: { keys, source } }))
}

function emitSyncStatus(status: 'saving' | 'saved' | 'error') {
  window.dispatchEvent(new CustomEvent('dnd-sync-status', { detail: { status } }))
}

function emitSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error('Dice & Dragons: account sync failed', error)
  window.dispatchEvent(new CustomEvent('dnd-sync-status', { detail: { status: 'error', message } }))
}

function parseAccountValue(value: string): unknown {
  try { return JSON.parse(value) } catch { return value }
}

async function persist(key: string, value: string | null) {
  if (!keys.includes(key) || !activeUserId) return
  const client = requireSupabase()
  const result = value === null
    ? await client.from('account_data').delete().eq('user_id', activeUserId).eq('data_key', key)
    : await client.from('account_data').upsert({ user_id: activeUserId, data_key: key, data_value: parseAccountValue(value), updated_at: new Date().toISOString() }, { onConflict: 'user_id,data_key' }).select('updated_at').single()
  if (result.error) throw result.error
  if (value === null) lastSeenUpdates.delete(key)
  else if ('data' in result && result.data?.updated_at) lastSeenUpdates.set(key, result.data.updated_at)
}

async function sendPendingWrites(): Promise<boolean> {
  clearTimeout(writeTimer)
  if (writeInFlight) {
    const completed = await writeInFlight
    return completed && pendingWrites.size > 0 ? sendPendingWrites() : completed
  }
  if (!accountDataReady || pendingWrites.size === 0) return true
  emitSyncStatus('saving')
  const batch = new Map(pendingWrites)
  pendingWrites.clear()
  writeInFlight = (async () => {
    try {
      await Promise.all([...batch].map(([key, value]) => persist(key, value)))
      retryDelay = 1000
      clearTimeout(retryTimer)
      emitSyncStatus('saved')
      return true
    } catch (error) {
      for (const [key, value] of batch) if (!pendingWrites.has(key)) pendingWrites.set(key, value)
      emitSyncError(error)
      clearTimeout(retryTimer)
      retryTimer = setTimeout(() => { void sendPendingWrites() }, retryDelay)
      retryDelay = Math.min(30000, retryDelay * 2)
      return false
    } finally {
      writeInFlight = null
    }
  })()
  return writeInFlight
}

function scheduleWrite(key: string, value: string | null) {
  if (!accountDataReady || !keys.includes(key)) return
  pendingWrites.set(key, value)
  clearTimeout(writeTimer)
  writeTimer = setTimeout(() => { void sendPendingWrites() }, 350)
}

export function writeAccountValue(key: string, value: string) {
  localStorage.setItem(key, value)
  emitAccountChange([key], 'local')
  scheduleWrite(key, value)
}

export function removeAccountValue(key: string) {
  localStorage.removeItem(key)
  emitAccountChange([key], 'local')
  scheduleWrite(key, null)
}

export function useAccountDataSync<T>(key: string, setValue: (value: T) => void, fallback: T) {
  useEffect(() => {
    const handleAccountChange = (event: Event) => {
      const detail = (event as CustomEvent<AccountChange>).detail
      if (detail?.keys.includes(key) && detail.source !== 'local') setValue(readStoredValue(key, fallback))
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setValue(readStoredValue(key, fallback))
    }
    window.addEventListener('dnd-account-data-change', handleAccountChange)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('dnd-account-data-change', handleAccountChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [key, setValue, fallback])
}

export function emptyAccountSyncList<T>(): T[] {
  return emptySyncList as T[]
}

async function persistForUser(userId: string, key: string, value: unknown) {
  const { data, error } = await requireSupabase().from('account_data')
    .upsert({ user_id: userId, data_key: key, data_value: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,data_key' })
    .select('updated_at').single()
  if (error) throw error
  if (data?.updated_at) lastSeenUpdates.set(key, data.updated_at)
}

async function pullAccountData() {
  if (!accountDataReady || !activeUserId || syncInFlight || document.visibilityState === 'hidden') return
  syncInFlight = true
  const userId = activeUserId
  const generation = syncGeneration
  try {
    const { data: rows, error } = await requireSupabase().from('account_data')
      .select('data_key,data_value,updated_at').eq('user_id', userId)
    if (error) throw error
    if (generation !== syncGeneration || userId !== activeUserId) return

    const currentRows = new Map((rows ?? []).map((row) => [row.data_key, row]))
    const changedKeys: string[] = []
    for (const key of keys) {
      if (pendingWrites.has(key)) continue
      const row = currentRows.get(key)
      const lastSeen = lastSeenUpdates.get(key)
      if (!row) {
        if (lastSeen) {
          localStorage.removeItem(key)
          lastSeenUpdates.delete(key)
          changedKeys.push(key)
        }
        continue
      }
      lastSeenUpdates.set(key, row.updated_at)
      const nextValue = typeof row.data_value === 'string' ? row.data_value : JSON.stringify(row.data_value)
      if (localStorage.getItem(key) !== nextValue) {
        localStorage.setItem(key, nextValue)
        changedKeys.push(key)
      }
    }
    emitAccountChange(changedKeys, 'remote')
    if (pendingWrites.size === 0) emitSyncStatus('saved')
  } catch (error) {
    emitSyncError(error)
  } finally {
    syncInFlight = false
  }
}

function startAccountSync() {
  clearInterval(syncTimer)
  void pullAccountData()
  syncTimer = setInterval(() => { void pullAccountData() }, 5000)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void sendPendingWrites(); void pullAccountData() })
  window.addEventListener('focus', () => { void pullAccountData() })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void pullAccountData() })
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
  syncGeneration += 1
  clearInterval(syncTimer)
  accountDataReady = false
  activeUserId = userId
  pendingWrites.clear()
  lastSeenUpdates.clear()
  const client = requireSupabase()
  const { data: rows, error } = await client.from('account_data').select('data_key,data_value,updated_at').eq('user_id', userId)
  if (error) throw error
  let data: Record<string, unknown> = Object.fromEntries((rows ?? []).map((row) => [row.data_key, row.data_value]))
  for (const row of rows ?? []) lastSeenUpdates.set(row.data_key, row.updated_at)

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
  emitAccountChange(keys, 'hydrate')
  startAccountSync()
}

export async function flushAccountWrites() {
  if (writeInFlight) await writeInFlight
  while (pendingWrites.size > 0) {
    const saved = await sendPendingWrites()
    if (!saved) throw new Error('Не удалось сохранить последние изменения. Проверьте подключение и попробуйте ещё раз.')
  }
}

export async function signOutAccount() {
  await flushAccountWrites()
  syncGeneration += 1
  accountDataReady = false
  activeUserId = ''
  pendingWrites.clear()
  lastSeenUpdates.clear()
  clearTimeout(writeTimer)
  clearTimeout(retryTimer)
  clearInterval(syncTimer)
  for (const key of keys) localStorage.removeItem(key)
  localStorage.removeItem('dnd-local-user-id')
}

