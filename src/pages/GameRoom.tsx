
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Dices,
  MessageSquare,
  Map,
  Eye,
  EyeOff,
  X,
  Check,
  Copy,
  Plus,
  Minus,
  Sword,
  Shield,
  Heart,
  Settings,
  Maximize2,
  RotateCcw,
  Target,
  BookOpen,
  NotebookPen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { writeAccountValue, useAccountDataSync, emptyAccountSyncList } from '../lib/accountStorage'
import { applySharedSnapshot, gameInviteLink, readSharedGame, readSharedSnapshot, sharedSnapshotsMatch, updateSharedGame, uploadMedia } from '../lib/sharedSessions'
import MediaImage from '../components/MediaImage'

type AbilityScores = Record<'СИЛ' | 'ЛОВ', number>
type CampaignNpc = {
  id: string; name: string; race: string; characterClass: string; level: number; weapon: string
  hp: number; ac: number; speed: number; proficiency: number; abilities: AbilityScores
}
type MapToken = {
  id: number; name: string; type: 'player' | 'npc'; x: number; y: number; symbol: string
  avatar?: string
  hp?: number; maxHp?: number; ac?: number; weapon?: string; attackBonus?: number; damageBonus?: number
}
type DiceRoll = { die: string; rolls: number[]; total: number; label?: string }
type PartyMember = { name: string; race: string; characterClass: string; level: number; hp: number; maxHp: number; symbol: string; avatar?: string }
const randomDie = (sides: number) => Math.floor(Math.random() * sides) + 1

function GameRoom() {
  const location = useLocation()
  const requestedCode = new URLSearchParams(location.search).get('join')?.toUpperCase() ?? ''
  const [sharedCode, setSharedCode] = useState(() => requestedCode || localStorage.getItem('dnd-shared-game-code') || '')
  const [sharedStatus, setSharedStatus] = useState('')
  const [activeTool, setActiveTool] = useState('move')
  const [zoom, setZoom] = useState(100)
  const [mapImage, setMapImage] = useState<string | null>(() => localStorage.getItem('dice-and-dragons-active-map'))
  const [mapImageError, setMapImageError] = useState('')
  const [gridVisible, setGridVisible] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [selectedDie, setSelectedDie] = useState('D20')
  const [diceResult, setDiceResult] = useState<DiceRoll | null>(null)
  const [diceCount, setDiceCount] = useState(1)
  const [attackLog, setAttackLog] = useState('')
  const [attackerName, setAttackerName] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [combatStarted, setCombatStarted] = useState(false)
  const [initiative, setInitiative] = useState<{ id: string; name: string; result: number; kind: 'player' | 'npc' }[]>([])
  const [round, setRound] = useState(1)
  const [activeCombatant, setActiveCombatant] = useState(0)
  const [dmPanel, setDmPanel] = useState<'notes' | 'reference' | null>(null)
  const [dmNotes, setDmNotes] = useState(() => localStorage.getItem('dice-and-dragons-dm-notes') ?? '')
  const [checkModifier, setCheckModifier] = useState(2)
  const [visibilityAreas, setVisibilityAreas] = useState<{ x: number; y: number }[]>([])
  const [fogAreas, setFogAreas] = useState<{ x: number; y: number }[]>([])
  const [tokens, setTokens] = useState<MapToken[]>(() => {
    try { return JSON.parse(localStorage.getItem('dice-and-dragons-map-tokens') ?? '[]') as MapToken[] } catch { return [] }
  })
  const mapCanvasRef = useRef<HTMLDivElement>(null)
  const tokenDragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null)
  const nextTokenIdRef = useRef(tokens.reduce((maxId, token) => Math.max(maxId, token.id), 0) + 1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [availableNpcs, setAvailableNpcs] = useState<CampaignNpc[]>(() => {
    try {
      const saved = localStorage.getItem('dice-and-dragons-npcs')
      return saved ? JSON.parse(saved) as CampaignNpc[] : []
    } catch { return [] }
  })
  const [characters, setCharacters] = useState<PartyMember[]>(() => {
    try {
      const saved = localStorage.getItem('dnd-party')
      return saved ? JSON.parse(saved) as PartyMember[] : []
    } catch { return [] }
  })

  useEffect(() => { writeAccountValue('dnd-party', JSON.stringify(characters)) }, [characters])
  useEffect(() => { writeAccountValue('dice-and-dragons-map-tokens', JSON.stringify(tokens)) }, [tokens])

  useEffect(() => () => {
    if (mapImage) URL.revokeObjectURL(mapImage)
  }, [mapImage])

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', updateFullscreen)
    return () => document.removeEventListener('fullscreenchange', updateFullscreen)
  }, [])

  useEffect(() => {
    writeAccountValue('dice-and-dragons-dm-notes', dmNotes)
  }, [dmNotes])

  useAccountDataSync('dice-and-dragons-active-map', setMapImage, null as string | null)
  useAccountDataSync('dice-and-dragons-map-tokens', setTokens, emptyAccountSyncList<MapToken>())
  useAccountDataSync('dice-and-dragons-dm-notes', setDmNotes, '')
  useAccountDataSync('dice-and-dragons-npcs', setAvailableNpcs, emptyAccountSyncList<CampaignNpc>())
  useAccountDataSync('dnd-party', setCharacters, emptyAccountSyncList<PartyMember>())

  useEffect(() => {
    if (!requestedCode) return
    setSharedCode(requestedCode)
    localStorage.setItem('dnd-shared-game-code', requestedCode)
  }, [requestedCode])

  useEffect(() => {
    if (!sharedCode) return
    let alive = true
    let pulling = false
    const pull = async () => {
      if (pulling || document.visibilityState === 'hidden') return
      pulling = true
      try {
        const game = await readSharedGame(sharedCode)
        if (!alive) return
        if (!sharedSnapshotsMatch(readSharedSnapshot(), game.snapshot)) applySharedSnapshot(game.snapshot)
        setSharedStatus(`Сессия ${game.code} · ${game.members?.length ?? 0} игроков`)
      } catch (error) {
        if (alive) setSharedStatus(error instanceof Error ? error.message : 'Ошибка подключения к сессии.')
      } finally { pulling = false }
    }
    void pull()
    const timer = window.setInterval(() => { void pull() }, 2500)
    return () => { alive = false; window.clearInterval(timer) }
  }, [sharedCode])

  useEffect(() => {
    if (!sharedCode) return
    let timer: number | undefined
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ source: string }>).detail
      if (detail?.source !== 'local') return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { void updateSharedGame(sharedCode).catch((error) => setSharedStatus(error instanceof Error ? error.message : 'Не удалось сохранить сессию.')) }, 400)
    }
    window.addEventListener('dnd-account-data-change', handleChange)
    return () => { window.removeEventListener('dnd-account-data-change', handleChange); window.clearTimeout(timer) }
  }, [sharedCode])

  const addCharacterToMap = (character: typeof characters[number]) => {
    const canvas = mapCanvasRef.current
    const inset = 48
    const index = tokens.length
    const width = canvas?.clientWidth ?? 400
    const height = canvas?.clientHeight ?? 300
    setTokens((currentTokens) => [...currentTokens, {
      id: nextTokenIdRef.current++,
      name: character.name,
      type: 'player',
      symbol: character.symbol,
      avatar: character.avatar,
      x: Math.min(width - inset, 90 + (index % 4) * 64),
      y: Math.min(height - inset, 90 + Math.floor(index / 4) * 64),
    }])
  }

  const addNpcToMap = (npc: CampaignNpc) => {
    const canvas = mapCanvasRef.current
    const index = tokens.length
    const abilityModifier = (score: number) => Math.floor((score - 10) / 2)
    const attackAbility = Math.max(abilityModifier(npc.abilities.СИЛ), abilityModifier(npc.abilities.ЛОВ))
    setTokens((currentTokens) => [...currentTokens, {
      id: nextTokenIdRef.current++, name: npc.name, type: 'npc', symbol: '👹',
      hp: npc.hp, maxHp: npc.hp, ac: npc.ac, weapon: npc.weapon,
      attackBonus: attackAbility + npc.proficiency, damageBonus: attackAbility,
      x: Math.min((canvas?.clientWidth ?? 400) - 48, 110 + (index % 4) * 64),
      y: Math.min((canvas?.clientHeight ?? 300) - 48, 100 + Math.floor(index / 4) * 64),
    }])
  }

  const attackNpc = (token: MapToken) => {
    if (token.type !== 'npc' || token.hp === undefined) return
    const attacker = characters.find((character) => character.name === attackerName) ?? characters[0]
    if (!attacker) {
      setAttackLog('Добавьте персонажа игрока, чтобы атаковать NPC.')
      return
    }
    const attackerClass = attacker.characterClass.toLowerCase()
    const attackBonus = attackerClass.includes('воин') || attackerClass.includes('плут') ? 5 : 4
    const damageDie = attackerClass.includes('маг') ? 10 : attackerClass.includes('плут') ? 6 : 8
    const damageBonus = attackerClass.includes('воин') || attackerClass.includes('плут') ? 3 : 2
    const d20 = randomDie(20)
    const attackTotal = d20 + attackBonus
    setDiceResult({ die: 'd20', rolls: [d20], total: attackTotal, label: `${attacker.name} атакует ${token.name} · d20 + ${attackBonus}` })
    if (d20 === 20 || (d20 !== 1 && attackTotal >= (token.ac ?? 10))) {
      const damage = randomDie(damageDie) + damageBonus
      setTokens((current) => current.map((item) => item.id === token.id ? { ...item, hp: Math.max(0, (item.hp ?? 0) - damage) } : item))
      setAttackLog(`${attacker.name} попадает по ${token.name}: ${attackTotal} против КД ${token.ac ?? 10}, урон ${damage}. Осталось ${Math.max(0, token.hp - damage)} HP.`)
    } else {
      setAttackLog(`${attacker.name} промахивается по ${token.name}: ${attackTotal} против КД ${token.ac ?? 10}.`)
    }
  }

  const handleMapImage = async (file?: File) => {
    setMapImageError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMapImageError('Выберите файл изображения.')
      return
    }

    try {
      const imageUrl = await uploadMedia(file, 'maps', sharedCode || undefined)
      setMapImage(imageUrl)
      writeAccountValue('dice-and-dragons-active-map', imageUrl)
    } catch (error) { setMapImageError(error instanceof Error ? error.message : 'Не удалось сохранить изображение.') }
  }

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = mapCanvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scale = zoom / 100
    return {
      x: (clientX - rect.left - (scale - 1) * canvas.offsetWidth / 2) / scale,
      y: (clientY - rect.top - (scale - 1) * canvas.offsetHeight / 2) / scale,
    }
  }

  const moveToken = (id: number, clientX: number, clientY: number) => {
    const drag = tokenDragRef.current
    const canvas = mapCanvasRef.current
    const point = getCanvasPoint(clientX, clientY)
    if (!drag || drag.id !== id || !canvas || !point) return

    const inset = 26
    const rawX = point.x - drag.offsetX
    const rawY = point.y - drag.offsetY
    const x = Math.max(inset, Math.min(canvas.offsetWidth - inset, snapToGrid ? Math.round(rawX / 40) * 40 : rawX))
    const y = Math.max(inset, Math.min(canvas.offsetHeight - inset, snapToGrid ? Math.round(rawY / 40) * 40 : rawY))
    setTokens((currentTokens) => currentTokens.map((token) => token.id === id ? { ...token, x, y } : token))
  }

  const tools = [
    { id: 'move', name: 'Перемещение', icon: Map },
    { id: 'visibility', name: 'Область видимости', icon: Eye },
    { id: 'fog', name: 'Туман войны', icon: EyeOff },
    { id: 'dice', name: 'Бросок кубиков', icon: Dices },
  ]
  const activeCombatantName = initiative[activeCombatant]?.name
  const activeCampaignName = (() => {
    try {
      const campaigns = JSON.parse(localStorage.getItem('dnd-campaigns') ?? '[]') as { id: string; name: string }[]
      const activeId = localStorage.getItem('dnd-active-campaign')
      return campaigns.find((campaign) => campaign.id === activeId)?.name ?? 'Пепельная корона'
    } catch { return 'Пепельная корона' }
  })()
  const currentSession = (() => {
    try {
      const activeId = localStorage.getItem('dnd-active-campaign')
      const selectedSessionId = localStorage.getItem('dnd-active-session')
      const sessions = JSON.parse(localStorage.getItem('dnd-sessions') ?? '[]') as { id: string; campaignId: string; status: string; title: string; location: string; storyline?: string }[]
      return sessions.find((session) => session.campaignId === activeId && session.id === selectedSessionId)
        ?? sessions.find((session) => session.campaignId === activeId && session.status === 'Подготовлена')
    } catch { return undefined }
  })()

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(sharedCode ? gameInviteLink(sharedCode) : window.location.href)
      setInviteCopied(true)
      window.setTimeout(() => setInviteCopied(false), 2000)
    } catch {
      setInviteCopied(false)
    }
  }

  const rollDie = (die = selectedDie, count = diceCount, label?: string) => {
    const rolls = Array.from({ length: Math.max(1, Math.min(20, count)) }, () => randomDie(Number(die.slice(1))))
    setDiceResult({ die, rolls, total: rolls.reduce((sum, roll) => sum + roll, 0), label })
  }

  const rollCheck = (difficulty: number) => {
    const die = randomDie(20)
    const total = die + checkModifier
    setDiceResult({ die: 'D20', rolls: [die], total, label: `Проверка против СЛ ${difficulty} (${total >= difficulty ? 'успех' : 'неудача'})` })
  }

  const toggleCombat = () => {
    if (combatStarted) {
      setCombatStarted(false)
      setInitiative([])
      setRound(1)
      setActiveCombatant(0)
      return
    }
    const combatants = [
      ...characters.map((character, index) => ({ id: `player-${index}`, name: character.name, kind: 'player' as const })),
      ...tokens.filter((token) => token.type === 'npc').map((token) => ({ id: `npc-${token.id}`, name: token.name, kind: 'npc' as const })),
    ]
    setInitiative(combatants.map((combatant) => ({ ...combatant, result: randomDie(20) }))
      .sort((first, second) => second.result - first.result))
    setRound(1)
    setActiveCombatant(0)
    setCombatStarted(true)
  }

  const advanceTurn = () => {
    if (!initiative.length) return
    if (activeCombatant >= initiative.length - 1) {
      setActiveCombatant(0)
      setRound((current) => current + 1)
    } else setActiveCombatant((current) => current + 1)
  }

  const rewindTurn = () => {
    if (!initiative.length) return
    if (activeCombatant === 0) {
      setActiveCombatant(initiative.length - 1)
      setRound((current) => Math.max(1, current - 1))
    } else setActiveCombatant((current) => current - 1)
  }

  const activateMapTool = (clientX: number, clientY: number) => {
    const point = getCanvasPoint(clientX, clientY)
    if (!point) return
    if (activeTool === 'visibility') setVisibilityAreas((areas) => [...areas, point])
    if (activeTool === 'fog') {
      const cell = { x: Math.round(point.x / 40) * 40, y: Math.round(point.y / 40) * 40 }
      setFogAreas((areas) => areas.some((area) => area.x === cell.x && area.y === cell.y)
        ? areas.filter((area) => area.x !== cell.x || area.y !== cell.y)
        : [...areas, cell])
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#ECE4D9] text-[#292724]">
      
      
      {/* Верхняя панель */}
      <header className="z-10 flex h-[70px] shrink-0 items-center justify-between border-b border-[#D8CFC3] bg-white px-5 shadow-sm">

        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5DDD2] transition hover:bg-[#F7F4EF]"
          >
            <ArrowLeft size={19} />
          </button>

          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#B87839]">
              DICE & DRAGONS
            </p>
            <h1 className="text-base font-bold">{activeCampaignName}</h1>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 md:flex">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          {sharedStatus || 'Игровая сессия'}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setDmPanel('reference')} title="Шпаргалка мастера" className="flex h-10 items-center gap-2 rounded-xl border border-[#E5DDD2] px-3 text-sm font-medium hover:bg-[#F7F4EF]"><BookOpen size={17} /><span className="hidden sm:inline">Шпаргалка</span></button>
          <button onClick={() => setDmPanel('notes')} title="Заметки мастера" className="flex h-10 items-center gap-2 rounded-xl border border-[#E5DDD2] px-3 text-sm font-medium hover:bg-[#F7F4EF]"><NotebookPen size={17} /><span className="hidden sm:inline">Заметки</span></button>
          <button onClick={copyInviteLink} className="flex h-10 items-center gap-2 rounded-xl border border-[#E5DDD2] px-3 text-sm font-medium hover:bg-[#F7F4EF]" title={sharedCode ? `Код игры: ${sharedCode}` : 'Сначала создай код игры в кабинете мастера'}>
            {inviteCopied ? <Check size={17} /> : <Copy size={17} />}
            <span className="hidden sm:inline">{inviteCopied ? 'Ссылка скопирована' : sharedCode ? `Пригласить · ${sharedCode}` : 'Пригласить'}</span>
          </button>

          <button onClick={() => setSettingsOpen(true)} aria-label="Настройки карты" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5DDD2] hover:bg-[#F7F4EF]">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Рабочая область */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[250px_minmax(0,1fr)_280px]">

        {/* Левая панель */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto rounded-2xl border border-[#D8CFC3] bg-white p-4 shadow-sm lg:flex">

          <div className="border-b border-[#E9E2D8] pb-4">
            <p className="text-[10px] font-semibold tracking-wider text-gray-400">
              ИНСТРУМЕНТЫ МАСТЕРА
            </p>
            <h2 className="mt-1 text-lg font-bold">Управление картой</h2>
          </div>

          <div className="mt-4 space-y-2">
            {tools.map((tool) => {
              const Icon = tool.icon
              const active = activeTool === tool.id

              return (
                <button
                  key={tool.id}
                  onClick={() => tool.id === 'dice' ? (setActiveTool(tool.id), rollDie()) : setActiveTool(tool.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                    active
                      ? 'bg-[#F5E6D5] font-semibold text-[#A9682E]'
                      : 'text-gray-600 hover:bg-[#F7F4EF]'
                  }`}
                >
                  <Icon size={18} />
                  {tool.name}
                </button>
              )
            })}
          </div>

          <div className="mt-6 border-t border-[#E9E2D8] pt-5">
            <p className="text-[10px] font-semibold tracking-wider text-gray-400">
              ИНФОРМАЦИЯ О СЕССИИ
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-gray-400">Текущая локация</p>
                <p className="mt-1 text-sm font-semibold">{currentSession?.location || 'Не указана'}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400">Сюжетная линия</p>
                <p className="mt-1 text-sm font-semibold">{currentSession?.storyline || currentSession?.title || 'Нет активной сюжетной линии'}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400">Номер сессии</p>
                <p className="mt-1 text-sm font-semibold">02</p>
              </div>
            </div>
          </div>

          <div className="mt-auto rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-3">
            <p className="text-xs font-semibold">Активный инструмент</p>
            <p className="mt-1 text-xs text-[#B87839]">{tools.find((tool) => tool.id === activeTool)?.name}</p>
          </div>
        </aside>

        {/* Центральная игровая карта */}
        <section className="flex min-h-[400px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8CFC3] bg-white shadow-sm">

          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#E9E2D8] px-4">
            <div className="flex items-center gap-2">
              <Map size={18} className="text-[#B87839]" />
              <h2 className="text-sm font-bold">Игровая карта</h2>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F7F4EF]"
              >
                <Minus size={16} />
              </button>

              <span className="w-12 text-center text-xs font-semibold">{zoom}%</span>

              <button
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F7F4EF]"
              >
                <Plus size={16} />
              </button>

              <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : mapCanvasRef.current?.requestFullscreen()} className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F7F4EF]" aria-label={isFullscreen ? 'Выйти из полного экрана' : 'Открыть карту на весь экран'}>
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden overscroll-none bg-[#E8E3DA]"
            onWheel={(event) => {
              setZoom((currentZoom) => Math.min(200, Math.max(50, currentZoom + (event.deltaY < 0 ? 10 : -10))))
            }}
          >
            <div
              className={`pointer-events-none absolute inset-0 ${gridVisible ? 'opacity-40' : 'opacity-0'}`}
              style={{
                backgroundImage: 'linear-gradient(#B9B0A3 1px, transparent 1px), linear-gradient(90deg, #B9B0A3 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            <button
              onClick={() => {
                setZoom(100)
                setPosition({ x: 0, y: 0 })
                setVisibilityAreas([])
              }}
              className="absolute right-4 top-4 z-20 rounded-xl border border-[#D8CFC3] bg-white px-4 py-2 text-sm font-semibold text-[#292724] shadow-sm transition hover:bg-[#F4EDE4]"
            >
              <RotateCcw size={14} className="mr-2 inline" />
              Сбросить вид
            </button>

            <div
              className={`map-canvas relative flex h-[75%] w-[80%] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#B9AA95] bg-[#DCD3C4]/70 text-center ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              ref={mapCanvasRef}
              style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom / 100})` }}
              onPointerDown={(event) => {
                if (event.button !== 0 || (event.target as HTMLElement).closest('[data-character-token], [data-map-control]')) return
                if (activeTool === 'visibility' || activeTool === 'fog') {
                  activateMapTool(event.clientX, event.clientY)
                  return
                }
                event.currentTarget.setPointerCapture(event.pointerId)
                setIsDragging(true)
                setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y })
              }}
              onPointerMove={(event) => {
                if (!isDragging) return
                setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y })
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                setIsDragging(false)
              }}
              onPointerCancel={() => setIsDragging(false)}
            >
              {isFullscreen && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => document.exitFullscreen()} className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-lg border border-[#D8CFC3] bg-white px-3 py-2 text-sm font-bold text-[#292724] shadow-lg"><X size={16} /> Выйти из полного экрана</button>}
              {diceResult && <div role="status" className="pointer-events-none absolute bottom-4 right-4 z-30 max-w-[75%] rounded-xl border border-[#E69A51]/50 bg-[#292724]/95 px-4 py-3 text-left text-white shadow-xl">
                <p className="text-xs font-bold uppercase tracking-wider text-[#E69A51]">{diceResult.label ?? 'Бросок кубиков'}</p>
                <p className="mt-1 text-sm font-semibold">{diceResult.die}{diceResult.rolls.length > 1 ? ` × ${diceResult.rolls.length}` : ''}: [{diceResult.rolls.join(', ')}] <span className="text-[#FFD08A]">= {diceResult.total}</span></p>
              </div>}
              {mapImage ? (
                <MediaImage source={mapImage} alt="Игровая карта" className="pointer-events-none h-full w-full select-none object-contain" />
              ) : (
                <>
                  <div className="text-5xl">🌲</div>
                  <h3 className="mt-4 text-lg font-bold">Игровая карта</h3>
                  <p className="mt-2 max-w-xs text-sm text-gray-600">
                    Здесь будет располагаться карта приключения с фигурками персонажей, противниками и объектами
                  </p>
                </>
              )}

              {visibilityAreas.map((area, index) => <div key={`vision-${index}`} className="pointer-events-none absolute z-[5] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-300 bg-sky-300/20 shadow-[0_0_18px_rgba(125,211,252,0.45)]" style={{ left: area.x, top: area.y }} />)}
              {fogAreas.map((area, index) => <button key={`fog-${index}`} type="button" aria-label="Снять участок тумана" onPointerDown={(event) => event.stopPropagation()} onClick={() => setFogAreas((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="absolute z-[6] h-10 w-10 -translate-x-1/2 -translate-y-1/2 border border-[#71695D] bg-[#514A42]/90 shadow-inner" style={{ left: area.x, top: area.y }} />)}

              {tokens.map((token) => (
                <div
                  key={token.id}
                  data-character-token
                  className={`absolute z-10 flex touch-none cursor-grab flex-col items-center select-none active:cursor-grabbing ${combatStarted && activeCombatantName === token.name ? 'rounded-xl outline outline-4 outline-emerald-400 outline-offset-2' : ''}`}
                  style={{ left: token.x, top: token.y, transform: 'translate(-50%, -50%)' }}
                  onPointerDown={(event) => {
                    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
                    event.stopPropagation()
                    const point = getCanvasPoint(event.clientX, event.clientY)
                    if (!point) return
                    tokenDragRef.current = { id: token.id, offsetX: point.x - token.x, offsetY: point.y - token.y }
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={(event) => {
                    moveToken(token.id, event.clientX, event.clientY)
                  }}
                  onPointerUp={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                    tokenDragRef.current = null
                  }}
                  onPointerCancel={() => { tokenDragRef.current = null }}
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#E69A51] bg-[#292724] text-xl shadow-lg">{token.avatar ? <MediaImage source={token.avatar} alt={token.name} className="h-full w-full object-cover" /> : token.symbol}</div>
                  <span className="mt-1 rounded-md bg-[#292724] px-2 py-1 text-xs font-semibold text-white shadow">{token.name}</span>
                  {token.type === 'npc' && <span className="rounded bg-red-950/90 px-1.5 py-0.5 text-[10px] font-bold text-red-100">{token.hp}/{token.maxHp} HP · КД {token.ac}</span>}
                  <button
                    type="button"
                    aria-label={`Убрать ${token.name} с карты`}
                    className="absolute -right-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-red-600 text-white shadow hover:bg-red-700"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      setTokens((currentTokens) => currentTokens.filter((currentToken) => currentToken.id !== token.id))
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              <label data-map-control className="absolute bottom-4 right-4 z-20 cursor-pointer rounded-xl bg-[#292724] px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-[#45413C]">
                {mapImage ? 'Изменить карту' : 'Загрузить карту'}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                  const file = event.target.files?.[0]
                  void handleMapImage(file)
                  event.currentTarget.value = ''
                }} />
              </label>
              {mapImageError && <p role="alert" className="absolute bottom-16 right-4 z-20 max-w-64 rounded-lg bg-red-700 px-3 py-2 text-xs font-medium text-white shadow">{mapImageError}</p>}
            </div>

            <div className="absolute bottom-4 left-4 rounded-lg border border-[#D8CFC3] bg-white/90 px-3 py-2 text-xs font-medium shadow-sm">
              Масштаб: {zoom}%
            </div>
          </div>        </section>

        {/* Правая панель */}
        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto lg:flex">

          {/* Персонажи */}
          <section className="rounded-2xl border border-[#D8CFC3] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E9E2D8] pb-3">
              <div>
                <h2 className="text-base font-bold">Персонажи</h2>
                <p className="mt-1 text-xs text-gray-400">Участники отряда</p>
              </div>
              <Users size={19} className="text-[#B87839]" />
            </div>

            <div className="mt-3 space-y-3">
              {characters.map((character) => (
                <div key={character.name} className="rounded-xl border border-[#E9E2D8] p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F4EDE4] text-lg">
                      {character.symbol}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{character.name}</p>
                      <p className="truncate text-[10px] text-gray-500">{character.race} · {character.characterClass}</p>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500">
                      LVL {character.level}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Heart size={13} className="text-red-400" />
                      HP
                    </span>
                    <span className="flex items-center gap-1"><input aria-label={`${character.name}: текущие HP`} type="number" min={0} max={character.maxHp} value={character.hp} onChange={(event) => setCharacters((current) => current.map((item) => item.name === character.name ? { ...item, hp: Math.max(0, Math.min(item.maxHp, Number(event.target.value) || 0)) } : item))} className="w-12 rounded border border-[#D8CFC3] px-1 py-0.5 text-center font-bold" />/{character.maxHp}</span>
                  </div>

                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#E69A51]"
                      style={{ width: `${(character.hp / character.maxHp) * 100}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => addCharacterToMap(character)}
                    className="mt-3 w-full rounded-lg bg-[#292724] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#45413C]"
                  >
                    Добавить на карту
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#D8CFC3] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E9E2D8] pb-3"><div><h2 className="text-base font-bold">NPC кампании</h2><p className="mt-1 text-xs text-gray-400">Добавляйте противников и атакуйте</p></div><Target size={18} className="text-[#B87839]" /></div>
            <label className="mt-3 block text-xs font-semibold text-gray-600">Кто атакует<select value={attackerName} onChange={(event) => setAttackerName(event.target.value)} className="mt-1 w-full rounded-lg border border-[#D8CFC3] bg-[#F9F7F3] px-3 py-2 text-sm text-[#292724]">{characters.map((character) => <option key={character.name} value={character.name}>{character.name} · {character.characterClass}</option>)}</select></label>
            <div className="mt-3 space-y-3">
              {availableNpcs.map((npc) => {
                const token = tokens.find((item) => item.type === 'npc' && item.name === npc.name)
                return <div key={npc.id} className="rounded-xl border border-[#E9E2D8] bg-[#FDFCFB] p-3">
                  <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{npc.name}</p><p className="text-[10px] text-gray-500">{npc.race} · {npc.characterClass} · КД {npc.ac}</p></div><span className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{token?.hp ?? npc.hp}/{npc.hp} HP</span></div>
                  {token ? <button type="button" disabled={token.hp === 0} onClick={() => attackNpc(token)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#7B3028] px-3 py-2 text-xs font-bold text-white hover:bg-[#60241F] disabled:cursor-not-allowed disabled:opacity-50"><Sword size={14} /> {token.hp === 0 ? 'Повержен' : 'Атаковать'}</button>
                    : <button type="button" onClick={() => addNpcToMap(npc)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#292724] px-3 py-2 text-xs font-bold text-white hover:bg-[#45413C]"><Plus size={14} /> Добавить на карту</button>}
                </div>
              })}
              {availableNpcs.length === 0 && <p className="rounded-xl bg-[#F9F7F3] p-3 text-xs text-gray-500">Список NPC пуст. Сначала создайте персонажей в разделе NPC кабинета мастера.</p>}
            </div>
            {attackLog && <p role="status" className="mt-3 rounded-lg border border-[#E9E2D8] bg-[#F9F7F3] p-3 text-xs font-medium">{attackLog}</p>}
          </section>

          {/* Инициатива */}
          <section className="rounded-2xl border border-[#D8CFC3] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Инициатива</h2>
              <Sword size={18} className="text-[#B87839]" />
            </div>

            <div className="mt-3 rounded-xl border border-dashed border-[#D8CFC3] bg-[#F9F7F3] p-4 text-center">
              <Shield size={22} className="mx-auto text-gray-400" />
              {combatStarted ? (
                <div className="mt-2 space-y-1 text-left">
                  <p className="mb-2 text-center text-xs font-semibold text-emerald-700">Раунд {round} · ходит {activeCombatantName}</p>
                  {initiative.map((entry, index) => <p key={entry.id} className={`flex justify-between rounded-md px-2 py-1 text-xs ${index === activeCombatant ? 'bg-emerald-100 font-bold text-emerald-900' : 'bg-white'}`}><span>{index + 1}. {entry.name}{entry.kind === 'npc' ? ' · NPC' : ''}</span><b>{entry.result}</b></p>)}
                  <div className="mt-3 flex gap-2"><button onClick={rewindTurn} aria-label="Предыдущий ход" className="flex flex-1 items-center justify-center rounded-lg border border-[#D8CFC3] bg-white py-2 hover:bg-[#F4EDE4]"><ChevronUp size={16} /> Назад</button><button onClick={advanceTurn} className="flex flex-1 items-center justify-center rounded-lg bg-[#292724] py-2 text-xs font-bold text-white hover:bg-[#45413C]">Следующий ход <ChevronDown size={16} /></button></div>
                </div>
              ) : <p className="mt-2 text-xs font-semibold text-gray-600">Бой ещё не начался</p>}
              <button onClick={toggleCombat} className="mt-3 rounded-lg bg-[#292724] px-4 py-2 text-xs font-semibold text-white hover:bg-[#45413C]">
                {combatStarted ? 'Завершить бой' : 'Начать бой'}
              </button>
            </div>
          </section>

          {/* Кубики */}
          <section className="rounded-2xl border border-[#D8CFC3] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Кубики</h2>
              <Dices size={18} className="text-[#B87839]" />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {['D4', 'D6', 'D8', 'D10', 'D12', 'D20', 'D100'].map((dice) => (
                <button
                  key={dice}
                  onClick={() => setSelectedDie(dice)}
                  aria-pressed={selectedDie === dice}
                  className={`rounded-lg border py-2 text-xs font-bold transition ${selectedDie === dice ? 'border-[#E69A51] bg-[#F5E6D5] text-[#A9682E]' : 'border-[#E9E2D8] bg-[#F9F7F3] hover:border-[#E69A51] hover:bg-[#F5E6D5]'}`}
                >
                  {dice}
                </button>
              ))}
            </div>

            <label className="mt-3 flex items-center justify-between text-xs font-semibold text-gray-600">Количество кубиков<input type="number" min={1} max={20} value={diceCount} onChange={(event) => setDiceCount(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} className="w-20 rounded-lg border border-[#D8CFC3] bg-[#F9F7F3] px-3 py-2 text-center text-sm text-[#292724]" /></label>

            <button onClick={() => rollDie()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#E69A51] py-3 text-sm font-semibold text-white transition hover:bg-[#D8873D]">
              <Dices size={17} />
              Бросить {diceCount > 1 ? `${diceCount} кубика · ` : ''}{selectedDie}
            </button>
            {diceResult && <p role="status" className="mt-3 rounded-lg bg-[#292724] px-3 py-2 text-center text-sm font-bold text-[#FFD08A]">{diceResult.die}{diceResult.rolls.length > 1 ? ` × ${diceResult.rolls.length}` : ''}: {diceResult.rolls.join(' + ')} = {diceResult.total}</p>}
          </section>

          {/* Чат */}
          <section className="rounded-2xl border border-[#D8CFC3] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-[#B87839]" />
              <h2 className="text-base font-bold">Игровой чат</h2>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Здесь будет общий чат участников сессии
            </p>
          </section>

        </aside>
      </main>
      {dmPanel && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setDmPanel(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="dm-panel-title" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#B9AA95] bg-[#F9F7F3] shadow-2xl">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9E2D8] bg-[#F9F7F3] px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#B87839]">Инструменты мастера</p><h2 id="dm-panel-title" className="mt-1 text-xl font-bold">{dmPanel === 'notes' ? 'Заметки сессии' : 'Шпаргалка по игре'}</h2></div><button onClick={() => setDmPanel(null)} aria-label="Закрыть" className="rounded-lg p-2 hover:bg-[#ECE4D9]"><X size={19} /></button></header>
          {dmPanel === 'notes' ? <div className="p-5"><p className="mb-3 text-sm text-gray-600">Личные заметки мастера сохраняются в этом браузере автоматически.</p><textarea autoFocus value={dmNotes} onChange={(event) => setDmNotes(event.target.value)} placeholder={'Цель сцены…\nВажные NPC и их мотивы…\nУлики, награды, что изменить в следующей сессии…'} className="min-h-72 w-full resize-y rounded-xl border border-[#D8CFC3] bg-white p-4 text-sm leading-6 outline-none focus:border-[#B87839] focus:ring-2 focus:ring-[#E69A51]/20" /><p className="mt-2 text-right text-xs text-gray-400">Сохранено автоматически · {dmNotes.length} знаков</p></div> : <div className="space-y-5 p-5">
            <section className="rounded-xl border border-[#E9E2D8] bg-white p-4"><h3 className="font-bold">Проверка характеристики</h3><p className="mt-1 text-sm text-gray-600">Брось d20, добавь модификатор подходящей характеристики и сравни с СЛ. Назначай СЛ по ситуации.</p><div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-xs font-semibold text-gray-600">Модификатор<select value={checkModifier} onChange={(event) => setCheckModifier(Number(event.target.value))} className="mt-1 block rounded-lg border border-[#D8CFC3] bg-[#F9F7F3] px-3 py-2 text-sm text-[#292724]">{[-1, 0, 1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value >= 0 ? `+${value}` : value}</option>)}</select></label>{[10, 15, 20].map((difficulty) => <button key={difficulty} onClick={() => rollCheck(difficulty)} className="rounded-lg bg-[#292724] px-4 py-2 text-sm font-bold text-white hover:bg-[#45413C]">Проверить СЛ {difficulty}</button>)}</div></section>
            <section className="rounded-xl border border-[#E9E2D8] bg-white p-4"><h3 className="font-bold">Бой по шагам</h3><ol className="mt-2 list-inside list-decimal space-y-1 text-sm leading-6 text-gray-600"><li>Определи, кто участвует, и начни инициативу.</li><li>В начале хода напомни активному участнику о скорости и доступных действиях.</li><li>Для атаки сравни результат броска с КД цели; при попадании сними урон с HP.</li><li>Отмечай состояния и важные эффекты, затем передавай ход дальше.</li></ol></section>
            <section className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#E9E2D8] bg-white p-4"><h3 className="font-bold">Быстрые напоминания</h3><ul className="mt-2 space-y-2 text-sm text-gray-600"><li><b>Укрытие:</b> половинное даёт +2 к КД и спасброскам Ловкости, укрытие на три четверти — +5.</li><li><b>Концентрация:</b> после получения урона цель делает спасбросок Телосложения.</li><li><b>Вдохновение:</b> предложи его за яркое отыгрывание или смелую идею.</li></ul></div><div className="rounded-xl border border-[#E9E2D8] bg-white p-4"><h3 className="font-bold">Чтобы сцена двигалась</h3><ul className="mt-2 list-inside list-disc space-y-2 text-sm text-gray-600"><li>Спроси игроков, что они хотят сделать, если замешкались.</li><li>Дай заметную зацепку и несколько способов на неё отреагировать.</li><li>Если исход неинтересен или очевиден, продолжи сцену без лишнего броска.</li></ul></div></section>
            <p className="text-xs text-gray-400">Короткая памятка для D&D 5e; конкретные решения и СЛ остаются за мастером.</p>
          </div>}
        </section>
      </div>}
      {settingsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSettingsOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="map-settings-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-[#B9AA95] bg-[#F9F7F3] p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between"><h2 id="map-settings-title" className="text-lg font-bold">Настройки карты</h2><button onClick={() => setSettingsOpen(false)} aria-label="Закрыть настройки" className="rounded-lg p-2 hover:bg-[#ECE4D9]"><X size={18} /></button></div>
          <label className="flex items-center justify-between border-t border-[#E9E2D8] py-3 text-sm"><span>Показывать сетку</span><input type="checkbox" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} className="accent-[#B87839]" /></label>
          <label className="flex items-center justify-between border-t border-[#E9E2D8] py-3 text-sm"><span>Привязка фигурок к сетке</span><input type="checkbox" checked={snapToGrid} onChange={(event) => setSnapToGrid(event.target.checked)} className="accent-[#B87839]" /></label>
          <button onClick={() => setSettingsOpen(false)} className="mt-3 w-full rounded-xl bg-[#292724] py-3 text-sm font-semibold text-white hover:bg-[#45413C]">Готово</button>
        </section>
      </div>}
    </div>
  )
}

export default GameRoom

