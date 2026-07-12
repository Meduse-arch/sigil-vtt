import React, { useState, useMemo, useEffect } from 'react';
import { useCharactersStore } from '../../store/characters';
import { useItemsStore } from '../../store/items';
import { useAuthStore, SecurityLevel } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { useConfirmStore } from '../../store/confirm';
import { usePeer } from '../../hooks/usePeer';
import { useDiceStore } from '../../store/dice';
import { useSessionStore } from '../../store/session';
import { activityLogService } from '../../services/activity-log.service';
import { Package, Plus, Trash2, Search, Hammer, User, Shield, Star, Sword, Sparkles, Gem, FlaskConical, ChevronRight, PenTool, Zap, X } from 'lucide-react';
import { addSessionCharacter } from '../../services/characters.service';
import { ItemDetailContent } from './ItemDetailContent';
import { DEFAULT_STATS, DEFAULT_BARS } from '../../systems/seal/constants';
import { ItemCreationModal } from './ItemCreationModal';
import { AssetImage } from '../AssetImage';
import { useTranslation } from 'react-i18next';

interface InventoryWindowContentProps {
 sessionId: string;
 variant?: 'default' | 'codex';
}

const CATEGORY_ICONS: Record<string, any> = {
 'Arme': Sword,
 'Armure': Shield,
 'Consommable': FlaskConical,
 'Artéfact': Sparkles,
 'Bijou': Gem,
 'Divers': Package
};

export function InventoryWindowContent({ sessionId, variant = 'default' }: InventoryWindowContentProps) {
 const { t } = useTranslation();
 const user = useAuthStore(state => state.user);
 const isMJ = !!user && user.role >= SecurityLevel.MJ;
 const { characters, controlledCharacterId, addOrUpdateCharacter } = useCharactersStore();
 const character = characters.find(c => controlledCharacterId ? c.id === controlledCharacterId : (!!user?.id && c.user_id === user.id));
 const { items, removeItem } = useItemsStore();
 const { setShowCreateModal, setSelectedItem, selectedItem } = useUIStore();
 const { broadcast, sendTo } = usePeer();
  const { diceSharingEnabled } = useDiceStore();
  const session = useSessionStore(state => state.sessions.find(s => s.id === sessionId));

 const [activeTab, setActiveTab] = useState<'inventory' | 'forge'>('inventory');
 const [search, setSearch] = useState('');

 const containerRef = React.useRef<HTMLDivElement>(null);
 const [isWideView, setIsWideView] = useState(variant === 'codex');

 useEffect(() => {
 if (!containerRef.current) return;
 const observer = new ResizeObserver((entries) => {
 for (const entry of entries) {
 setIsWideView(entry.contentRect.width > 650);
 }
 });
 observer.observe(containerRef.current);
 return () => observer.disconnect();
 }, []);

 const filteredInventory = useMemo(() => {
 const inv = character?.inventory || [];
 return inv.filter((i: any) => i.name.toLowerCase().includes(search.toLowerCase()));
 }, [character?.inventory, search]);

 const groupedInventory = useMemo(() => {
 const groups: any[] = [];
 const unequippedStacks: Record<string, any> = {};

 filteredInventory.forEach((item: any) => {
 if (item.equipped) {
 groups.push({ ...item, quantity: 1, isStack: false });
 } else {
 const itemId = item.id;
 if (!unequippedStacks[itemId]) {
 unequippedStacks[itemId] = { ...item, quantity: 0, isStack: true, instances: [] };
 groups.push(unequippedStacks[itemId]);
 }
 unequippedStacks[itemId].quantity += 1;
 unequippedStacks[itemId].instances.push(item.instanceId);
 }
 });

 return groups;
 }, [filteredInventory]);

 useEffect(() => {
 if (isMJ && !character && activeTab === 'inventory') {
 setActiveTab('forge');
 }
 }, [isMJ, character, activeTab]);

 const handleToggleEquip = async (itemToToggle?: any) => {
 const item = itemToToggle || selectedItem;
 if (!character || !item) return;

 const targetInstanceId = item.instanceId || (item.isStack ? item.instances[0] : null);
 if (!targetInstanceId) return;

 const newEquipped = !item.equipped;
 let rolledValues = item.rolledValues || [];
 const diceResults: any[] = [];

 // Si on équipe, on calcule les dés
 if (newEquipped && item.modifiers) {
 const { parseAndRoll } = await import('../../services/des.service');
 const { DEFAULT_STATS, DEFAULT_BARS } = await import('../../systems/seal/constants');
 
 const statValues: Record<string, number> = {};
 const labelMapping: Record<string, string> = {};
 
 DEFAULT_STATS.forEach(s => {
 statValues[s.id] = character.stats?.[s.id] || 20;
 labelMapping[s.id] = s.name;
 });
 DEFAULT_BARS.forEach(b => {
 statValues[b.id] = character.bars?.[b.id] || 100;
 labelMapping[b.id] = b.name;
 });

 rolledValues = [];
 
 item.modifiers.forEach((m: any, idx: number) => {
 if (m.mode === 'dice' && m.formula) {
 let formula = m.formula;
 const sortedStats = Object.keys(statValues).sort((a, b) => b.length - a.length);
 sortedStats.forEach((key) => {
 const val = statValues[key];
 const label = labelMapping[key];
 const regex = new RegExp(`(?<=\\b|d)${key}\\b`, 'gi');
 formula = formula.replace(regex, `(${label}=${val})`);
 });
 
 console.log('[DEBUG INV DICE] Original formula:', m.formula);
 console.log('[DEBUG INV DICE] Processed formula:', formula);
 
 const rollRes = parseAndRoll(formula);
 console.log('[DEBUG INV DICE] Roll Result:', rollRes);
 
 rolledValues[idx] = rollRes.total;
 
 if (rollRes.rolls.length > 0) {
 diceResults.push({
 rolls: rollRes.rolls || [],
 total: rollRes.total,
 bonus: 0,
 diceString: m.formula,
 label: `Bonus ${m.targetId}`,
 groups: rollRes.groups,
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name
 });
 }
 } else {
 rolledValues[idx] = 0; // fallback
 }
 });
 }

 const updatedChar = {
 ...character,
 inventory: (character.inventory || []).map((i: any) => 
 (i.instanceId === targetInstanceId) ? { ...i, equipped: newEquipped, rolledValues } : i
 )
 };
 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 
 if (diceResults.length > 0) {
 const { useDiceStore } = await import('../../store/dice');
 const diceState = useDiceStore.getState();
 diceState.setDiceResult(diceResults);
 if (diceState.diceSharingEnabled) {
 diceResults.forEach(r => broadcast({ type: 'DICE_ROLL', payload: r }));
 } else if (!isMJ && session?.hostPeerId) {
 diceResults.forEach(r => sendTo(session.hostPeerId, { type: 'SECRET_DICE_ROLL', payload: r }));
 }
 }
 
 const updatedItem = updatedChar.inventory.find((i: any) => i.instanceId === targetInstanceId);
 if (updatedItem) {
 if (selectedItem?.instanceId === targetInstanceId || (item.isStack && selectedItem?.id === item.id)) {
 setSelectedItem(updatedItem, false);
 }

 // Log + Broadcast ITEM_EQUIPPED
 const logPayload = {
 item_id: updatedItem.id,
 item_name: updatedItem.name,
 item_type: updatedItem.category,
 equipped: updatedItem.equipped,
 sender_id: user?.id,
 sender_name: character.name,
 };
 broadcast({ type: 'ITEM_EQUIPPED', payload: logPayload });
 activityLogService.addLog({
 type: 'item',
 action: `${updatedItem.equipped ? 'Équipe' : 'Déséquipe'} : ${updatedItem.name}`,
 details: logPayload,
 character_id: user?.id,
 character_name: character.name,
 });
 }
 };

 const handleUseItem = async (itemToUse?: any) => {
 const item = itemToUse || selectedItem;
 if (!character || !item) return;

 const targetInstanceId = item.instanceId || (item.isStack ? item.instances[0] : null);
 if (!targetInstanceId) return;

 const updatedBars = { ...(character.bars || {}) };
 let hasEffect = false;

 if (item.modifiers) {
 item.modifiers.forEach((m: any) => {
 if (m.target === 'bar') {
 const barId = m.targetId;
 const currentVal = updatedBars[barId] || 0;
 const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
 const maxVal = updatedBars[maxKey] || currentVal || 100;
 
 let bonus = 0;
 if (m.mode === 'dice' && item.rolledValues) {
 const modIdx = item.modifiers.indexOf(m);
 bonus = item.rolledValues[modIdx] || 0;
 } else {
 bonus = m.value || 0;
 }

 if (m.mode === 'percent') {
 bonus = Math.round(maxVal * (bonus / 100));
 }

 updatedBars[barId] = Math.min(maxVal, currentVal + bonus);
 hasEffect = true;
 }
 });
 }

 const updatedChar = {
 ...character,
 bars: updatedBars,
 inventory: (character.inventory || []).filter((i: any) => i.instanceId !== targetInstanceId)
 };

 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });

 if (selectedItem?.instanceId === targetInstanceId) {
 setSelectedItem(null);
 }
 };

 const handleGiveItemToCharacter = async (item: any) => {
 if (!character || !isMJ) return;
 const clonedItem = { ...item, instanceId: crypto.randomUUID(), equipped: false };
 const updatedChar = {
 ...character,
 inventory: [...(character.inventory || []), clonedItem]
 };
 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 };

 const handleRemoveFromInventory = async (item: any) => {
 const confirmMessage = item.isStack 
 ? t('context.destroyAll', `Détruire tous les exemplaires de ${item.name} ?`, { name: item.name })
 : t('context.destroyOne', `Détruire ${item.name} ?`, { name: item.name });
 if (!character || !isMJ || !(await useConfirmStore.getState().ask(confirmMessage))) return;

 const updatedChar = {
 ...character,
 inventory: (character.inventory || []).filter((i: any) => 
 item.isStack ? i.id !== item.id || i.equipped : i.instanceId !== item.instanceId
 )
 };

 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 if (selectedItem?.instanceId === item.instanceId || (item.isStack && selectedItem?.id === item.id)) {
 setSelectedItem(null);
 }
 };

 const handleDeleteForgeItem = async (id: string) => {
 if (!isMJ || !(await useConfirmStore.getState().ask(t('context.deleteArtifact', "Supprimer cet artefact de la forge ?")))) return;
 await removeItem(sessionId, id);
 };

 const handleEditForgeItem = (item: any) => {
 setShowCreateModal(true, 'forge', undefined, item);
 };

 const getTargetName = (m: any) => {
 if (m.target === 'stat') return DEFAULT_STATS.find(s => s.id === m.targetId)?.name || m.targetId;
 return (DEFAULT_BARS.find(b => b.id === m.targetId)?.name || m.targetId) + (m.targetProperty === 'max' ? ' Max' : '');
 };

 const effectiveTab = (!character && isMJ) ? 'forge' : activeTab;
 const filteredForgeItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

 const openForgeModal = () => {
 setShowCreateModal(true, 'forge');
 };

 const getIcon = (cat: string) => CATEGORY_ICONS[cat] || Package;

 return (
 <div ref={containerRef} className="flex flex-col h-full animate-in fade-in duration-500 relative bg-[#0D0D0F]">
 
 {/* ─── MODALE DÉTAIL (Mode Mobile) ─── */}
 {!isWideView && selectedItem && (
 <div className="absolute inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-md" onClick={() => setSelectedItem(null)}>
 <div className="w-full max-w-sm bg-[#0D0D0F]/95 border border-silver-DEFAULT/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
 <ItemDetailContent 
 item={selectedItem}
 character={character}
 onToggleEquip={effectiveTab === 'inventory' ? () => { handleToggleEquip(selectedItem); } : undefined}
 onUse={effectiveTab === 'inventory' ? () => { handleUseItem(selectedItem); } : undefined}
 onEdit={effectiveTab === 'forge' && isMJ ? () => handleEditForgeItem(selectedItem) : undefined}
 onDelete={effectiveTab === 'forge' && isMJ ? () => handleDeleteForgeItem(selectedItem.id) : undefined}
 onGive={effectiveTab === 'forge' && isMJ && character ? () => handleGiveItemToCharacter(selectedItem) : undefined}
 isMJ={isMJ}
 showActions={false}
 />
 <button 
 onClick={() => setSelectedItem(null)} 
 className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white/60 hover:text-white transition-colors z-50"
 >
 <X size={20} />
 </button>
 </div>
 </div>
 )}

 <ItemCreationModal sessionId={sessionId} />

 <div className="flex-1 flex overflow-hidden">
  <div className={`flex-1 flex flex-col p-4 gap-4 min-w-0 transition-all duration-500`}>
 {isMJ && character && (
 <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5 shrink-0 shadow-inner">
 <button
 onClick={() => setActiveTab('inventory')}
 className={`flex-1 py-2 rounded-lg text-xs font-quantico font-black tracking-widest flex items-center justify-center gap-2 transition-all ${
 effectiveTab === 'inventory' 
 ? 'bg-glacier-DEFAULT text-black shadow-lg' 
 : 'text-white/60 hover:text-white hover:bg-white/5'
 }`}
 >
 <User size={10} /> {character.name.toUpperCase()}
 </button>
 <button
 onClick={() => setActiveTab('forge')}
 className={`flex-1 py-2 rounded-lg text-xs font-quantico font-black tracking-widest flex items-center justify-center gap-2 transition-all ${
 effectiveTab === 'forge' 
 ? 'bg-glacier-DEFAULT text-black shadow-lg' 
 : 'text-white/60 hover:text-white hover:bg-white/5'
 }`}
 >
 <Hammer size={10} /> ARCHIVES
 </button>
 </div>
 )}

 <div className="flex gap-2 shrink-0">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-silver-bright/40" />
 <input 
 type="text" 
 placeholder={t('common.searchPlaceholder', 'Rechercher...').toUpperCase()}
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full bg-black/60 border border-silver-DEFAULT/10 rounded-xl py-2 pl-9 pr-3 text-[11px] font-quantico text-glacier-bright placeholder:text-silver-bright/40 focus:outline-none focus:border-silver-DEFAULT/30 transition-all shadow-inner uppercase tracking-widest"
 />
 </div>
 {effectiveTab === 'forge' && isMJ && (
 <button 
 onClick={openForgeModal}
 className="p-2 rounded-xl bg-glacier-DEFAULT/10 border border-silver-DEFAULT/20 text-glacier-bright hover:bg-glacier-DEFAULT/20 transition-all flex items-center justify-center shadow-lg group"
 >
 <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
 </button>
 )}
 </div>

 <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1.5 pb-4 min-h-0">
 {effectiveTab === 'inventory' ? (
 <>
 {groupedInventory.map((item: any, idx: number) => {
 const Icon = getIcon(item.category);
 const isActive = selectedItem?.instanceId === item.instanceId || (item.isStack && selectedItem?.id === item.id && !selectedItem.equipped);
 const totalPossessed = character?.inventory?.filter((i: any) => i.id === item.id).length || item.quantity || 1;

 return (
 <div 
 key={item.instanceId || `stack-${item.id}-${idx}`} 
 onClick={() => setSelectedItem(item, false)}
 className={`group relative rounded-xl p-2.5 transition-all cursor-pointer flex items-center gap-3 overflow-hidden ${
 isActive ? 'border-glacier-bright bg-glacier-DEFAULT/10 shadow-[0_0_15px_rgba(157, 168, 184,0.1)]' : 'border-white/[0.05] bg-white/[0.02] hover:border-silver-DEFAULT/30'
 }`}
 >
 <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner">
 {item.image_url ? (
 <AssetImage src={item.image_url} alt="" className={`w-full h-full object-contain p-1 ${item.equipped ? 'opacity-100' : 'opacity-40 group-hover:opacity-60 transition-opacity'}`} />
 ) : (
 <Icon size={18} className={item.equipped ? 'text-silver-bright' : 'text-white/10 group-hover:text-white/60'} />
 )}
 </div>
 
 <div className="flex-1 min-w-0 flex flex-col justify-center">
 <div className="flex items-center gap-2">
 <h4 className={`text-xs font-quantico font-black tracking-widest truncate uppercase transition-colors ${item.equipped ? 'text-glacier-bright drop-shadow-[0_0_8px_rgba(157, 168, 184,0.4)]' : (isActive ? 'text-silver-bright' : 'text-white/60 group-hover:text-white')}`}>
 {item.name}
 </h4>
 <span className="shrink-0 font-quantico font-black text-xs px-1 py-0.5 rounded-sm text-black bg-glacier-DEFAULT shadow-sm">x{totalPossessed}</span>
 </div>
 <span className="text-[11px] font-mono text-white/60 uppercase tracking-tighter truncate">{item.category}</span>
 </div>

 {/* ─── ACTIONS SUR LA BARRE ─── */}
 <div className="flex items-center gap-1 shrink-0 z-10">
 {/* Bouton Équiper/Utiliser : Toujours visible si ÉQUIPÉ (indicateur rouge), sinon HOVER */}
 <div className={`transition-all duration-300 ${item.equipped ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'}`}>
 {item.category === 'Consommable' ? (
 <button 
 onClick={(e) => { e.stopPropagation(); handleUseItem(item); }}
 className="p-1.5 rounded-lg bg-glacier-DEFAULT text-black hover:bg-glacier-bright transition-all"
 title={t('common.use', "Utiliser")}
 >
 <Zap size={10} />
 </button>
 ) : (
 <button 
 onClick={(e) => { e.stopPropagation(); handleToggleEquip(item); }}
 className={`p-1.5 rounded-lg transition-all ${
 item.equipped 
 ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/40' 
 : 'bg-glacier-DEFAULT text-black group-hover:bg-glacier-bright transition-colors'
 }`}
 title={item.equipped ? t('common.unequip', "Déséquiper") : t('common.equip', "Équiper")}
 >
 <Shield size={10} />
 </button>
 )}
 </div>

 {/* Bouton Détails (Chevron) */}
 <button 
 onClick={(e) => { e.stopPropagation(); setSelectedItem(item, false); }}
 className="p-1.5 rounded-lg text-white/60 hover:text-glacier-bright hover:bg-white/5 transition-all opacity-30 group-hover:opacity-100"
 title={t('common.seeDetails', "Voir les détails")}
 >
 <ChevronRight size={14} />
 </button>
 
 {/* Actions MJ : Uniquement au hover strict pour ne pas encombrer le nom */}
 {isMJ && (
 <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity ml-0.5 pl-0.5 border-l border-white/5">
 <button 
 onClick={(e) => { e.stopPropagation(); handleRemoveFromInventory(item); }}
 className="p-1.5 rounded-lg bg-red-500/10 text-red-500/40 hover:text-red-500 transition-colors"
 title={t('common.delete', "Supprimer")}
 >
 <Trash2 size={10} />
 </button>
 </div>
 )}
 </div>

 {item.equipped && (
 <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-glacier-DEFAULT shadow-[0_0_10px_rgba(157, 168, 184,0.5)]" />
 )}
 </div>
 );
 })}

 {groupedInventory.length === 0 && (
 <div className="flex flex-col items-center justify-center py-10 opacity-10 grayscale">
 <Package size={32} className="mb-2" />
 <span className="text-xs font-quantico tracking-widest italic">{t('common.empty', 'VIDE...')}</span>
 </div>
 )}
 </>
 ) : (
 <div className="grid grid-cols-1 gap-1.5">
 {filteredForgeItems.map((item) => {
 const Icon = getIcon(item.category);
 const isActive = selectedItem?.id === item.id;
 const possessedCount = character?.inventory?.filter((i: any) => i.id === item.id).length || 0;

 return (
 <div 
 key={item.id} 
 onClick={() => setSelectedItem(item, false)}
 className={`group relative rounded-xl p-2.5 transition-all cursor-pointer flex items-center gap-3 overflow-hidden ${
 isActive ? 'border-glacier-bright bg-glacier-DEFAULT/10 shadow-[0_0_15px_rgba(157, 168, 184,0.1)]' : 'border-white/[0.05] bg-white/[0.02] hover:border-silver-DEFAULT/30'
 }`}
 >
 <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner">
 {item.image_url ? (
 <AssetImage src={item.image_url} alt="" className="w-full h-full object-contain p-1 opacity-40 group-hover:opacity-60 transition-opacity" />
 ) : (
 <Icon size={18} className="text-white/10 group-hover:text-white/60" />
 )}
 </div> 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h4 className={`text-xs font-quantico font-black truncate uppercase tracking-widest transition-colors ${isActive ? 'text-glacier-bright' : 'text-white/60 group-hover:text-white'}`}>{item.name}</h4>
 {possessedCount > 0 && (
 <span className="shrink-0 font-quantico font-black text-xs px-1 py-0.5 rounded-sm text-black bg-glacier-DEFAULT shadow-sm">x{possessedCount}</span>
 )}
 </div>
 <span className="text-[11px] text-white/60 uppercase font-quantico tracking-widest">{item.category}</span>
 </div>

 {/* ─── ACTIONS SUR LA BARRE ─── */}
 <div className="flex items-center gap-1 shrink-0 z-10">
 {isMJ && (
 <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
 {character && (
 <button 
 onClick={(e) => { e.stopPropagation(); handleGiveItemToCharacter(item); }}
 className="p-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-all"
 title={t('common.give', "Offrir")}
 >
 <Plus size={10} />
 </button>
 )}
 <button 
 onClick={(e) => { e.stopPropagation(); handleEditForgeItem(item); }}
 className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
 title={t('common.edit', "Modifier")}
 >
 <PenTool size={10} />
 </button>
 <button 
 onClick={(e) => { e.stopPropagation(); handleDeleteForgeItem(item.id); }}
 className="p-1.5 rounded-lg bg-red-500/10 text-red-500/40 hover:text-red-500 transition-colors"
 title={t('common.delete', "Supprimer")}
 >
 <Trash2 size={10} />
 </button>
 </div>
 )}

 {/* Bouton Détails (Chevron) */}
 <button 
 onClick={(e) => { e.stopPropagation(); setSelectedItem(item, false); }}
 className="p-1.5 rounded-lg text-white/60 hover:text-glacier-bright hover:bg-white/5 transition-all opacity-30 group-hover:opacity-100"
 title={t('common.seeDetails', "Voir les détails")}
 >
 <ChevronRight size={14} />
 </button>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>

 {/* ─── PANNEAU DE DÉTAIL (Mode Codex / Fenêtre large) ─── */}
 {isWideView && (
 <div className={`transition-all duration-500 overflow-hidden bg-black/20 flex flex-col min-h-0 ${selectedItem ? 'w-[384px] shrink-0 border-l border-white/5 opacity-100' : 'w-0 opacity-0'}`}>
 {selectedItem ? (
 <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 duration-500 relative">
 <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/40 shrink-0">
 <span className="text-[11px] font-quantico font-black text-silver-bright tracking-[0.3em] uppercase">{t('context.itemDetails', 'Détails du Vestige')}</span>
 <button onClick={() => setSelectedItem(null)} className="p-1 rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors">
 <X size={14} />
 </button>
 </div>
 <div className="flex-1 overflow-hidden flex flex-col min-h-0">
 <ItemDetailContent 
 item={selectedItem}
 character={character}
 fullHeight={true}
 onToggleEquip={effectiveTab === 'inventory' ? () => handleToggleEquip(selectedItem) : undefined}
 onUse={effectiveTab === 'inventory' ? () => handleUseItem(selectedItem) : undefined}
 onEdit={effectiveTab === 'forge' && isMJ ? () => handleEditForgeItem(selectedItem) : undefined}
 onDelete={effectiveTab === 'forge' && isMJ ? () => handleDeleteForgeItem(selectedItem.id) : undefined}
 onGive={effectiveTab === 'forge' && isMJ && character ? () => handleGiveItemToCharacter(selectedItem) : undefined}
 isMJ={isMJ}
 />
 </div>
 </div>
 ) : (
 <div className="h-full flex flex-col items-center justify-center opacity-10 pointer-events-none">
 <Sparkles size={64} className="mb-4 text-silver-bright" />
 <span className="text-xs font-quantico font-black tracking-[0.4em] uppercase">{t('context.itemCodex', 'Codex des Vestiges')}</span>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 );
}
