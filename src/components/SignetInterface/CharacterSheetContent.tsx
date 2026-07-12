import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Settings, Upload, Loader2 } from 'lucide-react';
import { useCharactersStore } from '../../store/characters';
import { useAuthStore, SecurityLevel } from '../../store/auth';
import { useConfirmStore } from '../../store/confirm';
import { useSessionStore } from '../../store/session';
import { useDiceStore } from '../../store/dice';
import { useUIStore } from '../../store/ui';
import { useSkillsStore } from '../../store/skills';
import { DEFAULT_STATS, DEFAULT_BARS, DEFAULT_SKILLS } from '../../systems/seal/constants';
import { usePeer } from '../../hooks/usePeer';
import { addSessionCharacter, removeSessionCharacter } from '../../services/characters.service';
import { lancerDes, parseAndRoll } from '../../services/des.service';
import { addSessionLog } from '../../services/db.service';
import { useMapStore } from '../../store/map';
import { MapItem } from '../BoardCanvas';
import { useAssetUpload } from '../../hooks/useAssetUpload';
import { AssetImage } from '../AssetImage';

interface CharacterSheetContentProps {
 sessionId: string;
 variant?: 'popup' | 'window';
 forceCharacterId?: string;
}

// ─── Liquid Glass panel wrapper ───────────────────────────────────────────────
function GlassPanel({
 children,
 className = '',
}: {
 children: React.ReactNode;
 className?: string;
}) {
 return (
 <div
 className={`relative rounded-xl overflow-hidden flex flex-col ${className}`}
 style={{
 background: 'rgba(14, 11, 6, 0.55)',
 backdropFilter: 'blur(24px) saturate(160%)',
 borderTop: '1px solid rgba(157, 168, 184, 0.35)',
 borderLeft: '1px solid rgba(157, 168, 184, 0.25)',
 borderBottom: '1px solid rgba(0, 0, 0, 0.6)',
 borderRight: '1px solid rgba(0, 0, 0, 0.5)',
 boxShadow:
 'inset 0 1px 0 rgba(255,215,0,0.12), inset 0 -1px 0 rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.6)',
 }}
 >
 {/* specular shine layer */}
 <div
 className="pointer-events-none absolute inset-0 z-0"
 style={{
 background:
 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 45%)',
 borderRadius: 'inherit',
 }}
 />
 <div className="relative z-10 flex flex-col flex-1 min-h-0">
 {children}
 </div>
 </div>
 );
}

// ─── Liquid progress bar ──────────────────────────────────────────────────────
function LiquidBar({
 percent,
 color,
 height = 6,
}: {
 percent: number;
 color: string;
 height?: number;
}) {
 return (
 <div
 className="w-full rounded-full overflow-hidden flex-shrink-0"
 style={{
 height,
 background: 'rgba(0,0,0,0.45)',
 boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
 border: '1px solid rgba(255,255,255,0.05)',
 }}
 >
 <div
 className="h-full rounded-full relative overflow-hidden transition-all duration-500"
 style={{
 width: `${percent}%`,
 background: `linear-gradient(180deg, ${color}dd 0%, ${color} 50%, ${color}aa 100%)`,
 boxShadow: `inset 0 1px 2px rgba(255,255,255,0.35), inset 0 -1px 2px rgba(0,0,0,0.3), 0 0 8px ${color}66`,
 }}
 >
 {/* shimmer sweep */}
 <div
 className="absolute inset-0"
 style={{
 background:
 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
 animation: 'shimmer-sweep 2.8s infinite linear',
 }}
 />
 </div>
 </div>
 );
}

// ─── Snap-scroll column with dots indicator ───────────────────────────────────
function SnapColumn({
 items,
 itemsPerPage,
 renderItem,
 label,
 variant,
}: {
 items: unknown[];
 itemsPerPage: number;
 renderItem: (item: unknown, index: number) => React.ReactNode;
 label: string;
 variant: 'popup' | 'window';
}) {
 const scrollRef = useRef<HTMLDivElement>(null);
 const [activePage, setActivePage] = useState(0);
 const totalPages = Math.ceil(items.length / itemsPerPage);
 const needsScroll = items.length > itemsPerPage;

 const onScroll = useCallback(() => {
 const el = scrollRef.current;
 if (!el) return;
 const page = Math.round(el.scrollTop / el.clientHeight);
 setActivePage(page);
 }, []);

 useEffect(() => {
 const el = scrollRef.current;
 if (!el) return;
 el.addEventListener('scroll', onScroll, { passive: true });
 return () => el.removeEventListener('scroll', onScroll);
 }, [onScroll]);

 // Group items into pages of itemsPerPage
 const pages: unknown[][] = [];
 for (let i = 0; i < items.length; i += itemsPerPage) {
 pages.push(items.slice(i, i + itemsPerPage));
 }

 const isPopup = variant === 'popup';

 return (
 <GlassPanel className="flex-1 min-w-0">
 {/* header */}
 <div
 className="flex-shrink-0 text-center py-1.5 border-b"
 style={{
 borderColor: 'rgba(157, 168, 184,0.2)',
 background: 'rgba(0,0,0,0.2)',
 }}
 >
 <span
 className="font-quantico font-black uppercase tracking-widest"
 style={{
 fontSize: isPopup ? '8px' : '10px',
 color: 'rgba(157, 168, 184,0.7)',
 }}
 >
 {label}
 </span>
 </div>

 {/* scrollable snap area */}
 <div
 ref={scrollRef}
 className="flex-1 min-h-0 overflow-y-auto"
 style={{
 scrollSnapType: needsScroll ? 'y mandatory' : 'none',
 scrollbarWidth: 'none',
 msOverflowStyle: 'none',
 }}
 >
 {pages.map((pageItems, pageIndex) => (
 <div
 key={pageIndex}
 className="flex flex-col"
 style={{
 scrollSnapAlign: 'start',
 scrollSnapStop: 'always',
 height: needsScroll ? '100%' : 'max-content',
 minHeight: '100%',
 padding: isPopup ? '4px' : '6px',
 gap: isPopup ? '3px' : '5px',
 justifyContent: 'flex-start',
 }}
 >
 {pageItems.map((item, i) => renderItem(item, pageIndex * itemsPerPage + i))}
 </div>
 ))}
 </div>

 {/* dots — only if multiple pages */}
 {needsScroll && (
 <div
 className="flex-shrink-0 flex items-center justify-center gap-1 py-1"
 style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
 >
 {Array.from({ length: totalPages }).map((_, i) => (
 <button
 key={i}
 onClick={() => {
 scrollRef.current?.scrollTo({
 top: i * (scrollRef.current.clientHeight),
 behavior: 'smooth',
 });
 }}
 style={{
 width: i === activePage ? 12 : 5,
 height: 5,
 borderRadius: 3,
 background:
 i === activePage
 ? '#d4af37'
 : 'rgba(157, 168, 184,0.3)',
 border: 'none',
 cursor: 'pointer',
 padding: 0,
 transition: 'all 0.25s ease',
 }}
 />
 ))}
 </div>
 )}
 </GlassPanel>
 );
}

 // ── Main component ───────────────────────────────────────────────────────────
export function CharacterSheetContent({
 sessionId,
 variant = 'popup',
 forceCharacterId,
}: CharacterSheetContentProps) {
 const user = useAuthStore(state => state.user);
 const characters = useCharactersStore(state => state.characters);
 const addOrUpdateCharacter = useCharactersStore(state => state.addOrUpdateCharacter);
 const { removeCharacter, controlledCharacterId, setPnjControle } = useCharactersStore();
 const { setSelectedSkill } = useUIStore();
 const { skills } = useSkillsStore();
 const session = useSessionStore(state =>
 state.sessions.find(s => s.id === sessionId)
 );
 const { broadcast, sendTo, onData } = usePeer();
 const { nbDice, modifier, setDiceResult, diceSharingEnabled } = useDiceStore();
 const { setCharacterManagement } = useUIStore();

 const isPopup = variant === 'popup';

 // ── how many items visible per page per mode ──
 const [itemsPerPage, setItemsPerPage] = useState(3);
 const [showAvatarPrompt, setShowAvatarPrompt] = useState(false);
 const [avatarUrlInput, setAvatarUrlInput] = useState('');

 const { isUploading, fileInputRef, handleFileUpload } = useAssetUpload(
 avatarUrlInput,
 (url) => {
 setAvatarUrlInput(url);
 }
 );

 useEffect(() => {
 if (isPopup) {
 setItemsPerPage(3);
 } else {
 setItemsPerPage(999); // En mode fenêtre, on affiche tout sur une seule page déroulante
 }
 }, [isPopup]);

 const character = useMemo(() => {
 if (forceCharacterId) {
 return characters.find(c => c.id === forceCharacterId);
 }
 if (controlledCharacterId) {
 return characters.find(c => c.id === controlledCharacterId);
 }
 return characters.find(c => !!user?.id && c.user_id === user.id);
 }, [characters, controlledCharacterId, user?.id, forceCharacterId]);

 const isMJ = !!user && user.role >= SecurityLevel.MJ;
 const isOwner = character?.user_id === user?.id;

 const handleDelete = async () => {
 if (!character) return;
 if (!isMJ && !isOwner) return;
 
 if (!(await useConfirmStore.getState().ask(`Souhaitez-vous vraiment bannir ${character.name} de l'Archive ?`))) return;

 if (window.electronAPI) {
 await removeSessionCharacter(sessionId, character.id);
 }

 if (controlledCharacterId === character.id) {
 setPnjControle(sessionId, null);
 }

 removeCharacter(sessionId, character.id); broadcast({ type: 'CHAR_DELETE', payload: { id: character.id } });
 };

 const handleAvatarClick = () => {
 if (!character) return;
 setAvatarUrlInput(character.image_url || '');
 setShowAvatarPrompt(true);
 };

 const submitAvatarChange = async () => {
 if (!character) return;
 const updatedChar = { ...character, image_url: avatarUrlInput };
 
 // Update local store
 addOrUpdateCharacter(updatedChar);
 
 // Persist to DB if in electron
 if (window.electronAPI) {
 await addSessionCharacter(updatedChar);
 }
 
 // Broadcast via P2P
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 
 // La mise à jour locale est déjà gérée par le store Zustand (addOrUpdateCharacter)
 
 setShowAvatarPrompt(false);
 };

 // ── MAP TOKENS SYNC ──────────────────────────────
 const tokenStatuses = useMapStore(state => state.tokenStatuses);
 const setStoreTokenStatus = useMapStore(state => state.setTokenStatus);

 const isTokenOnMap = useMemo(() => {
 return character ? !!tokenStatuses[character.id] : false;
 }, [character, tokenStatuses]);

 const toggleTokenPlacement = async (e: React.MouseEvent) => {
 e.stopPropagation();
 if (!character) return;
 
 // Si on est le host (MJ), on peut déclencher directement en local
 if (isMJ) {
 const channel = new BroadcastChannel(`board_actions_${sessionId}`);
 channel.postMessage({ type: 'TOGGLE_TOKEN', payload: { id: character.id } });
 channel.close();
 }
 
 // On envoie la requête P2P au host
 broadcast({ type: 'TOGGLE_TOKEN_REQUEST', payload: { id: character.id } });
 // Optimistic update
 setStoreTokenStatus(character.id, !isTokenOnMap);
 };

 const { name = 'Inconnu', stats = {}, bars = {}, image_url, inventory = [], custom_skills = [] } = character || {};
 const statDefs = session?.settings?.stats || DEFAULT_STATS;
 const barDefs = session?.settings?.bars || DEFAULT_BARS;

 // Sync custom skills with the global skills store to enable "real-time" updates
 const reactiveSkills = useMemo(() => {
 return custom_skills.map((cs: any) => {
 const template = skills.find(s => s.id === cs.id);
 if (!template) return cs;
 return { ...template, is_active: cs.is_active, modifiers: cs.modifiers || template.modifiers };
 });
 }, [custom_skills, skills]);

  // Calculer les modificateurs d'équipement et de compétences complexes
  const calculatedModifiers = useMemo(() => {
    const statsFlat: Record<string, number> = {};
    const statsPercent: Record<string, number> = {};
    const barsFlat: Record<string, { value: number; max: number }> = {};

    if (!character) return { stats: {}, bars: {} };

    // Réservoir de tags actifs (séparé par source)
    const activeItemTags = new Set<string>();
    const activeSkillTags = new Set<string>();
    inventory.forEach((item: any) => {
      if (item.equipped && item.tags) item.tags.forEach((t: string) => activeItemTags.add(t));
    });
    reactiveSkills.forEach((skill: any) => {
      const isAuto = skill.type === 'passive_auto';
      const isToggleActive = skill.type === 'passive_toggle' && skill.is_active;
      if ((isAuto || isToggleActive) && skill.tags) skill.tags.forEach((t: string) => activeSkillTags.add(t));
    });

    const checkCondition = (skill: any): boolean => {
      if (!skill.condition_tags || skill.condition_tags.length === 0) return false;
      const cType = skill.condition_type || 'both';
      const pool = new Set<string>();
      if (cType === 'item' || cType === 'both' || cType === 'les_deux') activeItemTags.forEach(t => pool.add(t));
      if (cType === 'skill' || cType === 'both' || cType === 'les_deux') activeSkillTags.forEach(t => pool.add(t));
      return skill.condition_tags.every((t: string) => pool.has(t));
    };

    // 1. Modificateurs d'objets équipés
    inventory.forEach((item: any) => {
      if (item.equipped && item.modifiers) {
        item.modifiers.forEach((m: any, idx: number) => {
          if (m.target === 'stat') {
            if (m.mode === 'percent') statsPercent[m.targetId] = (statsPercent[m.targetId] || 0) + m.value;
            else if (m.mode === 'dice') statsFlat[m.targetId] = (statsFlat[m.targetId] || 0) + (item.rolledValues?.[idx] || 0);
            else statsFlat[m.targetId] = (statsFlat[m.targetId] || 0) + m.value;
          } else if (m.target === 'bar') {
            if (item.category === 'Arme') return;
            if (!barsFlat[m.targetId]) barsFlat[m.targetId] = { value: 0, max: 0 };
            const prop = m.targetProperty || 'max';
            barsFlat[m.targetId][prop as 'value' | 'max'] += m.mode === 'dice' ? (item.rolledValues?.[idx] || 0) : m.value;
          }
        });
      }
    });

    // 2. Modificateurs de compétences (auto, toggle actif, conditionnels)
    reactiveSkills.forEach((skill: any) => {
      const isAuto = skill.type === 'passive_auto';
      const isToggleActive = skill.type === 'passive_toggle' && skill.is_active;
      const isConditional = skill.type === 'passive_conditional';

      const isActive = isAuto || isToggleActive || (isConditional && checkCondition(skill));

      if (isActive && skill.modifiers) {
        skill.modifiers.forEach((m: any) => {
          if (m.target === 'stat') {
            if (m.mode === 'percent') statsPercent[m.targetId] = (statsPercent[m.targetId] || 0) + m.value;
            else statsFlat[m.targetId] = (statsFlat[m.targetId] || 0) + m.value;
          } else if (m.target === 'bar') {
            if (!barsFlat[m.targetId]) barsFlat[m.targetId] = { value: 0, max: 0 };
            const prop = m.targetProperty || 'max';
            barsFlat[m.targetId][prop as 'value' | 'max'] += m.value;
          }
        });
      }
    });

    // Calculer les bonus finaux des stats
    const statsFinal: Record<string, number> = {};
    statDefs.forEach((s: any) => {
      const base = stats[s.id] || 20;
      statsFinal[s.id] = (statsFlat[s.id] || 0) + Math.round(base * ((statsPercent[s.id] || 0) / 100));
    });

    return { stats: statsFinal, bars: barsFlat };
  }, [character, inventory, stats, statDefs, reactiveSkills]);

 if (!character) {
 return (
 <div className="flex flex-col items-center justify-center h-full p-8 text-center">
 <p
 className="font-quantico text-sm uppercase tracking-widest"
 style={{ color: 'rgba(157, 168, 184,0.5)' }}
 >
 Aucun personnage lié à cette session
 </p>
 </div>
 );
 }

 const CustomAvatarPrompt = () => {
 if (!showAvatarPrompt) return null;
 return (
 <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="bg-[#0A0A0C]/90 border border-silver-DEFAULT/40 p-6 rounded-2xl shadow-[0_0_30px_rgba(157, 168, 184,0.2)] w-[90%] max-w-sm flex flex-col gap-4">
 <h3 className="text-glacier-bright font-quantico font-black uppercase tracking-widest text-center text-sm">Portrait du Voyageur</h3>
 <div className="flex gap-2">
 <input 
 type="text" 
 value={avatarUrlInput}
 onChange={(e) => setAvatarUrlInput(e.target.value)}
 placeholder="URL de l'image (https://...)"
 className="flex-1 bg-black/50 border border-silver-DEFAULT/20 rounded-lg px-3 py-2 text-white/90 text-xs font-mono focus:outline-none focus:border-silver-DEFAULT/60 transition-colors"
 autoFocus
 onKeyDown={(e) => {
 if (e.key === 'Enter') submitAvatarChange();
 if (e.key === 'Escape') setShowAvatarPrompt(false);
 }}
 />
 <button 
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploading}
 className="p-2 rounded-lg bg-glacier-DEFAULT/10 border border-silver-DEFAULT/20 text-glacier-bright hover:bg-glacier-DEFAULT/20 transition-all flex items-center justify-center min-w-[40px]"
 title="Importer un fichier local"
 >
 {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
 </button>
 <input 
 type="file" 
 ref={fileInputRef} 
 className="hidden" 
 accept="image/*"
 onChange={handleFileUpload}
 />
 </div>
 <p className="text-[10px] font-quantico text-white/40 uppercase tracking-widest text-center">Importez un portrait local (P2P)</p>
 <div className="flex justify-end gap-2 mt-2">
 <button 
 onClick={() => setShowAvatarPrompt(false)}
 className="px-4 py-1.5 rounded-lg text-white/50 hover:text-white/90 text-xs font-quantico uppercase tracking-wider transition-colors"
 >
 Annuler
 </button>
 <button 
 onClick={submitAvatarChange}
 className="px-4 py-1.5 rounded-lg bg-glacier-DEFAULT text-black border border-silver-DEFAULT hover:bg-glacier-bright hover:shadow-[0_0_15px_rgba(157, 168, 184,0.3)] text-xs font-quantico font-black uppercase tracking-wider transition-all"
 >
 Enregistrer
 </button>
 </div>
 </div>
 </div>
 );
 };

 const handleRollStat = async (statName: string, baseFaces: number, statId: string) => {
 if (!character) return;
 
 const nb = Math.max(1, nbDice);
 const itemMod = calculatedModifiers.stats[statId] || 0;
 const finalFaces = baseFaces + itemMod;
 const mod = modifier; // Seul le modificateur global s'ajoute au résultat
 const res = lancerDes(nb, finalFaces, mod);
 
 const labelPart = `(${statName}=${finalFaces})`;
 const modStr = mod !== 0 ? (mod > 0 ? '+' : '') + mod : '';
 const diceString = `${nb}d${labelPart}${modStr}`;
 
 const result = {
 rolls: res.rolls,
 total: res.total,
 bonus: mod,
 diceString,
 label: statName,
 groups: [{ nb, faces: finalFaces, label: statName, rolls: res.rolls }],
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name
 };

 setDiceResult([result]);

 const logEntry = {
 id: crypto.randomUUID(),
 type: 'des',
 action: `Lance ${result.label} (${diceString})`,
 details: { rolls: res.rolls, total: res.total, diceString },
 timestamp: Date.now(),
 character_id: character.id,
 character_name: character.name
 };

 if (window.electronAPI) {
 await addSessionLog(sessionId, logEntry as any);
 }

 if (diceSharingEnabled) {
 broadcast({ type: 'DICE_ROLL', payload: result });
 } else {
 if (!isMJ && session?.hostPeerId) {
 sendTo(session.hostPeerId, { type: 'SECRET_DICE_ROLL', payload: result });
 }
 }
 };

 const handleManualBarUpdate = async (barId: string, diff: number) => {
 if (!character) return;
 const updatedBars = { ...(character.bars || {}) };
 const currentVal = updatedBars[barId] || 0;
 const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
 const maxVal = updatedBars[maxKey] || currentVal || 100;
 
 updatedBars[barId] = Math.max(0, Math.min(maxVal, currentVal + diff));
 
 const updatedChar = { ...character, bars: updatedBars };
 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 };

 const handleToggleSkill = async (skillId: string) => {
 if (!character) return;

 // 1. Collecter les valeurs des attributs pour le remplacement
 const statValues: Record<string, number> = {};
 const labelMapping: Record<string, string> = {};
 
 // Attributs (Stats) - Résolution uniquement par ID
 statDefs.forEach((s: any) => {
 const val = (character.stats || {})[s.id] || 20;
 const itemMod = calculatedModifiers.stats[s.id] || 0;
 const finalVal = val + itemMod;
 statValues[s.id.toLowerCase()] = finalVal;
 labelMapping[s.id.toLowerCase()] = s.name;
 });

 // Ressources (Bars) - Résolution uniquement par ID
 const barDefs = (character as any)?.settings?.bars || [
    { id: 'hp', name: 'Points de Vie' },
    { id: 'mana', name: 'Mana' },
    { id: 'stamina', name: 'Endurance' }
  ];
 barDefs.forEach((b: any) => {
 const val = (character.bars || {})[b.id] || 0;
 statValues[b.id.toLowerCase()] = val;
 labelMapping[b.id.toLowerCase()] = b.name;
 });

 const updatedBars = { ...(character.bars || {}) };
 let barsChanged = false;

 const updatedSkills = (character.custom_skills || []).map((s: any) => {
 if (s.id === skillId) {
 const isActive = !s.is_active;
 let updatedModifiers = s.modifiers;
 const diceResults: any[] = [];

 // 2. Si on active l'aura, on roll les modificateurs ET les effets classiques
 if (isActive) {
 // Modificateurs (Aura/Passif) - On fige les valeurs pour les bonus statiques
 if (updatedModifiers) {
 updatedModifiers = updatedModifiers.map((m: any) => {
 let valueToApply = 0;

 if (m.mode === 'dice' && m.formula) {
 let formula = m.formula;
 const sortedStats = Object.keys(statValues).sort((a, b) => b.length - a.length);
 sortedStats.forEach((key) => {
 const val = statValues[key];
 const label = labelMapping[key];
 const regex = new RegExp(`(?<=\\b|d)${key}\\b`, 'gi');
 formula = formula.replace(regex, `(${label}=${val})`);
 });
 const rollRes = parseAndRoll(formula);
 
 // AJOUT : On ajoute au DiceRollModal SEULEMENT s'il y a eu des dés
 if (rollRes.rolls.length > 0) {
 diceResults.push({
 rolls: rollRes.rolls || [],
 total: rollRes.total,
 bonus: 0,
 diceString: m.formula,
 label: `Bonus ${m.targetId}`,
 groups: rollRes.groups,
 color: '#3b82f6', // Bleu pour les auras/buffs
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name
 });
 }
 valueToApply = rollRes.total;
 } else {
 valueToApply = m.value;
 }

 // Gestion Spécifique de la Régénération / Soin (Propriété 'current')
 if (m.target === 'bar' && m.targetProperty === 'current') {
 const barId = m.targetId;
 const currentVal = updatedBars[barId] || 0;
 const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
 const itemMod = calculatedModifiers.bars[barId] || { value: 0, max: 0 };
 const baseMaxVal = (character.bars as Record<string, number>)[maxKey] || (character.bars as Record<string, number>)[barId] || 100;
 const maxVal = baseMaxVal + itemMod.max;

 updatedBars[barId] = Math.max(0, Math.min(maxVal, currentVal + valueToApply));
 barsChanged = true;
 return m; // On ne fige pas dans 'value' car c'est un effet "One-shot" à l'activation
 }

 if (m.mode === 'dice') {
 return { ...m, value: valueToApply };
 }
 return m;
 });
 }

 // Effets Classiques (Dégâts, etc.) - On déclenche l'animation de roll
 if (s.effects && s.effects.length > 0) {
 s.effects.forEach((eff: any) => {
 if (eff.mode === 'dice' && eff.formula) {
 let formula = eff.formula;
 const sortedStats = Object.keys(statValues).sort((a, b) => b.length - a.length);
 sortedStats.forEach((key) => {
 const val = statValues[key];
 const label = labelMapping[key];
 const regex = new RegExp(`(?<=\\b|d)${key}\\b`, 'gi');
 formula = formula.replace(regex, `(${label}=${val})`);
 });

 const rollRes = parseAndRoll(formula);
 // On n'ajoute que s'il y a des dés
 if (rollRes.rolls.length > 0) {
 diceResults.push({
 rolls: rollRes.rolls || [],
 total: rollRes.total,
 bonus: 0,
 diceString: eff.formula,
 label: eff.description || s.name,
 groups: rollRes.groups,
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name
 });
 }
 }
 });
 }
 }

 if (diceResults.length > 0) {
 setDiceResult(diceResults);
 if (diceSharingEnabled) {
 diceResults.forEach(r => broadcast({ type: 'DICE_ROLL', payload: r }));
 } else {
 if (!isMJ && session?.hostPeerId) {
 diceResults.forEach(r => sendTo(session.hostPeerId, { type: 'SECRET_DICE_ROLL', payload: r }));
 }
 }
 }

 return { ...s, is_active: isActive, modifiers: updatedModifiers };
 }
 return s;
 });

 const updatedChar = { ...character, custom_skills: updatedSkills, bars: barsChanged ? updatedBars : character.bars };
 addOrUpdateCharacter(updatedChar);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 };

 const handleUseSkill = async (skill: any) => {
 if (!character) return;
 const diceResults: any[] = [];
 
 // 1. Collecter les valeurs des attributs pour le remplacement
 const statValues: Record<string, number> = {};
 const labelMapping: Record<string, string> = {};
 
 statDefs.forEach((s: any) => {
 const val = stats[s.id] || 20;
 const itemMod = calculatedModifiers.stats[s.id] || 0;
 statValues[s.id.toLowerCase()] = val + itemMod;
 labelMapping[s.id.toLowerCase()] = s.name;
 });

 const barDefs = (character as any)?.settings?.bars || [
 { id: 'hp', name: 'Points de Vie' },
 { id: 'mana', name: 'Mana' },
 { id: 'stamina', name: 'Endurance' }
 ];
 barDefs.forEach((b: any) => {
 const val = (character.bars || {})[b.id] || 0;
 statValues[b.id.toLowerCase()] = val;
 labelMapping[b.id.toLowerCase()] = b.name;
 });

 // 2. Traiter chaque effet configuré
 const updatedBars = { ...(character.bars || {}) };
 let costApplied = false;

 if (skill.effects && skill.effects.length > 0) {
 skill.effects.forEach((eff: any) => {
 let label = eff.description || skill.name;
 const mode = eff.mode || 'dice';
 const formulaStr = eff.formula || '';
 
 if (mode === 'dice' && formulaStr) {
 let formula = formulaStr;
 
 const sortedStats = Object.keys(statValues).sort((a, b) => b.length - a.length);
 
 sortedStats.forEach((key) => {
 const val = statValues[key];
 const statLabel = labelMapping[key];
 const regex = new RegExp(`(?<=\\b|d)${key}\\b`, 'gi');
 formula = formula.replace(regex, `(${statLabel}=${val})`);
 });

 const rollRes = parseAndRoll(formula);
 const rollTotal = Math.round((rollRes.total || 0) + modifier);
 const modStr = modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : '';
 
 // Appliquer le soin sur les bars
 if ((eff.type === 'heal' || eff.targetProperty === 'current') && eff.targetId) {
 const barId = eff.targetId.toLowerCase();
 const currentVal = updatedBars[barId] ?? 0;
 const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
 const maxVal = updatedBars[maxKey] ?? currentVal ?? 100;
 updatedBars[barId] = Math.max(0, Math.min(maxVal, currentVal + rollTotal));
 costApplied = true;
 }

 diceResults.push({
 rolls: rollRes.rolls || [],
 total: rollTotal,
 bonus: modifier,
 diceString: `${formulaStr}${modStr}`,
 label: label,
 groups: rollRes.groups,
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name
 });
 } else if (eff.valeur !== undefined) {
 // Appliquer le soin fixe
 if ((eff.type === 'heal' || eff.targetProperty === 'current') && eff.targetId) {
 const barId = eff.targetId.toLowerCase();
 const currentVal = updatedBars[barId] ?? 0;
 const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
 const maxVal = updatedBars[maxKey] ?? currentVal ?? 100;
 updatedBars[barId] = Math.max(0, Math.min(maxVal, currentVal + (eff.valeur || 0)));
 costApplied = true;
 }
 diceResults.push({
 rolls: [eff.valeur],
 total: eff.valeur,
 bonus: 0,
 diceString: `Effet fixe`,
 label: label,
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name
 });
 } else if (eff.description) {
 // Effet purement narratif
 diceResults.push({
 rolls: [],
 total: 0,
 bonus: 0,
 diceString: 'Narratif',
 label: label,
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name
 });
 }
 });
 }

 // 3. Envoyer les résultats (Si aucun effet technique, on envoie au moins le nom du skill)
 const finalResults = diceResults.length > 0 ? diceResults : [{
 rolls: [],
 total: 0,
 bonus: 0,
 diceString: 'Utilisation',
 label: skill.name,
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name
 }];

 setDiceResult(finalResults);
 
 // Appliquer les soins/coûts sur le personnage si nécessaire
 if (costApplied) {
 const updatedChar = { ...character, bars: updatedBars };
 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 }

 const logEntry = {
 id: crypto.randomUUID(),
 type: 'competence',
 action: `Invoque ${skill.name}`,
 details: { results: finalResults },
 timestamp: Date.now(),
 character_id: character.id,
 character_name: character.name
 };

 if (window.electronAPI) await addSessionLog(sessionId, logEntry as any);
 if (diceSharingEnabled) {
 finalResults.forEach(r => broadcast({ type: 'DICE_ROLL', payload: r }));
 } else {
 if (!isMJ && session?.hostPeerId) {
 finalResults.forEach(r => sendTo(session.hostPeerId, { type: 'SECRET_DICE_ROLL', payload: r }));
 }
 }
 };

 // ── renderers ──────────────────────────────────
 const renderStat = (stat: unknown) => {
 const s = stat as { id: string; name: string };
 const val = stats[s.id] || 20;
 const itemMod = calculatedModifiers.stats[s.id] || 0;
 const finalVal = val + itemMod;

 return (
 <div
 key={s.id}
 onClick={() => handleRollStat(s.name, val, s.id)}
 className="flex items-center justify-between flex-shrink-0 rounded-lg cursor-pointer group"
 style={{
 padding: isPopup ? '5px 8px' : '7px 12px',
 background: 'rgba(255,255,255,0.04)',
 border: '1px solid rgba(255,255,255,0.07)',
 transition: 'all 0.2s',
 }}
 onMouseEnter={e => {
 (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(157, 168, 184,0.3)';
 (e.currentTarget as HTMLDivElement).style.background = 'rgba(157, 168, 184,0.08)';
 }}
 onMouseLeave={e => {
 (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
 (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
 }}
 >
 <div className="flex flex-col flex-1 min-w-0">
 <span
 className="font-quantico uppercase tracking-widest truncate group-hover:text-glacier-bright transition-colors"
 style={{ fontSize: isPopup ? '8px' : '10px', color: 'rgba(255,255,255,0.75)' }}
 title={s.name}
 >
 {s.name}
 </span>
 {itemMod !== 0 && (
 <span className="text-[11px] font-bold text-silver-bright/40 uppercase tracking-tighter">
 BASE: {val}
 </span>
 )}
 </div>
 <span className="font-quantico font-black" style={{ fontSize: isPopup ? '10px' : '13px', color: '#d4af37' }}>
 D{finalVal}
 </span>
 </div>
 );
 };

 const renderBar = (bar: unknown) => {
 const b = bar as { id: string; name: string; color: string };
 const maxKey = `max${b.id.charAt(0).toUpperCase()}${b.id.slice(1)}`;
 const itemMod = calculatedModifiers.bars[b.id] || { value: 0, max: 0 };
 
 const baseMaxVal = (bars as Record<string, number>)[maxKey] || (bars as Record<string, number>)[b.id] || 1;
 const baseCurrentVal = (bars as Record<string, number>)[b.id] || 0;
 
 const maxVal = baseMaxVal + itemMod.max;
 const currentVal = baseCurrentVal + itemMod.value;
 
 const percent = Math.min(100, Math.max(0, (currentVal / maxVal) * 100));

 return (
 <div
 key={b.id}
 className="flex flex-col justify-center flex-shrink-0 rounded-lg p-2"
 style={{
 padding: isPopup ? '5px 8px' : '8px 12px',
 background: 'rgba(255,255,255,0.04)',
 border: '1px solid rgba(255,255,255,0.07)',
 gap: isPopup ? 4 : 6,
 transition: 'border-color 0.2s',
 }}
 >
 <div className="flex items-center justify-between mb-1 gap-2">
 <div className="flex flex-col flex-1 min-w-0">
 <span className="font-quantico uppercase tracking-widest text-xs sm:text-xs truncate" title={b.name} style={{ color: b.color }}>{b.name}</span>
 {(itemMod.value !== 0 || itemMod.max !== 0) && (
 <span className="text-[11px] font-bold opacity-50" style={{ color: b.color }}>
 {itemMod.value !== 0 && `ACTUEL JAUGE:${itemMod.value > 0 ? '+' : ''}${itemMod.value} `}
 {itemMod.max !== 0 && `MAX JAUGE:${itemMod.max > 0 ? '+' : ''}${itemMod.max}`}
 </span>
 )}
 </div>
 <div className="flex items-center gap-1 shrink-0">
 {(isMJ || isOwner) && (
 <button 
 onClick={() => handleManualBarUpdate(b.id, -1)}
 className="w-4 h-4 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs text-white/60 hover:text-white"
 >-</button>
 )}
 <span className="font-mono font-black text-xs sm:text-xs truncate" title={`${Math.floor(currentVal)}/${Math.floor(maxVal)}`} style={{ color: b.color }}>{Math.floor(currentVal)}/{Math.floor(maxVal)}</span>
 {(isMJ || isOwner) && (
 <button 
 onClick={() => handleManualBarUpdate(b.id, 1)}
 className="w-4 h-4 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs text-white/60 hover:text-white"
 >+</button>
 )}
 </div>
 </div>
 <LiquidBar percent={percent} color={b.color} height={isPopup ? 4 : 6} />
 </div>
 );
 };

  const renderSkill = (skill: unknown) => {
    const s = skill as any;
    const skillType = s.type || 'active';
    return (
      <div
        key={s.id}
        onClick={() => setSelectedSkill(s)}
        className="flex items-center justify-between flex-shrink-0 rounded-lg cursor-pointer group"
        style={{
          padding: isPopup ? '4px 6px' : '6px 10px',
          background: s.is_active ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.04)',
          border: s.is_active ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255,255,255,0.07)',
          transition: 'all 0.2s',
        }}
      >
        <div className="flex flex-col flex-1 min-w-0">
          <span
            className="font-quantico uppercase tracking-widest truncate text-white/80"
            style={{ fontSize: isPopup ? '8px' : '9px' }}
            title={s.name}
          >
            {s.name}
          </span>
          <span className="text-[11px] font-mono text-silver-bright/40 uppercase">
            {skillType === 'active' ? 'Actif' : skillType === 'passive_auto' ? 'Passif' : skillType === 'passive_conditional' ? 'Passif Cond.' : 'Aura'}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {skillType === 'active' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleUseSkill(s); }}
              className="p-1 rounded bg-glacier-DEFAULT/10 text-silver-bright hover:bg-glacier-DEFAULT/20 transition-all"
            >
              <Plus size={10} />
            </button>
          )}
          {skillType === 'passive_toggle' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleSkill(s.id); }}
              className={`p-1 rounded transition-all ${s.is_active ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/60 hover:text-white'}`}
            >
              <Settings size={10} />
            </button>
          )}
        </div>
      </div>
    );
  };

 // ── POPUP layout ───────────────────────────────
 if (isPopup) {
 return (
 <>
 <style>{`
 @keyframes shimmer-sweep {
 0% { transform: translateX(-100%); }
 100% { transform: translateX(100%); }
 }
 `}</style>
 
 <CustomAvatarPrompt />

 <div className="flex flex-col h-full w-full overflow-hidden">
 {/* ── Header ── */}
 <div className="flex-shrink-0 flex items-center gap-3 p-2 bg-black/40 border-b border-silver-DEFAULT/10">
 <div 
   onClick={handleAvatarClick}
   className="w-[28px] h-8 shrink-0 bg-black/60 overflow-hidden cursor-pointer hover:brightness-125 transition-all [clip-path:polygon(50%_0%,_100%_25%,_100%_75%,_50%_100%,_0%_75%,_0%_25%)]"
 >
 {image_url ? <AssetImage src={image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-silver-bright font-quantico font-black">{name.charAt(0)}</div>}
 </div>
 <div className="flex-1 min-w-0">
 <h2 className="text-xs font-quantico font-black text-glacier-bright truncate uppercase tracking-widest" title={name}>{name}</h2>
 <div className="text-[9px] font-mono mt-0.5 text-silver-DEFAULT/60 flex items-center gap-1">
 <span>Token : </span>
 <button 
 onClick={toggleTokenPlacement}
 className={`px-2 py-0.5 rounded-md font-black uppercase transition-all text-black shadow-sm hover:brightness-110 ${isTokenOnMap ? 'bg-glacier shadow-[0_0_8px_rgba(79,164,184,0.4)]' : 'bg-silver'}`}
 >
 {isTokenOnMap ? 'on' : 'off'}
 </button>
 </div>
 </div>
 </div>

 <div className="flex gap-2 p-2 h-[160px] overflow-hidden">
 <SnapColumn items={statDefs} itemsPerPage={itemsPerPage} renderItem={renderStat} label="Attributs" variant="popup" />
 <SnapColumn items={barDefs} itemsPerPage={itemsPerPage} renderItem={renderBar} label="Ressources" variant="popup" />
 
 </div>
 </div>
 </>
 );
 }

 // ── WINDOW (full-screen) layout ────────────────
 return (
 <>
 <style>{`
 @keyframes shimmer-sweep {
 0% { transform: translateX(-100%); }
 100% { transform: translateX(100%); }
 }
 `}</style>
 
 <CustomAvatarPrompt />

 <div className="flex flex-col h-full w-full overflow-hidden p-4">
 {/* ── Header ── */}
 <div className="flex-shrink-0 flex items-center gap-4 mb-4 p-3 bg-black/40 border border-silver-DEFAULT/15 rounded-xl shadow-lg">
 <div 
   onClick={handleAvatarClick}
   className="w-[49px] h-14 shrink-0 bg-black/60 overflow-hidden cursor-pointer hover:brightness-125 transition-all [clip-path:polygon(50%_0%,_100%_25%,_100%_75%,_50%_100%,_0%_75%,_0%_25%)]"
 >
 {image_url ? <AssetImage src={image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-silver-bright font-quantico font-black text-2xl">{name.charAt(0)}</div>}
 </div>
 <div className="flex-1 min-w-0">
 <h1 className="text-xl font-quantico font-black text-glacier-bright uppercase tracking-[0.2em] truncate" title={name}>{name}</h1>
 <div className="text-xs font-mono mt-1 text-silver-DEFAULT/60 flex items-center gap-1">
 <span>Token : </span>
 <button 
 onClick={toggleTokenPlacement}
 className={`px-2.5 py-0.5 rounded-md font-black uppercase transition-all text-black shadow-sm hover:brightness-110 ${isTokenOnMap ? 'bg-glacier shadow-[0_0_10px_rgba(79,164,184,0.4)]' : 'bg-silver'}`}
 >
 {isTokenOnMap ? 'on' : 'off'}
 </button>
 </div>
 </div>
 </div>

 <div className="flex-1 flex gap-4 min-h-0">
 <SnapColumn items={statDefs} itemsPerPage={itemsPerPage} renderItem={renderStat} label="Attributs" variant="window" />
 <SnapColumn items={barDefs} itemsPerPage={itemsPerPage} renderItem={renderBar} label="Ressources" variant="window" />
 
 </div>
 </div>
 </>
 );
}
