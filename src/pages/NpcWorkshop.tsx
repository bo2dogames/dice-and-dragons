import { useEffect, useMemo, useState } from 'react'
import { writeAccountValue } from '../lib/accountStorage'
import { Plus, Shield, Heart, Footprints, Swords, Trash2, ScrollText, Sparkles } from 'lucide-react'

type Ability = 'СИЛ' | 'ЛОВ' | 'ТЕЛ' | 'ИНТ' | 'МДР' | 'ХАР'
type Race = { name: string; bonuses: Partial<Record<Ability, number>>; speed: number }
type NpcClass = { name: string; hitDie: number; armor: number; armorRule: 'fixed' | 'light' | 'medium' | 'unarmored' | 'barbarian'; weapons: string[]; saves: Ability[]; skills: string[] }
type Weapon = { name: string; damage: string; classes: string[]; races?: string[] }
type Npc = {
  id: string; name: string; race: string; characterClass: string; level: number; weapon: string
  hp: number; ac: number; speed: number; proficiency: number; abilities: Record<Ability, number>
}

const races: Race[] = [
  { name: 'Человек', bonuses: { СИЛ: 1, ЛОВ: 1, ТЕЛ: 1, ИНТ: 1, МДР: 1, ХАР: 1 }, speed: 30 },
  { name: 'Высший эльф', bonuses: { ЛОВ: 2, ИНТ: 1 }, speed: 30 },
  { name: 'Дварф', bonuses: { ТЕЛ: 2, МДР: 1 }, speed: 25 },
  { name: 'Полуэльф', bonuses: { ХАР: 2, ЛОВ: 1, ТЕЛ: 1 }, speed: 30 },
  { name: 'Полурослик', bonuses: { ЛОВ: 2, ХАР: 1 }, speed: 25 },
  { name: 'Тифлинг', bonuses: { ХАР: 2, ИНТ: 1 }, speed: 30 },
  { name: 'Орк', bonuses: { СИЛ: 2, ТЕЛ: 1 }, speed: 30 },
]

const classes: NpcClass[] = [
  { name: 'Воин', hitDie: 10, armor: 16, armorRule: 'fixed', weapons: ['Простое оружие', 'Воинское оружие'], saves: ['СИЛ', 'ТЕЛ'], skills: ['Атлетика', 'Восприятие'] },
  { name: 'Варвар', hitDie: 12, armor: 10, armorRule: 'barbarian', weapons: ['Простое оружие', 'Воинское оружие'], saves: ['СИЛ', 'ТЕЛ'], skills: ['Атлетика', 'Выживание'] },
  { name: 'Плут', hitDie: 8, armor: 11, armorRule: 'light', weapons: ['Простое оружие', 'Рапира', 'Короткий меч', 'Длинный лук'], saves: ['ЛОВ', 'ИНТ'], skills: ['Скрытность', 'Ловкость рук'] },
  { name: 'Жрец', hitDie: 8, armor: 14, armorRule: 'medium', weapons: ['Простое оружие'], saves: ['МДР', 'ХАР'], skills: ['Медицина', 'Религия'] },
  { name: 'Маг', hitDie: 6, armor: 10, armorRule: 'unarmored', weapons: ['Посох', 'Кинжал', 'Лёгкий арбалет'], saves: ['ИНТ', 'МДР'], skills: ['Магия', 'История'] },
  { name: 'Следопыт', hitDie: 10, armor: 14, armorRule: 'medium', weapons: ['Простое оружие', 'Воинское оружие'], saves: ['СИЛ', 'ЛОВ'], skills: ['Природа', 'Выживание'] },
  { name: 'Паладин', hitDie: 10, armor: 18, armorRule: 'fixed', weapons: ['Простое оружие', 'Воинское оружие'], saves: ['МДР', 'ХАР'], skills: ['Религия', 'Атлетика'] },
  { name: 'Бард', hitDie: 8, armor: 11, armorRule: 'light', weapons: ['Рапира', 'Короткий меч', 'Длинный меч', 'Лёгкий арбалет'], saves: ['ЛОВ', 'ХАР'], skills: ['Выступление', 'Убеждение'] },
]

const weapons: Weapon[] = [
  { name: 'Длинный меч', damage: '1к8 рубящий', classes: ['Воинское оружие'], races: ['Человек', 'Дварф', 'Орк', 'Полуэльф'] },
  { name: 'Боевой топор', damage: '1к8 рубящий', classes: ['Воинское оружие'], races: ['Дварф', 'Орк', 'Человек'] },
  { name: 'Длинный лук', damage: '1к8 колющий', classes: ['Воинское оружие', 'Длинный лук'], races: ['Высший эльф', 'Человек', 'Полуэльф'] },
  { name: 'Рапира', damage: '1к8 колющий', classes: ['Рапира'], races: ['Человек', 'Полуэльф', 'Полурослик', 'Высший эльф'] },
  { name: 'Короткий меч', damage: '1к6 колющий', classes: ['Короткий меч', 'Воинское оружие'], races: ['Высший эльф', 'Полуэльф', 'Полурослик'] },
  { name: 'Боевой молот', damage: '1к8 дробящий', classes: ['Воинское оружие'], races: ['Дварф', 'Человек', 'Орк'] },
  { name: 'Посох', damage: '1к6 дробящий', classes: ['Посох', 'Простое оружие'], races: ['Человек', 'Дварф', 'Высший эльф', 'Тифлинг'] },
  { name: 'Кинжал', damage: '1к4 колющий', classes: ['Кинжал', 'Простое оружие'], races: races.map((race) => race.name) },
  { name: 'Лёгкий арбалет', damage: '1к8 колющий', classes: ['Лёгкий арбалет', 'Простое оружие'], races: ['Человек', 'Дварф', 'Тифлинг', 'Полуэльф'] },
  { name: 'Боевой посох', damage: '1к6 дробящий', classes: ['Простое оружие'], races: ['Человек', 'Дварф', 'Высший эльф', 'Тифлинг'] },
]

const abilityOrder: Ability[] = ['СИЛ', 'ЛОВ', 'ТЕЛ', 'ИНТ', 'МДР', 'ХАР']
const classAbilities: Record<string, Record<Ability, number>> = {
  Воин: { СИЛ: 15, ЛОВ: 12, ТЕЛ: 14, ИНТ: 10, МДР: 11, ХАР: 8 },
  Варвар: { СИЛ: 15, ЛОВ: 13, ТЕЛ: 14, ИНТ: 8, МДР: 12, ХАР: 8 },
  Плут: { СИЛ: 8, ЛОВ: 15, ТЕЛ: 13, ИНТ: 12, МДР: 10, ХАР: 14 },
  Жрец: { СИЛ: 12, ЛОВ: 10, ТЕЛ: 13, ИНТ: 10, МДР: 15, ХАР: 12 },
  Маг: { СИЛ: 8, ЛОВ: 14, ТЕЛ: 13, ИНТ: 15, МДР: 12, ХАР: 10 },
  Следопыт: { СИЛ: 12, ЛОВ: 15, ТЕЛ: 13, ИНТ: 10, МДР: 14, ХАР: 8 },
  Паладин: { СИЛ: 15, ЛОВ: 10, ТЕЛ: 13, ИНТ: 8, МДР: 12, ХАР: 14 },
  Бард: { СИЛ: 8, ЛОВ: 14, ТЕЛ: 12, ИНТ: 10, МДР: 13, ХАР: 15 },
}
const modifier = (score: number) => Math.floor((score - 10) / 2)
const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

function createNpc(name: string, raceName: string, className: string, weaponName: string, level: number): Npc {
  const race = races.find((item) => item.name === raceName) ?? races[0]
  const npcClass = classes.find((item) => item.name === className) ?? classes[0]
  const classBase = classAbilities[npcClass.name]
  const abilities = Object.fromEntries(abilityOrder.map((ability) => [ability, classBase[ability] + (race.bonuses[ability] ?? 0)])) as Record<Ability, number>
  const con = modifier(abilities.ТЕЛ)
  return {
    id: crypto.randomUUID(), name: name.trim(), race: race.name, characterClass: npcClass.name,
    level, weapon: weaponName, hp: Math.max(1, npcClass.hitDie + con + (level - 1) * (Math.floor(npcClass.hitDie / 2) + 1 + con)),
    ac: npcClass.armorRule === 'fixed' ? npcClass.armor
      : npcClass.armor + (npcClass.armorRule === 'barbarian' ? modifier(abilities.ТЕЛ) : npcClass.armorRule === 'medium' ? Math.min(2, modifier(abilities.ЛОВ)) : modifier(abilities.ЛОВ)),
    speed: race.speed, proficiency: 2 + Math.floor((level - 1) / 4), abilities,
  }
}

function NpcWorkshop() {
  const [npcs, setNpcs] = useState<Npc[]>(() => {
    try {
      const saved = localStorage.getItem('dice-and-dragons-npcs')
      return saved ? JSON.parse(saved) as Npc[] : []
    } catch { return [] }
  })
  const [name, setName] = useState('')
  const [raceName, setRaceName] = useState(races[0].name)
  const [className, setClassName] = useState(classes[0].name)
  const [level, setLevel] = useState(1)
  const npcClass = classes.find((item) => item.name === className) ?? classes[0]
  const availableWeapons = useMemo(() => weapons.filter((weapon) => weapon.classes.some((type) => npcClass.weapons.includes(type)) && (!weapon.races || weapon.races.includes(raceName))), [npcClass, raceName])
  const [weaponName, setWeaponName] = useState('')
  const chosenWeapon = availableWeapons.find((weapon) => weapon.name === weaponName) ?? availableWeapons[0]
  const preview = createNpc(name || 'Новый NPC', raceName, className, chosenWeapon?.name ?? 'Без оружия', level)

  useEffect(() => { writeAccountValue('dice-and-dragons-npcs', JSON.stringify(npcs)) }, [npcs])

  const addNpc = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) return
    setNpcs((current) => [...current, createNpc(name, raceName, className, chosenWeapon?.name ?? 'Без оружия', level)])
    setName('')
  }

  return <div className="mx-auto max-w-[1500px] space-y-6 p-5 md:p-8">
    <section className="overflow-hidden rounded-2xl border border-[#5A4B38] bg-[#292724] text-white shadow-lg">
      <div className="flex items-center gap-4 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#6C492C] via-[#332B22] to-[#292724] p-6 md:p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#E69A51]/50 bg-[#E69A51]/15 text-[#F5B76D]"><ScrollText size={28} /></div>
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E69A51]">Архив обитателей мира</p><h2 className="mt-1 text-2xl font-bold">Персонажи мастера · NPC</h2><p className="mt-1 text-sm text-white/60">Готовые листы и быстрое создание новых союзников и противников</p></div>
      </div>
    </section>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]">
      <section className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center justify-between border-b border-[#E9E2D8] pb-4"><div><h3 className="text-xl font-bold">Готовый лист NPC</h3><p className="mt-1 text-sm text-gray-500">Выберите расу и класс — параметры рассчитываются автоматически</p></div><Sparkles className="text-[#B87839]" /></div>
        <form onSubmit={addNpc} className="space-y-5">
          <label className="block text-sm font-semibold">Имя персонажа<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Элара Серебряный Ветер" className="mt-2 w-full rounded-xl border border-[#D8CFC3] bg-[#FDFCFB] px-4 py-3 outline-none transition focus:border-[#B87839] focus:ring-2 focus:ring-[#E69A51]/20" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Раса<select value={raceName} onChange={(event) => { setRaceName(event.target.value); setWeaponName('') }} className="mt-2 w-full rounded-xl border border-[#D8CFC3] bg-[#FDFCFB] px-4 py-3">{races.map((race) => <option key={race.name}>{race.name}</option>)}</select></label>
            <label className="text-sm font-semibold">Класс<select value={className} onChange={(event) => { setClassName(event.target.value); setWeaponName('') }} className="mt-2 w-full rounded-xl border border-[#D8CFC3] bg-[#FDFCFB] px-4 py-3">{classes.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
            <label className="text-sm font-semibold">Уровень<select value={level} onChange={(event) => setLevel(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-[#D8CFC3] bg-[#FDFCFB] px-4 py-3">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} уровень</option>)}</select></label>
            <label className="text-sm font-semibold">Оружие<select value={chosenWeapon?.name ?? ''} onChange={(event) => setWeaponName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D8CFC3] bg-[#FDFCFB] px-4 py-3">{availableWeapons.map((weapon) => <option key={weapon.name} value={weapon.name}>{weapon.name} · {weapon.damage}</option>)}</select></label>
          </div>
          <div className="rounded-xl border border-[#D8CFC3] bg-[#F9F7F3] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#9B683A]">Лист персонажа · автоматически</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-3"><div className="flex items-center gap-1 text-xs text-gray-500"><Shield size={13} /> КД</div><p className="mt-1 text-xl font-bold">{preview.ac}</p></div>
              <div className="rounded-lg bg-white p-3"><div className="flex items-center gap-1 text-xs text-gray-500"><Heart size={13} /> Хиты</div><p className="mt-1 text-xl font-bold">{preview.hp}</p></div>
              <div className="rounded-lg bg-white p-3"><div className="flex items-center gap-1 text-xs text-gray-500"><Footprints size={13} /> Скорость</div><p className="mt-1 text-xl font-bold">{preview.speed} фт.</p></div>
              <div className="rounded-lg bg-white p-3"><div className="flex items-center gap-1 text-xs text-gray-500"><Swords size={13} /> Бонус мастерства</div><p className="mt-1 text-xl font-bold">+{preview.proficiency}</p></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{abilityOrder.map((ability) => <div key={ability} className="rounded-lg border border-[#E9E2D8] bg-white p-2 text-center"><p className="text-[10px] font-bold text-gray-500">{ability}</p><p className="text-lg font-bold">{preview.abilities[ability]}</p><p className="text-xs text-[#B87839]">{signed(modifier(preview.abilities[ability]))}</p></div>)}</div>
            <p className="mt-3 text-xs text-gray-600">Спасброски: {npcClass.saves.join(', ')} · Навыки: {npcClass.skills.join(', ')} · Оружие: {chosenWeapon?.name ?? 'не выбрано'} ({chosenWeapon?.damage ?? '—' })</p>
          </div>
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#292724] px-5 py-3.5 text-sm font-bold text-white shadow transition hover:bg-[#45413C]"><Plus size={18} /> Добавить NPC в кампанию</button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between"><div><h3 className="text-xl font-bold">Обитатели кампании</h3><p className="mt-1 text-sm text-gray-500">{npcs.length} персонажей · сохраняются автоматически</p></div></div>
        {npcs.map((npc) => <article key={npc.id} className="rounded-2xl border border-[#D8CFC3] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#B87839]">{npc.race} · {npc.characterClass} · ур. {npc.level}</p><h4 className="mt-1 text-lg font-bold">{npc.name}</h4><p className="mt-1 text-xs text-gray-500">Оружие: {npc.weapon}</p></div><button type="button" onClick={() => setNpcs((current) => current.filter((item) => item.id !== npc.id))} aria-label={`Удалить ${npc.name}`} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button></div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center"><div className="rounded-lg bg-[#F9F7F3] p-2"><p className="text-[10px] text-gray-500">КД</p><b>{npc.ac}</b></div><div className="rounded-lg bg-[#F9F7F3] p-2"><p className="text-[10px] text-gray-500">Хиты</p><b>{npc.hp}</b></div><div className="rounded-lg bg-[#F9F7F3] p-2"><p className="text-[10px] text-gray-500">Скорость</p><b>{npc.speed}</b></div><div className="rounded-lg bg-[#F9F7F3] p-2"><p className="text-[10px] text-gray-500">Мастерство</p><b>+{npc.proficiency}</b></div></div>
          <div className="mt-3 flex flex-wrap gap-1">{abilityOrder.map((ability) => <span key={ability} className="rounded-md bg-[#F4EDE4] px-2 py-1 text-[10px] font-semibold">{ability} {npc.abilities[ability]} ({signed(modifier(npc.abilities[ability]))})</span>)}</div>
        </article>)}
        {npcs.length === 0 && <div className="rounded-2xl border border-dashed border-[#D8CFC3] bg-white p-8 text-center text-sm text-gray-500">В кампании пока нет NPC. Создайте первого персонажа в листе слева.</div>}
      </section>
    </div>
  </div>
}

export default NpcWorkshop
