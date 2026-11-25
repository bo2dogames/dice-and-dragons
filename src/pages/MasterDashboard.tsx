import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  House, ScrollText, Map, Users, PlusCircle, Settings, LogOut, CalendarDays,
  MapPin, ChevronRight, Swords, Shield, Clock, Trash2, Check, ImagePlus,
  BookOpen, Play, Pencil, Save, X, CircleHelp, Heart,
} from 'lucide-react'
import NpcWorkshop from './NpcWorkshop'
import { writeAccountValue, removeAccountValue, useAccountDataSync, emptyAccountSyncList } from '../lib/accountStorage'
import { useAuth } from '../auth/AuthContext'
import { createSharedGame, uploadMedia } from '../lib/sharedSessions'
import MediaImage from '../components/MediaImage'

type Section = 'Главная' | 'Мои кампании' | 'Игровые карты' | 'Бестиарий' | 'NPC' | 'Создать кампанию' | 'Настройки' | 'Сессии'
type Campaign = { id: string; name: string; description: string; system: string; createdAt: string }
type Session = { id: string; campaignId: string; title: string; story: string; storyline?: string; location: string; date: string; status: 'Подготовлена' | 'Проведена' }
type MapEntry = { id: string; name: string; image: string; createdAt: string }
type NpcRecord = { id: string; name: string; race: string; characterClass: string; level: number; weapon: string; hp: number; ac: number; speed: number; proficiency: number; abilities: Record<string, number> }
type PartyMember = { name: string; race: string; characterClass: string; level: number; hp: number; maxHp: number; symbol: string }


function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch { return fallback }
}

const makeId = () => crypto.randomUUID()
const today = () => new Date().toISOString().slice(0, 10)
const controlClass = 'mt-1.5 w-full rounded-xl border border-[#D8CFC3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B87839] focus:ring-2 focus:ring-[#E69A51]/20'
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#292724] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#45413C]'
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#D8CFC3] bg-white px-4 py-2.5 text-sm font-semibold text-[#514A42] transition hover:border-[#E69A51] hover:bg-[#F9F7F3]'

function MasterDashboard() {
  const navigate = useNavigate()
  const { user, signOut, syncStatus, syncError } = useAuth()
  const [activeSection, setActiveSection] = useState<Section>('Главная')
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => readStorage('dnd-campaigns', []))
  const [sessions, setSessions] = useState<Session[]>(() => readStorage('dnd-sessions', []))
  const [maps, setMaps] = useState<MapEntry[]>(() => readStorage('dnd-maps', []))
  const [npcs, setNpcs] = useState<NpcRecord[]>(() => readStorage('dice-and-dragons-npcs', []))
  const [activeCampaignId, setActiveCampaignId] = useState(() => localStorage.getItem('dnd-active-campaign') ?? '')
  const [mapName, setMapName] = useState('')
  const [mapError, setMapError] = useState('')
  const [campaignForm, setCampaignForm] = useState({ name: '', description: '', system: localStorage.getItem('dnd-rules-system') ?? 'D&D 5e' })
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null)
  const [masterName, setMasterName] = useState(() => localStorage.getItem('dnd-master-name') ?? 'Dungeon Master')
  const [rulesSystem, setRulesSystem] = useState(() => localStorage.getItem('dnd-rules-system') ?? 'D&D 5e')
  const [party, setParty] = useState<PartyMember[]>(() => readStorage('dnd-party', []))
  const [notice, setNotice] = useState('')

  useEffect(() => { writeAccountValue('dnd-campaigns', JSON.stringify(campaigns)) }, [campaigns])
  useEffect(() => { writeAccountValue('dnd-sessions', JSON.stringify(sessions)) }, [sessions])
  useEffect(() => { writeAccountValue('dnd-maps', JSON.stringify(maps)) }, [maps])
  useEffect(() => { if (activeCampaignId) writeAccountValue('dnd-active-campaign', activeCampaignId); else removeAccountValue('dnd-active-campaign') }, [activeCampaignId])
  useEffect(() => { writeAccountValue('dnd-master-name', masterName) }, [masterName])
  useEffect(() => { writeAccountValue('dnd-rules-system', rulesSystem) }, [rulesSystem])
  useEffect(() => { writeAccountValue('dnd-party', JSON.stringify(party)) }, [party])

  useAccountDataSync('dnd-campaigns', setCampaigns, emptyAccountSyncList<Campaign>())
  useAccountDataSync('dnd-sessions', setSessions, emptyAccountSyncList<Session>())
  useAccountDataSync('dnd-maps', setMaps, emptyAccountSyncList<MapEntry>())
  useAccountDataSync('dice-and-dragons-npcs', setNpcs, emptyAccountSyncList<NpcRecord>())
  useAccountDataSync('dnd-active-campaign', setActiveCampaignId, '')
  useAccountDataSync('dnd-master-name', setMasterName, 'Dungeon Master')
  useAccountDataSync('dnd-rules-system', setRulesSystem, 'D&D 5e')
  useAccountDataSync('dnd-party', setParty, emptyAccountSyncList<PartyMember>())

  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0]
  const activeSessions = sessions.filter((session) => session.campaignId === activeCampaign?.id)
  const uniqueStories = new Set(activeSessions.map((session) => session.storyline?.trim() || session.story.trim()).filter(Boolean)).size
  const uniqueLocations = new Set(activeSessions.map((session) => session.location.trim()).filter(Boolean)).size
  const completedSessions = activeSessions.filter((session) => session.status === 'Проведена').length
  const npcCount = npcs.length

  const menuItems: { label: Section; icon: typeof House }[] = [
    { label: 'Главная', icon: House }, { label: 'Мои кампании', icon: ScrollText },
    { label: 'Сессии', icon: CalendarDays }, { label: 'Игровые карты', icon: Map },
    { label: 'Бестиарий', icon: Shield }, { label: 'NPC', icon: Users },
    { label: 'Создать кампанию', icon: PlusCircle },
  ]

  const refreshNpcs = () => setNpcs(readStorage('dice-and-dragons-npcs', []))
  const createCampaign = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!campaignForm.name.trim()) return
    const campaign = { id: makeId(), name: campaignForm.name.trim(), description: campaignForm.description.trim(), system: campaignForm.system, createdAt: today() }
    setCampaigns((current) => [...current, campaign])
    setActiveCampaignId(campaign.id)
    setSessions((current) => [...current, { id: makeId(), campaignId: campaign.id, title: 'Первая сессия', storyline: '', story: '', location: '', date: today(), status: 'Подготовлена' }])
    setCampaignForm({ name: '', description: '', system: 'D&D 5e' })
    setNotice('Кампания создана, черновик первой сессии добавлен.')
    setActiveSection('Мои кампании')
  }

  const addSession = () => { if (!activeCampaign) { setActiveSection('Создать кампанию'); return } setSessions((current) => [...current, { id: makeId(), campaignId: activeCampaign.id, title: `Сессия ${activeSessions.length + 1}`, storyline: '', story: '', location: '', date: today(), status: 'Подготовлена' }]) }

  const addMapFile = async (file?: File) => {
    setMapError('')
    if (!file) return
    try {
      const image = await uploadMedia(file, 'maps')
      const map = { id: makeId(), name: mapName.trim() || file.name.replace(/\.[^.]+$/, ''), image, createdAt: today() }
      setMaps((current) => [...current, map])
      writeAccountValue('dice-and-dragons-active-map', map.image)
      setMapName('')
      setNotice(`Карта «${map.name}» добавлена и выбрана для игровой комнаты.`)
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'Не удалось сохранить изображение.')
    }
  }

  const startSharedGame = async () => {
    try {
      const code = await createSharedGame(activeCampaign?.name ?? 'Игровая сессия')
      localStorage.setItem('dnd-shared-game-code', code)
      setNotice(`Код игры ${code} создан. Игроки подключаются по коду или ссылке.`)
      navigate(`/game?join=${code}`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось создать общую игру.') }
  }

  const activateMap = (map: MapEntry) => {
    writeAccountValue('dice-and-dragons-active-map', map.image)
    setNotice(`Карта «${map.name}» выбрана для игровой комнаты.`)
  }

  const removeCampaign = (campaign: Campaign) => {
    if (!window.confirm(`Удалить кампанию «${campaign.name}» и её сессии?`)) return
    const remaining = campaigns.filter((item) => item.id !== campaign.id)
    setCampaigns(remaining)
    setSessions((current) => current.filter((session) => session.campaignId !== campaign.id))
    if (campaign.id === activeCampaignId && remaining[0]) setActiveCampaignId(remaining[0].id)
  }

  const statCards = [
    { label: 'ПРОВЕДЕНО СЕАНСОВ', value: completedSessions, icon: Clock, action: 'Сессии' as Section },
    { label: 'СЮЖЕТНЫЕ ЛИНИИ', value: uniqueStories, icon: ScrollText, action: 'Сессии' as Section },
    { label: 'МЕСТОПОЛОЖЕНИЯ', value: uniqueLocations, icon: MapPin, action: 'Сессии' as Section },
    { label: 'NPC', value: npcCount, icon: Users, action: 'NPC' as Section },
  ]

  return <div className="min-h-screen bg-[#ECE4D9] text-[#292724]">
    <aside className="group fixed left-0 top-0 z-40 flex h-screen w-[76px] flex-col overflow-hidden bg-[#292724] text-white shadow-xl transition-all duration-300 hover:w-[250px] focus-within:w-[250px]">
      <div className="flex h-20 min-w-[250px] items-center border-b border-white/10 px-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E69A51] text-xl font-bold">D</div><span className="ml-4 whitespace-nowrap text-lg font-bold opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">Dice <span className="text-[#E69A51]">&</span> Dragons</span></div>
      <nav className="mt-5 flex flex-1 flex-col gap-1.5 overflow-y-auto px-3">{menuItems.map((item) => { const Icon = item.icon; return <button key={item.label} title={item.label} onClick={() => { setActiveSection(item.label); setNotice(''); if (item.label !== 'NPC') refreshNpcs() }} className={`flex h-11 min-w-[220px] items-center rounded-xl px-3 transition-colors ${activeSection === item.label ? 'bg-[#E69A51] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Icon size={21} className="shrink-0" /><span className="ml-4 whitespace-nowrap text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{item.label}</span></button> })}</nav>
      <div className="flex flex-col gap-2 border-t border-white/10 px-3 py-4"><button onClick={() => setActiveSection('Настройки')} className="flex h-11 min-w-[220px] items-center rounded-xl px-3 text-white/70 hover:bg-white/10"><Settings size={21} /><span className="ml-4 whitespace-nowrap text-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">Настройки</span></button><button onClick={async () => { await signOut(); navigate('/login') }} className="flex h-11 min-w-[220px] items-center rounded-xl px-3 text-white/70 hover:bg-red-500/20 hover:text-red-300"><LogOut size={21} /><span className="ml-4 whitespace-nowrap text-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">Выйти</span></button></div>
    </aside>

    <main className="min-h-screen pl-[76px]">
      <header className="flex min-h-20 flex-wrap items-center justify-between gap-4 border-b border-[#D8CFC3] bg-white px-6 py-4 md:px-10"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B87839]">DUNGEON MASTER / {activeCampaign?.system ?? rulesSystem}</p><h1 className="mt-1 text-2xl font-bold">{activeSection === 'Главная' ? activeCampaign?.name ?? 'Кабинет мастера' : activeSection}</h1><p className="mt-1 text-xs text-gray-400" title={syncError}>{syncStatus === 'saving' ? 'Сохраняем в аккаунт…' : syncStatus === 'error' ? `Ошибка синхронизации${syncError ? `: ${syncError}` : ''}` : 'Сохранено в аккаунте'}</p></div><div className="flex items-center gap-3"><button onClick={() => void startSharedGame()} className={secondaryButton}><Users size={17} /> Создать код игры</button><button onClick={() => navigate('/game')} className={primaryButton}><Swords size={18} /> Игровая комната <ChevronRight size={16} /></button><div className="hidden items-center gap-3 border-l border-gray-200 pl-4 sm:flex"><div className="text-right"><p className="text-sm font-semibold">{masterName || user?.displayName}</p><p className="text-xs text-gray-400">Мастер кампании · {user?.email}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E69A51] font-bold text-white">DM</div></div></div></header>

      {notice && <div role="status" className="mx-auto mt-4 flex max-w-[1500px] items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Закрыть уведомление"><X size={16} /></button></div>}

      {activeSection === 'Главная' && <div className="mx-auto max-w-[1600px] p-5 md:p-7"><div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5"><section className="rounded-2xl border border-[#D8CFC3] bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500"><span className="h-2 w-2 rounded-full bg-green-500" /> Активная кампания · {activeCampaign?.system}</p><h2 className="mt-3 text-2xl font-bold">{activeCampaign?.name ?? 'Создайте свою первую кампанию'}</h2><p className="mt-2 text-sm text-gray-500">{activeCampaign?.description || 'Добавьте описание, сессии и места приключения.'}</p></div><button onClick={() => setActiveSection('Создать кампанию')} className={secondaryButton}><PlusCircle size={17} /> Новая кампания</button></div></section>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{statCards.map((stat) => { const Icon = stat.icon; return <button key={stat.label} onClick={() => setActiveSection(stat.action)} className="rounded-xl border border-[#D8CFC3] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold tracking-wider text-gray-400">{stat.label}</p><Icon size={16} className="text-[#B87839]" /></div><p className="mt-3 text-3xl font-bold">{stat.value}</p></button> })}</section>
          <section className="overflow-hidden rounded-2xl border border-[#D8CFC3] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E2D8] px-6 py-5"><div><p className="text-[11px] font-semibold tracking-[0.18em] text-[#B87839]">БЛИЖАЙШАЯ СЕССИЯ</p><h2 className="mt-2 text-lg font-bold">{activeSessions.find((session) => session.status === 'Подготовлена')?.title ?? 'Сессия не запланирована'}</h2></div><button onClick={() => setActiveSection('Сессии')} className={secondaryButton}>Все сессии <ChevronRight size={16} /></button></div><div className="grid gap-5 p-6 lg:grid-cols-[1fr_220px]"><div><p className="text-xs font-semibold uppercase tracking-wider text-gray-400">СЮЖЕТНАЯ ЛИНИЯ</p><h3 className="mt-2 text-xl font-bold">{activeSessions.find((session) => session.status === 'Подготовлена')?.story || 'Добавьте зацепку и краткое описание сцены.'}</h3><p className="mt-2 text-sm text-gray-500">Подготовьте сцену, добавьте NPC и откройте игровую комнату.</p><button onClick={() => navigate('/game')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#E69A51] px-5 py-3 text-sm font-semibold text-white hover:bg-[#D8873D]"><Play size={17} /> Открыть сессию</button></div><div className="flex flex-col gap-4 rounded-xl border border-[#E5DDD2] bg-[#F9F7F3] p-4"><div><div className="flex items-center gap-2 text-gray-400"><MapPin size={15} /><p className="text-[10px] font-semibold tracking-wider">ЛОКАЦИЯ</p></div><p className="mt-2 text-sm font-semibold">{activeSessions.find((session) => session.status === 'Подготовлена')?.location || 'Не указана'}</p></div><div className="h-px bg-[#E5DDD2]" /><div><div className="flex items-center gap-2 text-gray-400"><CalendarDays size={15} /><p className="text-[10px] font-semibold tracking-wider">ДАТА</p></div><p className="mt-2 text-sm font-semibold">{activeSessions.find((session) => session.status === 'Подготовлена')?.date || '—'}</p></div></div></div></section></div>
        <aside className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><div className="flex items-center justify-between border-b border-[#E9E2D8] pb-4"><div><h2 className="text-lg font-bold">Отряд</h2><p className="mt-1 text-xs text-gray-500">HP можно менять прямо здесь</p></div><span className="rounded-lg bg-[#F4EDE4] px-3 py-2 text-xs font-semibold text-[#9B683A]">{party.length} ИГРОКА</span></div><div className="mt-3 flex flex-col gap-2">{party.map((player) => <article key={player.name} className="rounded-xl border border-[#E9E2D8] bg-[#FDFCFB] p-4"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4EDE4] text-xl">{player.symbol}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h3 className="truncate text-sm font-bold">{player.name}</h3><span className="rounded-md bg-[#F4EDE4] px-2 py-1 text-[10px] font-bold">УР. {player.level}</span></div><p className="mt-1 text-xs text-gray-500">{player.race} · {player.characterClass}</p></div></div><div className="mt-3 flex items-center justify-between text-xs"><span className="flex items-center gap-1 text-gray-500"><Heart size={13} /> HP</span><div className="flex items-center gap-1"><input aria-label={`${player.name}: текущие HP`} type="number" min={0} max={player.maxHp} value={player.hp} onChange={(event) => setParty((current) => current.map((item) => item.name === player.name ? { ...item, hp: Math.max(0, Math.min(item.maxHp, Number(event.target.value) || 0)) } : item))} className="w-14 rounded border border-[#D8CFC3] px-1 py-1 text-center font-bold" /><span>/ {player.maxHp}</span><button aria-label={`Восстановить HP ${player.name}`} title="Восстановить HP" onClick={() => setParty((current) => current.map((item) => item.name === player.name ? { ...item, hp: item.maxHp } : item))} className="ml-1 rounded p-1 text-[#B87839] hover:bg-[#F4EDE4]"><Heart size={14} /></button></div></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEEAE4]"><div className="h-full rounded-full bg-[#E69A51] transition-all" style={{ width: `${player.hp / player.maxHp * 100}%` }} /></div></article>)}</div><button onClick={() => navigate('/game')} className="mt-4 w-full rounded-xl border border-[#D8CFC3] py-3 text-sm font-semibold text-gray-600 hover:border-[#E69A51] hover:text-[#B87839]">Управлять отрядом в игре <ChevronRight size={16} className="inline" /></button></aside>
      </div></div>}

      {activeSection === 'Мои кампании' && <div className="mx-auto max-w-5xl space-y-4 p-5 md:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">Мои кампании</h2><p className="mt-1 text-sm text-gray-500">Выберите активный мир или обновите его описание.</p></div><button onClick={() => setActiveSection('Создать кампанию')} className={primaryButton}><PlusCircle size={17} /> Создать кампанию</button></div>{campaigns.map((campaign) => <article key={campaign.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${activeCampaignId === campaign.id ? 'border-[#E69A51]' : 'border-[#D8CFC3]'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><span className="text-xs font-bold uppercase tracking-wider text-[#B87839]">{campaign.system} · создана {campaign.createdAt}</span>{editingCampaign === campaign.id ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Название<input className={controlClass} value={campaign.name} onChange={(event) => setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, name: event.target.value } : item))} /></label><label className="text-xs font-semibold">Описание<input className={controlClass} value={campaign.description} onChange={(event) => setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, description: event.target.value } : item))} /></label></div> : <><h3 className="mt-2 text-xl font-bold">{campaign.name}</h3><p className="mt-1 text-sm text-gray-500">{campaign.description || 'Без описания'}</p></>}<p className="mt-3 text-xs text-gray-500">{sessions.filter((session) => session.campaignId === campaign.id).length} сессий · {npcs.length} NPC в библиотеке</p></div><div className="flex flex-wrap gap-2">{activeCampaignId !== campaign.id && <button onClick={() => { setActiveCampaignId(campaign.id); setNotice(`Активна кампания «${campaign.name}».`) }} className={secondaryButton}>Сделать активной</button>}<button onClick={() => setEditingCampaign(editingCampaign === campaign.id ? null : campaign.id)} className={secondaryButton}>{editingCampaign === campaign.id ? <><Save size={16} /> Готово</> : <><Pencil size={16} /> Изменить</>}</button><button onClick={() => removeCampaign(campaign)} aria-label={`Удалить кампанию ${campaign.name}`} className="rounded-xl border border-red-200 p-2.5 text-red-600 hover:bg-red-50"><Trash2 size={17} /></button></div></div></article>)}{campaigns.length === 0 && <EmptyState title="Кампаний пока нет" action="Создать кампанию" onAction={() => setActiveSection('Создать кампанию')} />}</div>}

      {activeSection === 'Создать кампанию' && <div className="mx-auto max-w-3xl p-5 md:p-8"><section className="rounded-2xl border border-[#D8CFC3] bg-white p-6 shadow-sm md:p-8"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-wider text-[#B87839]">Новый мир ждёт</p><h2 className="mt-2 text-2xl font-bold">Создать кампанию</h2><p className="mt-2 text-sm text-gray-500">Добавим её в список и подготовим черновик первой сессии.</p></div><form onSubmit={createCampaign} className="space-y-4"><label className="block text-sm font-semibold">Название<input required autoFocus className={controlClass} placeholder="Например, Тайны Серебряного леса" value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} /></label><label className="block text-sm font-semibold">Краткое описание<textarea className={`${controlClass} min-h-28`} placeholder="Мир, конфликт и настроение приключения" value={campaignForm.description} onChange={(event) => setCampaignForm({ ...campaignForm, description: event.target.value })} /></label><label className="block text-sm font-semibold">Правила<select className={controlClass} value={campaignForm.system} onChange={(event) => setCampaignForm({ ...campaignForm, system: event.target.value })}><option>D&D 5e</option><option>D&D 2024</option><option>Свои правила</option></select></label><div className="flex flex-wrap gap-3 pt-2"><button type="submit" className={primaryButton}><PlusCircle size={17} /> Создать кампанию</button><button type="button" onClick={() => setActiveSection('Главная')} className={secondaryButton}>Отмена</button></div></form></section></div>}

      {activeSection === 'Сессии' && <div className="mx-auto max-w-5xl space-y-4 p-5 md:p-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">Сессии · {activeCampaign?.name}</h2><p className="mt-1 text-sm text-gray-500">Подготовьте сцену, локацию и дату; после игры отметьте сессию проведённой.</p></div><button onClick={addSession} className={primaryButton}><PlusCircle size={17} /> Новая сессия</button></div>{activeSessions.map((session) => <article key={session.id} className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-[1fr_180px]"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Название<input className={controlClass} value={session.title} onChange={(event) => setSessions((current) => current.map((item) => item.id === session.id ? { ...item, title: event.target.value } : item))} /></label><label className="text-xs font-semibold">Место<input className={controlClass} value={session.location} placeholder="Название локации" onChange={(event) => setSessions((current) => current.map((item) => item.id === session.id ? { ...item, location: event.target.value } : item))} /></label><label className="text-xs font-semibold">Дата<input type="date" className={controlClass} value={session.date} onChange={(event) => setSessions((current) => current.map((item) => item.id === session.id ? { ...item, date: event.target.value } : item))} /></label><label className="text-xs font-semibold">Статус<select className={controlClass} value={session.status} onChange={(event) => setSessions((current) => current.map((item) => item.id === session.id ? { ...item, status: event.target.value as Session['status'] } : item))}><option>Подготовлена</option><option>Проведена</option></select></label><label className="text-xs font-semibold sm:col-span-2">Сюжет и заметки<textarea className={`${controlClass} min-h-24`} value={session.story} placeholder="Зацепка, сцены, важные события" onChange={(event) => setSessions((current) => current.map((item) => item.id === session.id ? { ...item, story: event.target.value } : item))} /></label></div><div className="flex flex-col justify-between gap-3 rounded-xl bg-[#F9F7F3] p-3"><span className={`self-start rounded-lg px-3 py-1.5 text-xs font-bold ${session.status === 'Проведена' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{session.status}</span><button onClick={() => navigate('/game')} className={primaryButton}><Play size={16} /> Открыть игру</button><button onClick={() => setSessions((current) => current.filter((item) => item.id !== session.id))} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 size={15} /> Удалить</button></div></div></article>)}{activeSessions.length === 0 && <EmptyState title="У этой кампании пока нет сессий" action="Добавить сессию" onAction={addSession} />}</div>}

      {activeSection === 'Игровые карты' && <div className="mx-auto max-w-6xl space-y-5 p-5 md:p-8"><div><h2 className="text-2xl font-bold">Игровые карты</h2><p className="mt-1 text-sm text-gray-500">Загрузите карту, выберите её для комнаты или удалите устаревшую.</p></div><section className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><label className="min-w-56 flex-1 text-xs font-semibold">Название карты<input className={controlClass} value={mapName} onChange={(event) => setMapName(event.target.value)} placeholder="Лес у Блэкспайра" /></label><label className={`${primaryButton} cursor-pointer`}><ImagePlus size={17} /> Загрузить карту<input type="file" accept="image/*" className="hidden" onChange={(event) => { void addMapFile(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>{mapError && <p role="alert" className="w-full text-sm text-red-700">{mapError}</p>}</section><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{maps.map((map) => <article key={map.id} className="overflow-hidden rounded-2xl border border-[#D8CFC3] bg-white shadow-sm"><MediaImage source={map.image} alt={map.name} className="h-48 w-full bg-[#E8E3DA] object-cover" /><div className="p-4"><h3 className="font-bold">{map.name}</h3><p className="mt-1 text-xs text-gray-500">Добавлена {map.createdAt}</p><div className="mt-3 flex gap-2"><button onClick={() => activateMap(map)} className={`${primaryButton} flex-1`}><Check size={16} /> Выбрать</button><button onClick={() => { setMaps((current) => current.filter((item) => item.id !== map.id)); if (localStorage.getItem('dice-and-dragons-active-map') === map.image) removeAccountValue('dice-and-dragons-active-map') }} aria-label={`Удалить карту ${map.name}`} className="rounded-xl border border-red-200 px-3 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button></div></div></article>)}</div>{maps.length === 0 && <EmptyState title="Карт пока нет" action="Выберите изображение выше" onAction={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()} />}</div>}

      {activeSection === 'Бестиарий' && <div className="mx-auto max-w-6xl space-y-5 p-5 md:p-8"><div><h2 className="text-2xl font-bold">Бестиарий</h2><p className="mt-1 text-sm text-gray-500">Здесь появятся ваши собственные противники. Создайте NPC в разделе NPC.</p></div><EmptyState title="Список противников пуст" action="Создать NPC" onAction={() => setActiveSection('NPC')} /></div>}

      {activeSection === 'NPC' && <NpcWorkshop />}

      {activeSection === 'Настройки' && <div className="mx-auto max-w-3xl p-5 md:p-8"><section className="rounded-2xl border border-[#D8CFC3] bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-2xl font-bold">Настройки мастера</h2><p className="mt-1 text-sm text-gray-500">Профиль и правила для новых кампаний.</p></div><label className="mb-4 block text-sm font-semibold">Имя мастера<input className={controlClass} value={masterName} onChange={(event) => setMasterName(event.target.value)} /></label><label className="mb-5 block text-sm font-semibold">Система по умолчанию<select className={controlClass} value={rulesSystem} onChange={(event) => setRulesSystem(event.target.value)}><option>D&D 5e</option><option>D&D 2024</option><option>Свои правила</option></select></label><div className="rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-4 text-sm text-gray-600"><p className="flex items-center gap-2 font-bold text-[#292724]"><CircleHelp size={17} /> О хранении данных</p><p className="mt-2">Кампании, сессии, карты и NPC хранятся в этом браузере. Используйте экспорт браузера или резервную копию профиля, чтобы перенести данные на другое устройство.</p></div></section></div>}
    </main>
  </div>
}

function EmptyState({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return <div className="rounded-2xl border border-dashed border-[#D8CFC3] bg-white p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4EDE4] text-[#B87839]"><BookOpen size={22} /></div><p className="mt-3 font-semibold">{title}</p><button onClick={onAction} className={`${secondaryButton} mt-4`}>{action}</button></div>
}

export default MasterDashboard

