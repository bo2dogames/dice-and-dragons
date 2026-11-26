import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Shield, Footprints, Dices, Sword, Backpack, Sparkles, Plus, Users, CalendarDays, Check, Trash2, BookOpen, ScrollText, RotateCcw } from 'lucide-react'
import { writeAccountValue, removeAccountValue, useAccountDataSync, emptyAccountSyncList } from '../lib/accountStorage'
import { applySharedSnapshot, joinSharedGame, normalizeGameCode } from '../lib/sharedSessions'
import { shareMediaWithGame, uploadMedia } from '../lib/sharedSessions'
import MediaImage from '../components/MediaImage'
import { abilityList, armors, classes as classOptions, races as raceOptions, spellSlotsFor, weapons, type Ability as AbilityKey } from '../data/characterRules'

type Ability = AbilityKey
type Stats = Record<Ability, number>
type Hero = {
  id: string; name: string; race: string; characterClass: string; background: string; level: number
  hp: number; maxHp: number; ac: number; speed: number; proficiency: number; abilities: Stats; hitDie: number; hitDice: number
  weapon: string; damageDie: number; damageBonus: number; attackBonus: number; skills: string[]
  spells: string[]; spellSlots: number; maxSpellSlots: number; inventory: string; notes: string
  successes: number; failures: number; symbol: string; avatar?: string
  armor?: string; shield?: boolean; cantripsKnown?: number; slotsByLevel?: number[]
  armorPenalty?: boolean; shieldPenalty?: boolean; weaponProficient?: boolean
  customFeatures?: { level: number; name: string; description: string }[]
  languages?: string[]; senses?: string; raceTraits?: string[]; classSummary?: string[]
}
type Campaign = { id: string; name: string; system: string }
type Session = { id: string; campaignId: string; title: string; location: string; date: string; status: string; story?: string }
type Membership = { campaignId: string; characterId: string; joinedAt: string }

const abilities = abilityList
const archetypes: Record<string, { scores: Stats; hitDie: number; ac: number; weapon: string; damageDie: number; damageBonus: number; attackBonus: number; skills: string[]; spells: string[]; slots: number; symbol: string }> = {
  Варвар: { scores: { СИЛ: 15, ЛОВ: 13, ТЕЛ: 14, ИНТ: 8, МДР: 12, ХАР: 8 }, hitDie: 12, ac: 10, weapon: 'Боевой топор', damageDie: 12, damageBonus: 3, attackBonus: 5, skills: ['Атлетика', 'Выживание'], spells: [], slots: 0, symbol: '🪓' },
  Плут: { scores: { СИЛ: 8, ЛОВ: 15, ТЕЛ: 13, ИНТ: 12, МДР: 10, ХАР: 14 }, hitDie: 8, ac: 11, weapon: 'Рапира', damageDie: 8, damageBonus: 3, attackBonus: 5, skills: ['Скрытность', 'Ловкость рук'], spells: [], slots: 0, symbol: '🗡️' },
  Жрец: { scores: { СИЛ: 12, ЛОВ: 10, ТЕЛ: 13, ИНТ: 10, МДР: 15, ХАР: 12 }, hitDie: 8, ac: 16, weapon: 'Боевой молот', damageDie: 8, damageBonus: 2, attackBonus: 4, skills: ['Медицина', 'Религия'], spells: ['Лечение ран', 'Благословение', 'Священное пламя'], slots: 2, symbol: '🛡️' },
  Маг: { scores: { СИЛ: 8, ЛОВ: 14, ТЕЛ: 13, ИНТ: 15, МДР: 12, ХАР: 10 }, hitDie: 6, ac: 10, weapon: 'Посох', damageDie: 6, damageBonus: 1, attackBonus: 4, skills: ['Магия', 'История'], spells: ['Волшебная стрела', 'Щит', 'Обнаружение магии'], slots: 2, symbol: '🔮' },
  Следопыт: { scores: { СИЛ: 12, ЛОВ: 15, ТЕЛ: 13, ИНТ: 10, МДР: 14, ХАР: 8 }, hitDie: 10, ac: 14, weapon: 'Длинный лук', damageDie: 8, damageBonus: 3, attackBonus: 5, skills: ['Природа', 'Выживание'], spells: ['Опутывающий удар', 'Лечение ран'], slots: 2, symbol: '🏹' },
  Паладин: { scores: { СИЛ: 15, ЛОВ: 10, ТЕЛ: 13, ИНТ: 8, МДР: 12, ХАР: 14 }, hitDie: 10, ac: 18, weapon: 'Длинный меч', damageDie: 8, damageBonus: 3, attackBonus: 5, skills: ['Атлетика', 'Религия'], spells: ['Благословение', 'Лечение ран'], slots: 2, symbol: '✨' },
  Бард: { scores: { СИЛ: 8, ЛОВ: 14, ТЕЛ: 12, ИНТ: 10, МДР: 13, ХАР: 15 }, hitDie: 8, ac: 11, weapon: 'Рапира', damageDie: 8, damageBonus: 2, attackBonus: 4, skills: ['Выступление', 'Убеждение'], spells: ['Лечащее слово', 'Очарование личности', 'Малая иллюзия'], slots: 2, symbol: '🎵' },
  Воин: { scores: { СИЛ: 15, ЛОВ: 12, ТЕЛ: 14, ИНТ: 10, МДР: 11, ХАР: 8 }, hitDie: 10, ac: 16, weapon: 'Длинный меч', damageDie: 8, damageBonus: 3, attackBonus: 5, skills: ['Атлетика', 'Восприятие'], spells: [], slots: 0, symbol: '⚔️' },
  Волшебник: { scores: { СИЛ: 8, ЛОВ: 14, ТЕЛ: 13, ИНТ: 15, МДР: 12, ХАР: 10 }, hitDie: 6, ac: 10, weapon: 'Посох', damageDie: 6, damageBonus: 1, attackBonus: 4, skills: ['Магия', 'История'], spells: ['Волшебная стрела', 'Щит', 'Обнаружение магии'], slots: 2, symbol: '🔮' },
  Друид: { scores: { СИЛ: 10, ЛОВ: 12, ТЕЛ: 14, ИНТ: 10, МДР: 15, ХАР: 11 }, hitDie: 8, ac: 11, weapon: 'Посох', damageDie: 6, damageBonus: 2, attackBonus: 4, skills: ['Природа', 'Восприятие'], spells: ['Опутывание', 'Лечение ран'], slots: 2, symbol: '🌿' },
  Изобретатель: { scores: { СИЛ: 10, ЛОВ: 12, ТЕЛ: 14, ИНТ: 15, МДР: 11, ХАР: 10 }, hitDie: 8, ac: 14, weapon: 'Лёгкий арбалет', damageDie: 8, damageBonus: 2, attackBonus: 4, skills: ['Магия', 'Расследование'], spells: ['Лечение ран', 'Огненный снаряд'], slots: 2, symbol: '⚙️' },
  Колдун: { scores: { СИЛ: 8, ЛОВ: 14, ТЕЛ: 13, ИНТ: 10, МДР: 12, ХАР: 15 }, hitDie: 8, ac: 11, weapon: 'Кинжал', damageDie: 4, damageBonus: 2, attackBonus: 4, skills: ['Обман', 'Запугивание'], spells: ['Мистический заряд', 'Порча'], slots: 1, symbol: '🕯️' },
  Монах: { scores: { СИЛ: 12, ЛОВ: 15, ТЕЛ: 13, ИНТ: 10, МДР: 14, ХАР: 8 }, hitDie: 8, ac: 10, weapon: 'Посох', damageDie: 6, damageBonus: 2, attackBonus: 4, skills: ['Акробатика', 'Скрытность'], spells: [], slots: 0, symbol: '☯️' },
  Чародей: { scores: { СИЛ: 8, ЛОВ: 13, ТЕЛ: 14, ИНТ: 10, МДР: 12, ХАР: 15 }, hitDie: 6, ac: 10, weapon: 'Кинжал', damageDie: 4, damageBonus: 1, attackBonus: 4, skills: ['Убеждение', 'Магия'], spells: ['Огненный снаряд', 'Щит'], slots: 2, symbol: '✨' },
}
const backgrounds = ['Солдат', 'Мудрец', 'Преступник', 'Послушник', 'Народный герой', 'Артист']
const backgroundSkills: Record<string, string[]> = { Солдат: ['Атлетика', 'Запугивание'], Мудрец: ['Магия', 'История'], Преступник: ['Обман', 'Скрытность'], Послушник: ['Проницательность', 'Религия'], 'Народный герой': ['Уход за животными', 'Выживание'], Артист: ['Акробатика', 'Выступление'] }
const modifier = (score: number) => Math.floor((score - 10) / 2)
const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`
const die = (sides: number) => Math.floor(Math.random() * sides) + 1
const makeId = () => crypto.randomUUID()
const controlClass = 'mt-1.5 w-full rounded-xl border border-[#D8CFC3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B87839] focus:ring-2 focus:ring-[#E69A51]/20'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#292724] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#45413C]'

function readJson<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }

function buildHero(form: { name: string; race: string; characterClass: string; background: string; level: number; scores?: Stats }): Hero {
  const race = raceOptions.find((item) => item.name === form.race) ?? raceOptions[0]
  const archetype = archetypes[form.characterClass] ?? archetypes.Воин
  const scores = { ...(form.scores ?? archetype.scores) }
  for (const ability of abilities) scores[ability] += race.bonuses[ability] ?? 0
  const constitution = modifier(scores.ТЕЛ)
  const proficiency = 2 + Math.floor((form.level - 1) / 4)
  const hp = Math.max(1, archetype.hitDie + constitution + (form.level - 1) * (Math.floor(archetype.hitDie / 2) + 1 + constitution))
  const dexterity = modifier(scores.ЛОВ)
  const classRule = classOptions.find((item) => item.name === (form.characterClass === 'Маг' ? 'Волшебник' : form.characterClass))
  const slotsByLevel = classRule ? spellSlotsFor(classRule, form.level) : []
  const spellSlots = classRule?.casting === 'pact' ? (form.level < 2 ? 1 : form.level < 11 ? 2 : 3) : slotsByLevel.reduce((sum, count) => sum + count, 0)
  const defaultArmor = classRule?.armor.some((item) => item === 'Лёгкие') ? 'Кожаный' : 'Без доспеха'
  const armor = armors.find((item) => item.name === defaultArmor)!
  const armorClass = classRule?.armor.includes('Все') || classRule?.armor.includes(armor.kind) || armor.name === 'Без доспеха'
  const acFromArmor = armor.name === 'Без доспеха' ? 10 + dexterity : armor.base + Math.min(dexterity, armor.maxDex ?? dexterity)
  return {
    id: '', name: form.name.trim(), race: race.name, characterClass: form.characterClass, background: form.background, level: form.level,
    hp, maxHp: hp, ac: acFromArmor + (race.name === 'Кованый' ? 1 : 0), speed: race.speed, proficiency, abilities: scores, hitDie: archetype.hitDie, hitDice: form.level, weapon: archetype.weapon, damageDie: archetype.damageDie,
    damageBonus: archetype.damageBonus, attackBonus: (armorClass ? proficiency : 0) + Math.max(modifier(scores.СИЛ), modifier(scores.ЛОВ)), skills: [...new Set([...archetype.skills, ...(backgroundSkills[form.background] ?? [])])],
    spells: archetype.spells, spellSlots, maxSpellSlots: spellSlots, slotsByLevel,
    inventory: `${archetype.weapon}\nНабор путешественника\n${form.background}`, notes: '', successes: 0, failures: 0, symbol: archetype.symbol,
    armor: defaultArmor, shield: false, cantripsKnown: classRule?.cantrips[Math.min(19, form.level - 1)] ?? 0,
    languages: race.languages, senses: race.darkvision ? `Тёмное зрение ${race.darkvision} фт.` : 'Обычное зрение', raceTraits: race.traits, classSummary: Object.values(classRule?.features ?? {}),
  }
}

function isArmorProficient(characterClass: string, armorName: string, race: string) {
  const armor = armors.find((item) => item.name === armorName)
  const rule = classOptions.find((item) => item.name === (characterClass === 'Маг' ? 'Волшебник' : characterClass))
  if (!armor || armor.name === 'Без доспеха') return true
  if (rule?.armor.includes('Все') || rule?.armor.includes(armor.kind)) return true
  if (race === 'Дварф' && ['Лёгкие','Средние'].includes(armor.kind)) return true
  return false
}

function isShieldProficient(characterClass: string) {
  const rule = classOptions.find((item) => item.name === (characterClass === 'Маг' ? 'Волшебник' : characterClass))
  return Boolean(rule?.armor.includes('Все') || rule?.armor.includes('Щиты') || rule?.armor.includes('Щиты (неметаллические)'))
}

function isWeaponProficient(characterClass: string, weaponName: string, race: string) {
  const weapon = weapons.find((item) => item.name === weaponName)
  const rule = classOptions.find((item) => item.name === (characterClass === 'Маг' ? 'Волшебник' : characterClass))
  if (!weapon || weapon.name === 'Без оружия') return true
  if (raceOptions.find((item) => item.name === race)?.weaponProficiencies?.includes(weaponName)) return true
  if (rule?.weapons === 'простое и воинское') return true
  if (rule?.weapons === 'простое') return weapon.kind === 'простое'
  return Array.isArray(rule?.weapons) && rule.weapons.some((item) => item === 'Простое' ? weapon.kind === 'простое' : item === weaponName)
}

function armorClassFor(character: Pick<Hero, 'characterClass'|'race'|'abilities'>, armorName: string, shield: boolean) {
  const armor = armors.find((item) => item.name === armorName) ?? armors[0]
  const dex = modifier(character.abilities.ЛОВ)
  let base = armor.name === 'Без доспеха' ? 10 + dex : armor.base + Math.min(dex, armor.maxDex ?? dex)
  if (armor.name === 'Без доспеха' && character.characterClass === 'Варвар') base = 10 + dex + modifier(character.abilities.ТЕЛ)
  if (armor.name === 'Без доспеха' && character.characterClass === 'Монах') base = 10 + dex + modifier(character.abilities.МДР)
  if (character.race === 'Тортл' && armor.name === 'Без доспеха') base = 17
  return base + (shield ? 2 : 0) + (character.race === 'Кованый' ? 1 : 0)
}

function startingArmorFor(characterClass: string) {
  const rule = classOptions.find((item) => item.name === characterClass)
  if (rule?.armor.includes('Все')) return 'Кольчуга'
  if (rule?.armor.includes('Средние')) return 'Чешуйчатый'
  if (rule?.armor.includes('Лёгкие')) return 'Кожаный'
  return 'Без доспеха'
}

function speedWithArmor(character: Pick<Hero, 'race'|'speed'|'abilities'>, armorName: string) {
  const armor = armors.find((item) => item.name === armorName)
  if (!armor?.strength || character.abilities.СИЛ >= armor.strength || ['Дварф','Горный дварф','Холмовой дварф'].includes(character.race)) return character.speed
  return Math.max(5, character.speed - 10)
}

function PlayerDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [heroes, setHeroes] = useState<Hero[]>(() => readJson('dnd-player-characters', []))
  const [activeHeroId, setActiveHeroId] = useState(() => localStorage.getItem('dnd-active-player-character') ?? '')
  const [memberships, setMemberships] = useState<Membership[]>(() => readJson('dnd-player-memberships', []))
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => readJson('dnd-campaigns', []))
  const [sessions, setSessions] = useState<Session[]>(() => readJson('dnd-sessions', []))
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', race: 'Человек', characterClass: 'Воин', background: 'Солдат', level: 1 })
  const [baseScores, setBaseScores] = useState<Stats>({ ...archetypes.Воин.scores })
  const [equipment, setEquipment] = useState({ armor: 'Кольчуга', shield: false, weapon: 'Длинный меч' })
  const [customFeatures, setCustomFeatures] = useState<{ level: number; name: string; description: string }[]>([])
  const [spellDraft, setSpellDraft] = useState('')
  const [rollMessage, setRollMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [targetAc, setTargetAc] = useState(12)
  const [activeTab, setActiveTab] = useState<'hero' | 'sessions'>('hero')
  const [joinCode, setJoinCode] = useState('')
  const [avatarError, setAvatarError] = useState('')

  useEffect(() => { writeAccountValue('dnd-player-characters', JSON.stringify(heroes)) }, [heroes])
  useEffect(() => { if (activeHeroId) writeAccountValue('dnd-active-player-character', activeHeroId); else removeAccountValue('dnd-active-player-character') }, [activeHeroId])
  useEffect(() => { writeAccountValue('dnd-player-memberships', JSON.stringify(memberships)) }, [memberships])

  useAccountDataSync('dnd-player-characters', setHeroes, emptyAccountSyncList<Hero>())
  useAccountDataSync('dnd-active-player-character', setActiveHeroId, '')
  useAccountDataSync('dnd-player-memberships', setMemberships, emptyAccountSyncList<Membership>())
  useAccountDataSync('dnd-campaigns', setCampaigns, emptyAccountSyncList<Campaign>())
  useAccountDataSync('dnd-sessions', setSessions, emptyAccountSyncList<Session>())

  useEffect(() => {
    const inviteCode = normalizeGameCode(new URLSearchParams(location.search).get('join') ?? '')
    if (inviteCode) setJoinCode(inviteCode)
  }, [location.search])

  const hero = heroes.find((item) => item.id === activeHeroId) ?? heroes[0]
  const preview = useMemo(() => buildHero({ ...form, scores: baseScores, name: form.name || 'Новый герой' }), [form, baseScores])
  const selectedRace = raceOptions.find((item) => item.name === form.race) ?? raceOptions[0]
  const selectedClass = classOptions.find((item) => item.name === form.characterClass) ?? classOptions[2]
  const selectedSlots = spellSlotsFor(selectedClass, form.level)
  const preparedSessions = sessions.filter((session) => session.status === 'Подготовлена')

  const beginCreate = () => {
    setForm({ name: '', race: 'Человек', characterClass: 'Воин', background: 'Солдат', level: 1 })
    setBaseScores({ ...archetypes.Воин.scores })
    setEquipment({ armor: 'Кольчуга', shield: false, weapon: 'Длинный меч' })
    setCustomFeatures([])
    setSpellDraft('')
    setEditing(false)
    setCreating(true)
  }

  const saveHero = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.name.trim()) return
    const created = { ...buildHero({ ...form, scores: baseScores }), id: makeId() }
    const weaponRule = weapons.find((item) => item.name === equipment.weapon) ?? weapons[0]
    const weaponProficient = isWeaponProficient(form.characterClass, equipment.weapon, form.race)
    const selectedWeaponAbility = weaponRule.ability ?? 'СИЛ'
    created.armor = equipment.armor
    created.shield = equipment.shield
    created.ac = armorClassFor(created, equipment.armor, equipment.shield)
    created.speed = speedWithArmor(created, equipment.armor)
    created.armorPenalty = !isArmorProficient(form.characterClass, equipment.armor, form.race)
    created.shieldPenalty = equipment.shield && !isShieldProficient(form.characterClass)
    created.weapon = equipment.weapon
    created.damageDie = weaponRule.damage
    created.weaponProficient = weaponProficient
    created.attackBonus = modifier(created.abilities[selectedWeaponAbility]) + (weaponProficient ? created.proficiency : 0)
    created.damageBonus = modifier(created.abilities[selectedWeaponAbility])
    created.customFeatures = customFeatures.filter((feature) => feature && (feature.name.trim() || feature.description.trim()))
    created.spells = spellDraft.split(',').map((spell) => spell.trim()).filter(Boolean)
    const raceRule = raceOptions.find((item) => item.name === form.race)!
    created.languages = raceRule.languages
    created.senses = raceRule.darkvision ? `Тёмное зрение ${raceRule.darkvision} фт.` : 'Обычное зрение'
    created.raceTraits = raceRule.traits
    created.classSummary = Object.entries(classOptions.find((item) => item.name === form.characterClass)?.features ?? {}).filter(([level]) => Number(level) <= form.level).map(([level, text]) => `Ур. ${level}: ${text}`)
    if (editing && hero) {
      const updated = { ...created, id: hero.id, hp: Math.min(hero.hp, created.maxHp), inventory: hero.inventory, notes: hero.notes, avatar: hero.avatar }
      setHeroes((current) => current.map((item) => item.id === hero.id ? updated : item))
      syncHeroToParty(updated, hero.name)
      setNotice('Лист героя обновлён.')
    } else {
      setHeroes((current) => [...current, created])
      setActiveHeroId(created.id)
      setNotice(`${created.name} готов к приключению!`)
    }
    setCreating(false)
  }

  const patchHero = (patch: Partial<Hero>) => {
    if (!hero) return
    const updated = { ...hero, ...patch }
    setHeroes((current) => current.map((item) => item.id === hero.id ? updated : item))
    syncHeroToParty(updated)
  }

  const uploadHeroAvatar = async (file?: File) => {
    if (!file || !hero) return
    setAvatarError('')
    try {
      const code = localStorage.getItem('dnd-shared-game-code') || undefined
      patchHero({ avatar: await uploadMedia(file, 'avatars', code) })
    } catch (error) { setAvatarError(error instanceof Error ? error.message : 'Не удалось сохранить портрет.') }
  }

  const syncHeroToParty = (updated: Hero, previousName = updated.name) => {
    if (!memberships.some((membership) => membership.characterId === updated.id)) return
    const party = readJson<Array<Record<string, unknown>>>('dnd-party', [])
    const player = { characterId: updated.id, name: updated.name, race: updated.race, characterClass: updated.characterClass, level: updated.level, hp: updated.hp, maxHp: updated.maxHp, symbol: updated.symbol, avatar: updated.avatar }
    writeAccountValue('dnd-party', JSON.stringify([...party.filter((item) => item.name !== previousName && item.name !== updated.name), player]))
  }

  const rollCheck = (ability: Ability) => {
    if (!hero) return
    const result = die(20)
    setRollMessage(`${ability}: d20 ${result} ${signed(modifier(hero.abilities[ability]))} = ${result + modifier(hero.abilities[ability])}`)
  }

  const makeAttack = () => {
    if (!hero) return
    const attack = die(20)
    const total = attack + hero.attackBonus
    if (attack === 20 || (attack !== 1 && total >= targetAc)) {
      const damage = die(hero.damageDie) + hero.damageBonus
      setRollMessage(`Попадание! d20 ${attack} + ${hero.attackBonus} = ${total} · урон ${damage}`)
    } else setRollMessage(`Промах: d20 ${attack} + ${hero.attackBonus} = ${total} против КД ${targetAc}`)
  }

  const castSpell = (spell: string) => {
    if (!hero) return
    if (hero.armorPenalty || hero.shieldPenalty) { setRollMessage('Нельзя накладывать заклинания: нет владения надетой бронёй или щитом.'); return }
    if (hero.spellSlots <= 0) { setRollMessage('Ячейки заклинаний закончились. Восстанови их продолжительным отдыхом.'); return }
    patchHero({ spellSlots: hero.spellSlots - 1 })
    setRollMessage(`Заклинание «${spell}» применено. Осталось ячеек: ${hero.spellSlots - 1}.`)
  }

  const joinSession = (session: Session) => {
    if (!hero) { setNotice('Сначала создай или выбери героя.'); setActiveTab('hero'); setCreating(true); return }
    const membership = { campaignId: session.campaignId, characterId: hero.id, joinedAt: new Date().toISOString() }
    const nextMemberships = [...memberships.filter((item) => !(item.campaignId === session.campaignId && item.characterId === hero.id)), membership]
    setMemberships(nextMemberships)
    writeAccountValue('dnd-player-memberships', JSON.stringify(nextMemberships))
    writeAccountValue('dnd-active-campaign', session.campaignId)
    writeAccountValue('dnd-active-session', session.id)
    const party = readJson<Array<Record<string, unknown>>>('dnd-party', [])
    const player = { characterId: hero.id, name: hero.name, race: hero.race, characterClass: hero.characterClass, level: hero.level, hp: hero.hp, maxHp: hero.maxHp, symbol: hero.symbol, avatar: hero.avatar }
    writeAccountValue('dnd-party', JSON.stringify([...party.filter((item) => item.characterId !== hero.id && item.name !== hero.name), player]))
    setNotice(`Герой ${hero.name} готов к сессии «${session.title}».`)
    navigate('/game')
  }

  const joinByCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = normalizeGameCode(joinCode)
    if (code) {
      if (!hero) { setNotice('Сначала создай или выбери героя.'); setActiveTab('hero'); setCreating(true); return }
      try {
        const partyMember = { characterId: hero.id, name: hero.name, race: hero.race, characterClass: hero.characterClass, level: hero.level, hp: hero.hp, maxHp: hero.maxHp, symbol: hero.symbol }
        let game = await joinSharedGame(code, partyMember)
        let noticeMessage = `Ты подключился к сессии «${game.title}».`
        if (hero.avatar) {
          try {
            const sharedAvatar = await shareMediaWithGame(hero.avatar, 'avatars', code)
            game = await joinSharedGame(code, { ...partyMember, avatar: sharedAvatar })
            setHeroes((current) => current.map((item) => item.id === hero.id ? { ...item, avatar: sharedAvatar } : item))
          } catch { noticeMessage += ' Портрет героя не удалось добавить в общую комнату.' }
        }
        applySharedSnapshot(game.snapshot)
        localStorage.setItem('dnd-shared-game-code', code)
        const campaignId = String(game.snapshot['dnd-active-campaign'] ?? '')
        if (campaignId) {
          const membership = { campaignId, characterId: hero.id, joinedAt: new Date().toISOString() }
          setMemberships((current) => [...current.filter((item) => !(item.campaignId === campaignId && item.characterId === hero.id)), membership])
          writeAccountValue('dnd-active-campaign', campaignId)
          writeAccountValue('dnd-player-memberships', JSON.stringify([...memberships.filter((item) => !(item.campaignId === campaignId && item.characterId === hero.id)), membership]))
        }
        setNotice(noticeMessage)
        navigate(`/game?join=${code}`)
      } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось подключиться к сессии.') }
      return
    }
    const campaign = campaigns.find((item) => item.id === joinCode.trim() || item.name.toLowerCase() === joinCode.trim().toLowerCase())
    if (!campaign) { setNotice('Кампания не найдена. Пока можно подключиться к кампаниям, сохранённым в этом браузере.'); return }
    const session = preparedSessions.find((item) => item.campaignId === campaign.id)
    if (session) joinSession(session)
    else setNotice('В кампании пока нет подготовленной сессии.')
  }

  const deleteHero = () => {
    if (!hero || !window.confirm(`Удалить героя «${hero.name}»?`)) return
    const rest = heroes.filter((item) => item.id !== hero.id)
    setHeroes(rest)
    setActiveHeroId(rest[0]?.id ?? '')
    setMemberships((current) => current.filter((item) => item.characterId !== hero.id))
  }

  const shortRest = () => {
    if (!hero) return
    if (hero.hitDice <= 0) { setRollMessage('Кости хитов закончились. Восстанови их продолжительным отдыхом.'); return }
    const healing = Math.min(hero.maxHp - hero.hp, die(hero.hitDie) + modifier(hero.abilities.ТЕЛ))
    patchHero({ hp: hero.hp + Math.max(0, healing), hitDice: hero.hitDice - 1 })
    setRollMessage(`Короткий отдых: восстановлено ${Math.max(0, healing)} HP.`)
  }

  const longRest = () => {
    if (!hero) return
    patchHero({ hp: hero.maxHp, hitDice: Math.min(hero.level, hero.hitDice + Math.max(1, Math.floor(hero.level / 2))), spellSlots: hero.maxSpellSlots, successes: 0, failures: 0 })
    setRollMessage('Продолжительный отдых: HP и ячейки заклинаний восстановлены.')
  }

  const heroMemberships = hero ? memberships.filter((item) => item.characterId === hero.id) : []

  return <main className="min-h-screen bg-[#ECE4D9] text-[#292724]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8CFC3] bg-white px-5 py-4 md:px-8"><div className="flex items-center gap-3"><Link to="/dashboard" aria-label="Назад в кабинет" className="rounded-xl border border-[#E5DDD2] p-2 hover:bg-[#F7F4EF]"><ArrowLeft size={18} /></Link><Link to="/" className="text-xl font-bold">Dice <span className="text-[#E69A51]">&</span> Dragons</Link></div><div className="flex items-center gap-2"><button onClick={() => setActiveTab('hero')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'hero' ? 'bg-[#F5E6D5] text-[#A9682E]' : 'hover:bg-[#F7F4EF]'}`}><ScrollText size={15} className="mr-1 inline" />Герой</button><button onClick={() => setActiveTab('sessions')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === 'sessions' ? 'bg-[#F5E6D5] text-[#A9682E]' : 'hover:bg-[#F7F4EF]'}`}><Users size={15} className="mr-1 inline" />Сессии</button><button onClick={() => navigate('/dashboard')} className="rounded-xl border border-[#E5DDD2] px-3 py-2 text-sm font-semibold hover:bg-[#F7F4EF]">Выйти</button></div></header>

    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-7">
      <section className="overflow-hidden rounded-2xl border border-[#5A4B38] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#6C492C] via-[#332B22] to-[#292724] p-6 text-white shadow-lg md:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E69A51]">Лист искателя приключений</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold">Кабинет героя</h1><p className="mt-2 text-sm text-white/70">Создай персонажа, подготовься к приключению и вступи в партию.</p></div><button onClick={() => beginCreate()} className="inline-flex items-center gap-2 rounded-xl bg-[#E69A51] px-5 py-3 text-sm font-bold text-white hover:bg-[#D8873D]"><Plus size={17} /> Создать героя</button></div></section>

      {notice && <div role="status" className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}<button onClick={() => setNotice('')} aria-label="Закрыть"><span aria-hidden>×</span></button></div>}

      {activeTab === 'sessions' ? <section className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Открытые сессии</h2><p className="mt-1 text-sm text-gray-500">Выбери игру мастера или подключись по коду.</p></div><CalendarDays className="text-[#B87839]" /></div>
          {preparedSessions.length ? <div className="mt-4 space-y-3">{preparedSessions.map((session) => { const campaign = campaigns.find((item) => item.id === session.campaignId); const joined = heroMemberships.some((item) => item.campaignId === session.campaignId); return <article key={session.id} className="rounded-xl border border-[#E9E2D8] bg-[#FDFCFB] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#B87839]">{campaign?.system ?? 'D&D'} · {campaign?.name ?? 'Кампания'}</p><h3 className="mt-1 text-lg font-bold">{session.title}</h3><p className="mt-1 text-sm text-gray-500">{session.location || 'Локация уточняется'} · {session.date || 'Дата не указана'}</p>{session.story && <p className="mt-3 max-w-2xl text-sm text-gray-600">{session.story}</p>}</div><button onClick={() => joinSession(session)} className={buttonClass}><Check size={16} />{joined ? 'Войти в сессию' : 'Подключиться'}</button></div></article> })}</div> : <div className="mt-4 rounded-xl border border-dashed border-[#D8CFC3] p-8 text-center"><CalendarDays className="mx-auto text-[#B87839]" /><p className="mt-2 font-semibold">Подготовленных сессий пока нет</p><p className="mt-1 text-sm text-gray-500">Попроси мастера создать кампанию и подготовить сессию в этом браузере.</p></div>}
        </div><section className="h-fit rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><h2 className="font-bold">Код или ссылка приглашения</h2><p className="mt-1 text-xs text-gray-500">Введи код из пяти символов или вставь ссылку мастера.</p><form onSubmit={joinByCode} className="mt-3 space-y-3"><input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Например, 7KQ2M или ссылка" className={controlClass} /><button className={`${buttonClass} w-full`}>Подключиться к игре</button></form></section></div>
        <section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><h3 className="font-bold">Мои приключения</h3>{heroMemberships.length ? <div className="mt-3 flex flex-wrap gap-2">{heroMemberships.map((membership) => <span key={membership.campaignId} className="rounded-lg bg-[#F4EDE4] px-3 py-2 text-sm">{campaigns.find((item) => item.id === membership.campaignId)?.name ?? 'Кампания'}</span>)}</div> : <p className="mt-1 text-sm text-gray-500">Герой пока не вступил ни в одну кампанию.</p>}</section>
      </section> : creating ? <section className="grid items-start gap-5 lg:grid-cols-[1fr_360px]"><form onSubmit={saveHero} className="space-y-5 rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm md:p-7"><div><p className="text-xs font-bold uppercase tracking-wider text-[#B87839]">{editing ? 'Обнови лист' : 'Создание персонажа'}</p><h2 className="mt-1 text-2xl font-bold">Кто отправится в путь?</h2><p className="mt-1 text-sm text-gray-500">Выбери происхождение, класс и предысторию. Основные параметры рассчитаются сами.</p></div>
        <label className="block text-sm font-semibold">Имя героя<input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Например, Элира Звёздный Свет" className={controlClass} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Раса<select value={form.race} onChange={(event) => setForm({ ...form, race: event.target.value })} className={controlClass}>{raceOptions.map((race) => <option key={race.name} value={race.name}>{race.name} · {race.source}</option>)}</select></label><label className="text-sm font-semibold">Класс<select value={form.characterClass} onChange={(event) => { const characterClass = event.target.value; setForm({ ...form, characterClass }); setBaseScores({ ...archetypes[characterClass].scores }); setEquipment({ armor: startingArmorFor(characterClass), shield: false, weapon: archetypes[characterClass].weapon }); setSpellDraft(archetypes[characterClass].spells.join(', ')) }} className={controlClass}>{classOptions.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label className="text-sm font-semibold">Предыстория<select value={form.background} onChange={(event) => setForm({ ...form, background: event.target.value })} className={controlClass}>{backgrounds.map((background) => <option key={background}>{background}</option>)}</select><span className="mt-1 block text-[11px] font-normal text-gray-500">Навыки: {backgroundSkills[form.background]?.join(', ') ?? 'выбери сам'}.</span></label><label className="text-sm font-semibold">Уровень<select value={form.level} onChange={(event) => setForm({ ...form, level: Number(event.target.value) })} className={controlClass}>{Array.from({ length: 20 }, (_, i) => i + 1).map((level) => <option key={level} value={level}>{level} уровень</option>)}</select></label></div>
        <div className="rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-4"><h3 className="text-sm font-bold">Характеристики · стандартный набор</h3><p className="mt-1 text-xs text-gray-500">Распредели 15, 14, 13, 12, 10 и 8. Расовые и предысторические бонусы применяются автоматически.</p><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{abilities.map((ability) => <label key={ability} className="rounded-lg border border-[#E9E2D8] bg-white p-2 text-center"><span className="block text-[10px] font-bold text-gray-500">{ability}</span><select aria-label={`Базовая характеристика ${ability}`} value={baseScores[ability]} onChange={(event) => { const score = Number(event.target.value); if (abilities.some((other) => other !== ability && baseScores[other] === score)) return; setBaseScores({ ...baseScores, [ability]: score }) }} className="mt-1 w-full rounded border border-[#E9E2D8] bg-white p-1 text-center text-lg font-bold">{[15,14,13,12,10,8].map((score) => <option key={score} value={score}>{score}</option>)}</select><span className="text-xs text-[#B87839]">{preview.abilities[ability]} ({signed(modifier(preview.abilities[ability]))})</span></label>)}</div></div>
        <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-[#E9E2D8] bg-white p-4"><h3 className="font-bold">{selectedRace.name} · особенности</h3><p className="mt-1 text-xs text-gray-500">{selectedRace.source} · {selectedRace.size} · скорость {selectedRace.speed} фт. · {selectedRace.darkvision ? `тёмное зрение ${selectedRace.darkvision} фт.` : 'обычное зрение'}</p><p className="mt-2 text-sm"><b>Увеличение характеристик:</b> {Object.entries(selectedRace.bonuses).map(([ability, bonus]) => `${ability} +${bonus}`).join(', ') || 'гибкое; используй настройки мастера'}.</p><p className="mt-1 text-xs text-gray-500">Языки: {selectedRace.languages.join(', ')}.</p>{selectedRace.weaponProficiencies?.length ? <p className="mt-1 text-xs text-gray-500">Оружие расы: {selectedRace.weaponProficiencies.join(', ')}.</p> : null}<ul className="mt-2 list-inside list-disc space-y-1 text-xs text-gray-600">{selectedRace.traits.map((trait) => <li key={trait}>{trait}</li>)}</ul></section><section className="rounded-xl border border-[#E9E2D8] bg-white p-4"><h3 className="font-bold">{selectedClass.name} · класс</h3><p className="mt-1 text-xs text-gray-500">Кость хитов d{selectedClass.hitDie} · спасброски: {selectedClass.saves.join(', ')} · главные характеристики: {selectedClass.primary.join(', ')}</p><p className="mt-2 text-xs"><b>Доспехи:</b> {selectedClass.armor.join(', ') || 'нет'} · <b>оружие:</b> {typeof selectedClass.weapons === 'string' ? selectedClass.weapons : selectedClass.weapons.join(', ')}</p><div className="mt-3 space-y-1 text-xs">{Object.entries(selectedClass.features).filter(([level]) => Number(level) <= form.level).map(([level, feature]) => <p key={level}><b>Уровень {level}:</b> {feature}</p>)}{[4,8,12,16,19].filter((level) => level <= form.level).map((level) => <p key={`asi${level}`}><b>Уровень {level}:</b> увеличение характеристик или черта.</p>)}</div></section></div>
        <section className="rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-4"><h3 className="font-bold">Снаряжение и расчёт КД</h3><p className="mt-1 text-xs text-gray-500">Непривычная броня даёт помеху на проверки и спасброски Силы/Ловкости и запрещает накладывать заклинания. Без владения оружием бонус мастерства к атаке не добавляется.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Доспех<select value={equipment.armor} onChange={(event) => setEquipment({ ...equipment, armor: event.target.value })} className={controlClass}>{armors.map((armor) => <option key={armor.name}>{armor.name}</option>)}</select></label><label className="text-xs font-semibold">Оружие<select value={equipment.weapon} onChange={(event) => setEquipment({ ...equipment, weapon: event.target.value })} className={controlClass}>{weapons.map((weapon) => <option key={weapon.name}>{weapon.name}</option>)}</select></label><label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={equipment.shield} onChange={(event) => setEquipment({ ...equipment, shield: event.target.checked })} />Щит (+2 КД)</label></div><p className="mt-2 text-sm font-bold">Расчётное КД: {armorClassFor(preview, equipment.armor, equipment.shield)} · {isArmorProficient(form.characterClass, equipment.armor, form.race) ? 'владение бронёй есть' : 'нет владения бронёй'} · {isWeaponProficient(form.characterClass, equipment.weapon, form.race) ? 'владение оружием есть' : 'без бонуса мастерства'}</p>{equipment.shield && !isShieldProficient(form.characterClass) && <p className="mt-1 text-xs font-bold text-red-700">Класс не владеет щитами: действуют штрафы за неподготовленную броню.</p>}</section>
        {selectedClass.casting !== 'none' && <section className="rounded-xl border border-[#E9E2D8] bg-white p-4"><h3 className="font-bold">Магия и развитие заклинателя</h3><p className="mt-1 text-sm">Уровень {form.level} · бонус мастерства +{preview.proficiency} · заговоры: {selectedClass.cantrips[form.level - 1] ?? 0} · ячейки: {selectedClass.casting === 'pact' ? `${form.level < 2 ? 1 : form.level < 11 ? 2 : 3} яч. ${Math.min(5, Math.ceil(form.level / 2))}-го круга` : selectedSlots.join(' / ') || 'нет'}.</p><div className="mt-3 overflow-x-auto"><table className="min-w-full text-center text-xs"><thead><tr><th className="p-2 text-left">Ур.</th><th>БМ</th><th>Умения</th><th>Заговоры</th>{Array.from({ length: 9 }, (_, i) => <th key={i}>{i + 1} круг</th>)}</tr></thead><tbody>{Array.from({ length: 20 }, (_, index) => { const level = index + 1; const slots = spellSlotsFor(selectedClass, level); const feature = selectedClass.features[level]; const isPact = selectedClass.casting === 'pact'; return <tr key={level} className={level === form.level ? 'bg-[#F5E6D5] font-bold' : 'border-t border-[#F1ECE5]'}><td className="p-2 text-left">{level}</td><td>+{2 + Math.floor((level - 1) / 4)}</td><td className="max-w-52 text-left">{feature ?? '—'}</td><td>{selectedClass.cantrips[level - 1] ?? 0}</td>{Array.from({ length: 9 }, (_, slot) => <td key={slot}>{isPact ? (slot === Math.min(8, Math.ceil(level / 2) - 1) ? (level < 2 ? 1 : level < 11 ? 2 : 3) : '—') : (slots[slot] ?? '—')}</td>)}</tr>})}</tbody></table></div><label className="mt-3 block text-xs font-semibold">Известные заклинания (через запятую)<input value={spellDraft} onChange={(event) => setSpellDraft(event.target.value)} placeholder="Огненный снаряд, Щит…" className={controlClass} /></label></section>}
        <section className="rounded-xl border border-[#E9E2D8] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Свои умения и заметки по уровням</h3><button type="button" onClick={() => setCustomFeatures((current) => [...current, { level: Math.min(form.level, current.length + 1), name: '', description: '' }])} className="rounded-lg border border-[#D8CFC3] px-3 py-2 text-xs font-bold"><Plus size={14} className="mr-1 inline"/>Добавить умение</button></div><p className="mt-1 text-xs text-gray-500">Список уровней расширяется вместе с уровнем героя (1–20). Запиши способности подкласса, черты и домашние правила.</p><div className="mt-3 space-y-2">{Array.from({ length: form.level }, (_, index) => { const feature = customFeatures[index] ?? { level: index + 1, name: '', description: '' }; const updateFeature = (field: 'name'|'description', value: string) => setCustomFeatures((current) => { const next = Array.from({ length: Math.max(current.length, index + 1) }, (_, row) => current[row] ?? { level: row + 1, name: '', description: '' }); next[index] = { ...feature, level: index + 1, [field]: value }; return next }); return <div key={index} className="grid gap-2 rounded-lg bg-[#F9F7F3] p-2 sm:grid-cols-[100px_1fr_2fr]"><span className="self-center text-xs font-bold">Уровень {index + 1}</span><input value={feature.name} onChange={(event) => updateFeature('name', event.target.value)} placeholder="Название умения" className="rounded-lg border border-[#D8CFC3] px-3 py-2 text-sm"/><input value={feature.description} onChange={(event) => updateFeature('description', event.target.value)} placeholder="Описание / эффект" className="rounded-lg border border-[#D8CFC3] px-3 py-2 text-sm"/></div> })}</div></section>
        <div className="flex flex-wrap gap-3"><button type="submit" className={buttonClass}><Check size={17} />{editing ? 'Сохранить героя' : 'Создать героя'}</button><button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-[#D8CFC3] px-4 py-2.5 text-sm font-semibold hover:bg-[#F9F7F3]">Отмена</button></div>
      </form><aside className="rounded-2xl border border-[#D8CFC3] bg-[#292724] p-5 text-white shadow-lg"><h3 className="font-bold">Лист искателя приключений</h3><p className="mt-2 text-sm text-white/70">Параметры, здоровье, атаки и заклинания будут рассчитаны по выбранным расе и классу.</p><div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-white/65"><BookOpen size={15} className="mr-1 inline text-[#E69A51]" />Создайте своего героя с нуля и настройте его лист после сохранения.</div></aside></section>
      : hero ? <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D8CFC3] bg-white p-4 shadow-sm"><label className="flex items-center gap-2 text-sm font-semibold"><span>Активный герой</span><select value={hero.id} onChange={(event) => setActiveHeroId(event.target.value)} className="rounded-lg border border-[#D8CFC3] bg-[#F9F7F3] px-3 py-2">{heroes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.characterClass}</option>)}</select></label><div className="flex flex-wrap gap-2"><button onClick={() => { const race = raceOptions.find((item) => item.name === hero.race) ?? raceOptions[0]; const cls = hero.characterClass === 'Маг' ? 'Волшебник' : hero.characterClass; setForm({ name: hero.name, race: hero.race, characterClass: cls, background: hero.background, level: hero.level }); setBaseScores({ СИЛ: hero.abilities.СИЛ - (race.bonuses.СИЛ ?? 0), ЛОВ: hero.abilities.ЛОВ - (race.bonuses.ЛОВ ?? 0), ТЕЛ: hero.abilities.ТЕЛ - (race.bonuses.ТЕЛ ?? 0), ИНТ: hero.abilities.ИНТ - (race.bonuses.ИНТ ?? 0), МДР: hero.abilities.МДР - (race.bonuses.МДР ?? 0), ХАР: hero.abilities.ХАР - (race.bonuses.ХАР ?? 0) }); setEquipment({ armor: hero.armor ?? 'Без доспеха', shield: hero.shield ?? false, weapon: hero.weapon }); setCustomFeatures(hero.customFeatures ?? []); setSpellDraft(hero.spells.join(', ')); setEditing(true); setCreating(true) }} className="rounded-xl border border-[#D8CFC3] px-3 py-2 text-sm font-semibold hover:bg-[#F9F7F3]">Изменить лист</button><button onClick={() => setActiveTab('sessions')} className={buttonClass}><Users size={16} /> Найти сессию</button></div></div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="space-y-5"><section className="overflow-hidden rounded-2xl border border-[#5A4B38] bg-white shadow-sm"><div className="flex flex-wrap items-start gap-4 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#6C492C] via-[#332B22] to-[#292724] p-6 text-white"><label title="Загрузить портрет героя" className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-[#E69A51]/50 bg-[#E69A51]/15 text-3xl">{hero.avatar ? <MediaImage source={hero.avatar} alt={`Портрет ${hero.name}`} className="h-full w-full object-cover" /> : hero.symbol}<input type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadHeroAvatar(event.target.files?.[0]); event.currentTarget.value = '' }} /></label><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#E69A51]">{hero.race} · {hero.characterClass} · {hero.background}</p><h2 className="mt-1 text-2xl font-bold">{hero.name}</h2><p className="mt-1 text-sm text-white/65">Уровень {hero.level} · бонус мастерства +{hero.proficiency} · {hero.skills.join(', ')}</p>{avatarError && <p role="alert" className="mt-1 text-xs text-red-200">{avatarError}</p>}</div><button onClick={deleteHero} aria-label="Удалить героя" className="rounded-lg border border-white/15 p-2 text-white/70 hover:bg-red-500/20 hover:text-red-200"><Trash2 size={17} /></button></div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4"><div className="rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-3"><p className="flex items-center gap-1 text-xs text-gray-500"><Shield size={14} /> КД</p><p className="mt-1 text-2xl font-bold">{hero.ac}</p></div><div className="rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-3"><p className="flex items-center gap-1 text-xs text-gray-500"><Footprints size={14} /> Скорость</p><p className="mt-1 text-2xl font-bold">{hero.speed} фт.</p></div><div className="rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-3"><p className="flex items-center gap-1 text-xs text-gray-500"><Dices size={14} /> Инициатива</p><p className="mt-1 text-2xl font-bold">{signed(modifier(hero.abilities.ЛОВ))}</p></div><div className="rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-3"><p className="text-xs text-gray-500">Восприятие</p><p className="mt-1 text-2xl font-bold">{10 + modifier(hero.abilities.МДР)}</p></div></div>
        </section>

        <section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-bold"><Heart className="text-red-500" size={19} /> Здоровье и отдых</h3><p className="mt-1 text-sm text-gray-500">Текущие хиты сохраняются и видны мастеру.</p></div><div className="flex items-center gap-2"><input aria-label="Текущие HP" type="number" min={0} max={hero.maxHp} value={hero.hp} onChange={(event) => patchHero({ hp: Math.max(0, Math.min(hero.maxHp, Number(event.target.value) || 0)) })} className="w-20 rounded-xl border border-[#D8CFC3] px-3 py-2 text-center text-lg font-bold" /><span className="font-bold">/ {hero.maxHp}</span><span className="text-xs text-gray-500">HP</span></div></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-[#EEEAE4]"><div className={`h-full transition-all ${hero.hp / hero.maxHp < 0.3 ? 'bg-red-500' : 'bg-[#E69A51]'}`} style={{ width: `${hero.hp / hero.maxHp * 100}%` }} /></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => patchHero({ hp: Math.max(0, hero.hp - 1) })} className="rounded-lg border border-[#D8CFC3] px-3 py-2 text-sm">−1 HP</button><button onClick={() => patchHero({ hp: Math.min(hero.maxHp, hero.hp + 1) })} className="rounded-lg border border-[#D8CFC3] px-3 py-2 text-sm">+1 HP</button><button onClick={shortRest} className="rounded-lg border border-[#D8CFC3] px-3 py-2 text-sm"><RotateCcw size={14} className="mr-1 inline" />Короткий отдых</button><button onClick={longRest} className="rounded-lg bg-[#F4EDE4] px-3 py-2 text-sm font-semibold text-[#9B683A]">Продолжительный отдых</button></div><div className="mt-4 border-t border-[#E9E2D8] pt-3"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Спасброски от смерти</p><div className="flex gap-4"><div className="flex items-center gap-1 text-xs">Успехи {Array.from({ length: 3 }, (_, index) => <button key={`s${index}`} aria-label={`Отметить успех ${index + 1}`} onClick={() => patchHero({ successes: hero.successes === index + 1 ? index : index + 1 })} className={`h-4 w-4 rounded-full border ${index < hero.successes ? 'border-green-600 bg-green-500' : 'border-gray-400 bg-white'}`} />)}</div><div className="flex items-center gap-1 text-xs">Провалы {Array.from({ length: 3 }, (_, index) => <button key={`f${index}`} aria-label={`Отметить провал ${index + 1}`} onClick={() => patchHero({ failures: hero.failures === index + 1 ? index : index + 1 })} className={`h-4 w-4 rounded-full border ${index < hero.failures ? 'border-red-600 bg-red-500' : 'border-gray-400 bg-white'}`} />)}</div></div></div></div></section>

        <section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><h3 className="text-lg font-bold">Характеристики и проверки</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{abilities.map((ability) => <button key={ability} onClick={() => rollCheck(ability)} className="rounded-xl border border-[#E9E2D8] bg-[#F9F7F3] p-3 text-left transition hover:border-[#E69A51] hover:bg-[#F5E6D5]"><span className="text-xs font-bold text-gray-500">{ability}</span><span className="float-right text-xl font-bold">{hero.abilities[ability]}</span><span className="mt-1 block text-sm font-semibold text-[#B87839]">Проверка {signed(modifier(hero.abilities[ability]))}</span></button>)}</div>{rollMessage && <p role="status" className="mt-3 rounded-xl bg-[#292724] px-4 py-3 text-sm font-semibold text-[#FFD08A]">{rollMessage}</p>}</section>
        <section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><h3 className="text-lg font-bold">Особенности персонажа</h3><p className="mt-1 text-xs text-gray-500">{hero.race} · {hero.languages?.join(', ') ?? 'Общий'} · {hero.senses ?? 'Обычное зрение'} · размер {raceOptions.find((item) => item.name === hero.race)?.size ?? 'Средний'}</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h4 className="text-xs font-bold uppercase tracking-wide text-[#B87839]">Расовые особенности</h4><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">{(hero.raceTraits ?? raceOptions.find((item) => item.name === hero.race)?.traits ?? []).map((trait) => <li key={trait}>{trait}</li>)}</ul></div><div><h4 className="text-xs font-bold uppercase tracking-wide text-[#B87839]">Классовые умения</h4><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">{(hero.classSummary ?? []).map((feature) => <li key={feature}>{feature}</li>)}{(hero.customFeatures ?? []).filter((feature) => feature.level <= hero.level && feature.description.trim()).map((feature, index) => <li key={`${feature.level}-${index}`}><b>Ур. {feature.level} · {feature.name || 'Своё умение'}:</b> {feature.description}</li>)}</ul></div></div></section>

        <div className="grid gap-5 md:grid-cols-2"><section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-lg font-bold"><Sword size={18} className="text-[#B87839]" /> Атака</h3><p className="mt-1 text-sm text-gray-500">{hero.weapon} · попадание +{hero.attackBonus} · урон 1к{hero.damageDie}{signed(hero.damageBonus)}</p><label className="mt-3 block text-xs font-semibold">КД цели<input type="number" min={1} max={30} value={targetAc} onChange={(event) => setTargetAc(Math.max(1, Number(event.target.value) || 1))} className={controlClass} /></label><button onClick={makeAttack} className="mt-3 w-full rounded-xl bg-[#7B3028] px-4 py-3 font-bold text-white hover:bg-[#60241F]"><Sword size={16} className="mr-1 inline" /> Бросить атаку</button></section>
          <section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-lg font-bold"><Sparkles size={18} className="text-[#B87839]" /> Заклинания</h3><p className="mt-1 text-sm text-gray-500">Ячейки: {hero.spellSlots}/{hero.maxSpellSlots}</p>{hero.spells.length ? <div className="mt-3 space-y-2">{hero.spells.map((spell) => <button key={spell} onClick={() => castSpell(spell)} className="w-full rounded-lg border border-[#E9E2D8] px-3 py-2 text-left text-sm hover:border-[#E69A51]">{spell}<span className="float-right text-xs text-[#B87839]">Применить</span></button>)}</div> : <p className="mt-3 rounded-lg bg-[#F9F7F3] p-3 text-sm text-gray-500">У этого класса нет подготовленных заклинаний в быстром списке.</p>}</section></div>

        <section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-lg font-bold"><Backpack size={18} className="text-[#B87839]" /> Экипировка и снаряжение</h3><p className="mt-1 text-sm text-gray-500">Выбранная броня и оружие автоматически пересчитывают КД, попадание и урон.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Доспех<select value={hero.armor ?? 'Без доспеха'} onChange={(event) => { const armor = event.target.value; patchHero({ armor, ac: armorClassFor(hero, armor, hero.shield ?? false), armorPenalty: !isArmorProficient(hero.characterClass, armor, hero.race) }) }} className={controlClass}>{armors.map((armor) => <option key={armor.name}>{armor.name}</option>)}</select></label><label className="text-xs font-semibold">Оружие<select value={hero.weapon} onChange={(event) => { const weaponName = event.target.value; const weapon = weapons.find((item) => item.name === weaponName) ?? weapons[0]; const proficient = isWeaponProficient(hero.characterClass, weaponName, hero.race); const ability = weapon.ability ?? 'СИЛ'; patchHero({ weapon: weaponName, damageDie: weapon.damage, weaponProficient: proficient, attackBonus: modifier(hero.abilities[ability]) + (proficient ? hero.proficiency : 0), damageBonus: modifier(hero.abilities[ability]) }) }} className={controlClass}>{weapons.map((weapon) => <option key={weapon.name}>{weapon.name}</option>)}</select></label><label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={hero.shield ?? false} onChange={(event) => { const shield = event.target.checked; patchHero({ shield, ac: armorClassFor(hero, hero.armor ?? 'Без доспеха', shield), shieldPenalty: shield && !isShieldProficient(hero.characterClass) }) }} />Щит (+2 КД)</label></div>{hero.armorPenalty && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800">Нет владения этим типом брони: помеха на проверки/спасброски Силы и Ловкости, атаки и нельзя накладывать заклинания.</p>}{hero.shieldPenalty && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800">Класс не владеет щитами: действуют ограничения неподготовленного ношения брони.</p>}{hero.weaponProficient === false && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">Нет владения этим оружием: бонус мастерства не добавляется к атаке.</p>}<p className="mt-2 text-sm font-bold">КД {hero.ac} · попадание {signed(hero.attackBonus)} · урон 1к{hero.damageDie}{signed(hero.damageBonus)}</p><textarea aria-label="Снаряжение" value={hero.inventory} onChange={(event) => patchHero({ inventory: event.target.value })} className="mt-3 min-h-32 w-full rounded-xl border border-[#D8CFC3] p-3 text-sm leading-6 outline-none focus:border-[#B87839]" /><label className="mt-3 block text-xs font-semibold">Личные заметки<textarea value={hero.notes} onChange={(event) => patchHero({ notes: event.target.value })} placeholder="Квесты, обещания, зацепки…" className="mt-1.5 min-h-24 w-full rounded-xl border border-[#D8CFC3] p-3 text-sm outline-none focus:border-[#B87839]" /></label></section>
        </div>

        <aside className="space-y-5"><section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Подключение к сессии</h3><Users size={18} className="text-[#B87839]" /></div><p className="mt-1 text-sm text-gray-500">Вступи в подготовленную игру мастера.</p><button onClick={() => setActiveTab('sessions')} className={`${buttonClass} mt-4 w-full`}>Найти партию <CalendarDays size={16} /></button>{heroMemberships.length > 0 && <p className="mt-3 rounded-lg bg-green-50 p-3 text-xs font-semibold text-green-800">Герой уже состоит в {heroMemberships.length} кампании.</p>}</section>
          <section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm"><h3 className="text-lg font-bold">Быстрый лист</h3><p className="mt-1 text-sm text-gray-500">Навыки · {hero.skills.join(' · ')}</p><p className="mt-3 text-xs font-bold uppercase tracking-wider text-gray-400">Модификаторы спасбросков</p><div className="mt-2 grid grid-cols-2 gap-2">{abilities.map((ability) => <div key={ability} className="flex justify-between rounded-lg bg-[#F9F7F3] px-3 py-2 text-xs"><span>{ability}</span><b>{signed(modifier(hero.abilities[ability]))}</b></div>)}</div></section>
          <section className="rounded-2xl border border-[#D8CFC3] bg-[#292724] p-5 text-white shadow-sm"><h3 className="flex items-center gap-2 font-bold"><BookOpen size={17} className="text-[#E69A51]" /> Подсказки игроку</h3><ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-5 text-white/75"><li>Опиши, что герой хочет сделать; мастер подскажет нужную проверку.</li><li>В бою следи за HP, ячейками и очередью ходов.</li><li>Если не знаешь, что делать, спроси союзников или осмотри окружение.</li></ul></section>
        </aside></div></section>
      : <section className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="rounded-2xl border border-[#D8CFC3] bg-white p-6 shadow-sm"><div className="text-5xl">🛡️</div><h2 className="mt-4 text-2xl font-bold">Пора создать героя</h2><p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">Создайте персонажа с нуля. Сайт рассчитает основные параметры, после чего вы сможете вступить в доступную сессию.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={() => beginCreate()} className={buttonClass}><Plus size={17} /> Создать своего героя</button><button onClick={() => setActiveTab('sessions')} className="rounded-xl border border-[#D8CFC3] px-4 py-2.5 text-sm font-semibold hover:bg-[#F9F7F3]">Посмотреть сессии</button></div></div><div className="rounded-2xl border border-[#D8CFC3] bg-[#292724] p-5 text-white shadow-lg"><h3 className="font-bold">Приключение начинается с тебя</h3><p className="mt-3 text-sm leading-6 text-white/70">Выбери расу, класс и предысторию. Характеристики, здоровье и снаряжение подготовятся автоматически.</p></div></section>}
    </div>
  </main>
}

export default PlayerDashboard

