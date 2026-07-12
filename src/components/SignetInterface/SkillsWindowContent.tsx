import React, { useState, useMemo, useEffect } from 'react';
import { useSkillsStore } from '../../store/skills';
import { useCharactersStore } from '../../store/characters';
import { useTagsStore } from '../../store/tags';
import { useAuthStore, SecurityLevel } from '../../store/auth';
import { useUIStore } from '../../store/ui';
import { useConfirmStore } from '../../store/confirm';
import { usePeer } from '../../hooks/usePeer';
import { useDiceStore } from '../../store/dice';
import { useSessionStore } from '../../store/session';
import { activityLogService } from '../../services/activity-log.service';
import { 
 Sparkles, 
 Search, 
 Plus, 
 Trash2, 
 Zap, 
 BookOpen,
 X,
 PenTool,
 Hammer,
 User,
 Power,
 Info,
 ChevronRight
} from 'lucide-react';
import { SkillCreationModal } from './SkillCreationModal';
import { SkillDetailContent } from './SkillDetailContent';
import { addSessionCharacter } from '../../services/characters.service';
import { AssetImage } from '../AssetImage';
import { useTranslation } from 'react-i18next';

interface SkillsWindowContentProps {
 sessionId: string;
 variant?: 'default' | 'codex';
}

export function SkillsWindowContent({ sessionId, variant = 'default' }: SkillsWindowContentProps) {
 const { t } = useTranslation();
 const { user } = useAuthStore();
 const isMJ = !!user && user.role >= SecurityLevel.MJ;
 const { characters, controlledCharacterId, addOrUpdateCharacter } = useCharactersStore();
 const character = characters.find(c => controlledCharacterId ? c.id === controlledCharacterId : (!!user?.id && c.user_id === user.id));
 const { skills, removeSkill } = useSkillsStore();
 const { tags } = useTagsStore();
 const { setShowSkillCreateModal, setSelectedSkill, selectedSkill } = useUIStore();
 const { broadcast, sendTo } = usePeer();
 const { setDiceResult, diceSharingEnabled } = useDiceStore();
 const session = useSessionStore(state => state.sessions.find(s => s.id === sessionId));

 const [activeTab, setActiveTab] = useState<'inventory' | 'forge'>('inventory');
 const [search, setSearch] = useState('');
 const [selectedTag, setSelectedTag] = useState<string | null>(null);

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

 useEffect(() => {
 if (isMJ && !character && activeTab === 'inventory') {
 setActiveTab('forge');
 }
 }, [isMJ, character, activeTab]);

 const filteredLibrary = useMemo(() => {
 return skills.filter(s => {
 const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
 (s.description && s.description.toLowerCase().includes(search.toLowerCase()));
 const matchesTag = !selectedTag || (s.tags && s.tags.includes(selectedTag));
 return matchesSearch && matchesTag;
 });
 }, [skills, search, selectedTag]);

 const characterSkills = useMemo(() => {
 const sList = character?.custom_skills || [];
 return sList.filter((s: any) => {
 const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
 const matchesTag = !selectedTag || (s.tags && s.tags.includes(selectedTag));
 return matchesSearch && matchesTag;
 });
 }, [character?.custom_skills, search, selectedTag]);

 const handleToggleSkillActive = async (skillToToggle: any) => {
 if (!character) return;
 const newActive = !skillToToggle.is_active;
 
 let updatedModifiers = skillToToggle.modifiers;
 const diceResults: any[] = [];
 
 // Si on active, on calcule les valeurs des dés
 if (newActive && updatedModifiers) {
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
 
 updatedModifiers = updatedModifiers.map((m: any) => {
 if (m.mode === 'dice' && m.formula) {
 let formula = m.formula;
 const sortedStats = Object.keys(statValues).sort((a, b) => b.length - a.length);
 sortedStats.forEach((key) => {
 const val = statValues[key];
 const label = labelMapping[key];
 const regex = new RegExp(`(?<=\\b|d)${key}\\b`, 'gi');
 formula = formula.replace(regex, `(${label}=${val})`);
 });
 
 console.log('[DEBUG DICE] Original formula:', m.formula);
 console.log('[DEBUG DICE] Processed formula:', formula);
 
 const rollRes = parseAndRoll(formula);
 console.log('[DEBUG DICE] Roll Result:', rollRes);
 
 if (rollRes.rolls.length > 0) {
 diceResults.push({
 rolls: rollRes.rolls || [],
 total: rollRes.total,
 bonus: 0,
 diceString: m.formula,
 label: `Bonus ${m.targetId}`,
 groups: rollRes.groups,
 color: '#3b82f6',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name,
 is_skill_roll: true,
 description: m.description || `Modifie ${m.targetId}`
 });
 }
 return { ...m, value: rollRes.total };
 }
 return m;
 });

 if (skillToToggle.effects && skillToToggle.effects.length > 0) {
 skillToToggle.effects.forEach((eff: any) => {
 if (eff.mode === 'dice' && eff.formula) {
 let formula = eff.formula;
 const sortedStats = Object.keys(statValues).sort((a, b) => b.length - a.length);
 sortedStats.forEach((key) => {
 const val = statValues[key];
 const label = labelMapping[key];
 const regex = new RegExp(`(?<=\\b|d)${key}\\b`, 'gi');
 formula = formula.replace(regex, `(${label}=${val})`);
 });

 console.log('[DEBUG EFF DICE] Original:', eff.formula);
 console.log('[DEBUG EFF DICE] Processed:', formula);

 const rollRes = parseAndRoll(formula);
 
 if (rollRes.rolls.length > 0) {
 diceResults.push({
 rolls: rollRes.rolls || [],
 total: rollRes.total,
 bonus: 0,
 diceString: eff.formula,
 label: eff.type === 'damage' ? 'Dégâts' : eff.type === 'heal' ? 'Soin' : eff.type === 'buff' ? 'Amélioration' : eff.type === 'debuff' ? 'Malédiction' : 'Utilitaire',
 groups: rollRes.groups,
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character.name,
 is_skill_roll: true,
 description: eff.description
 });
 }
 }
 });
 }
 }
  const updatedBars = { ...(character.bars || {}) };
  let costApplied = false;

  if (newActive) {
    const costsToApply = skillToToggle.costs || (skillToToggle.cost ? [skillToToggle.cost] : []);
    costsToApply.forEach((c: any) => {
      const barId = c.barId?.toLowerCase();
      const currentVal = updatedBars[barId] || 0;
      let costValue = 0;
      if (c.mode === 'dice' && c.formula) {
        let formula = c.formula;
        const { DEFAULT_STATS, DEFAULT_BARS } = require('../../systems/seal/constants');
        const statValues: Record<string, number> = {};
        const labelMapping: Record<string, string> = {};
        DEFAULT_STATS.forEach((s: any) => { statValues[s.id] = character.stats?.[s.id] || 20; labelMapping[s.id] = s.name; });
        DEFAULT_BARS.forEach((b: any) => { statValues[b.id] = character.bars?.[b.id] || 100; labelMapping[b.id] = b.name; });
        
        Object.keys(statValues).sort((a, b) => b.length - a.length).forEach(key => {
          formula = formula.replace(new RegExp(`(?<=\\b|d)${key}\\b`, 'gi'), `(${labelMapping[key]}=${statValues[key]})`);
        });
        const { parseAndRoll } = require('../../services/des.service');
        const rollRes = parseAndRoll(formula);
        costValue = rollRes.total;
        diceResults.push({ rolls: rollRes.rolls || [], total: rollRes.total, bonus: 0, diceString: c.formula, label: `Coût en ${barId.toUpperCase()}`, color: '#ff4444', secret: !diceSharingEnabled, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name });
      } else if (c.mode === 'percent') {
        const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
        const maxVal = updatedBars[maxKey] || currentVal || 100;
        costValue = Math.round(maxVal * (c.value / 100));
      } else {
        costValue = c.value || 0;
      }
      updatedBars[barId] = Math.max(0, currentVal - costValue);
      costApplied = true;
    });
  }

  const updatedChar = {
  ...character,
  bars: costApplied ? updatedBars : character.bars,
 custom_skills: (character.custom_skills || []).map((s: any) => 
 (s.id === skillToToggle.id) ? { ...s, is_active: newActive, modifiers: updatedModifiers } : s
 )
 };
 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) {
    const { addSessionCharacter } = await import('../../services/characters.service');
    await addSessionCharacter(updatedChar as any);
  }
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

 // Broadcast log de compétence
 const logPayload = {
 skill_id: skillToToggle.id,
 skill_name: skillToToggle.name,
 skill_type: skillToToggle.type,
 description: skillToToggle.description,
 action: newActive ? 'Activée' : 'Désactivée',
 sender_id: user?.id,
 sender_name: character.name,
 results: diceResults
 };
 broadcast({ type: 'SKILL_USED', payload: logPayload });
 activityLogService.addLog({
 type: 'skill',
 action: `${newActive ? 'Active' : 'Désactive'} : ${skillToToggle.name}`,
 details: logPayload,
 character_id: user?.id,
 character_name: character.name,
 });
 };

 const handleUseSkill = async (skill: any) => {
    if (!character) return;
    const { parseAndRoll } = await import('../../services/des.service');
    const { DEFAULT_STATS, DEFAULT_BARS } = await import('../../systems/seal/constants');
    const diceResults: any[] = [];
    const statValues: Record<string, number> = {};
    const labelMapping: Record<string, string> = {};

    // Calcul des modificateurs actifs (objets équipés + passifs auto/toggle)
    const statsFlat: Record<string, number> = {};
    const globalSkills = useSkillsStore.getState().skills;

    (character.inventory || []).forEach((item: any) => {
      if (item.equipped && item.modifiers) {
        item.modifiers.forEach((m: any, idx: number) => {
          if (m.target === 'stat') {
            if (m.mode === 'dice') statsFlat[m.targetId] = (statsFlat[m.targetId] || 0) + (item.rolledValues?.[idx] || 0);
            else statsFlat[m.targetId] = (statsFlat[m.targetId] || 0) + (m.value || 0);
          }
        });
      }
    });

    (character.custom_skills || []).forEach((cs: any) => {
      const template = globalSkills.find(s => s.id === cs.id);
      if (!template) return;
      const sk = { ...template, is_active: cs.is_active, modifiers: cs.modifiers || template.modifiers };
      
      const isAuto = sk.type === 'passive_auto';
      const isToggleActive = sk.type === 'passive_toggle' && sk.is_active;
      // Pour les passifs conditionnels, simplifions en vérifiant que le skill actif possède les tags requis
      let isActive = isAuto || isToggleActive;
      if (!isActive && sk.type === ('passive_conditional' as any) && sk.condition_tags && sk.condition_tags.length > 0) {
        const pool = new Set<string>();
        (character.inventory || []).forEach((i: any) => { if (i.equipped && i.tags) i.tags.forEach((t: string) => pool.add(t)); });
        (character.custom_skills || []).forEach((c: any) => {
          const tpl = globalSkills.find(s => s.id === c.id);
          if (tpl && (tpl.type === 'passive_auto' || (tpl.type === 'passive_toggle' && c.is_active)) && tpl.tags) {
            tpl.tags.forEach((t: string) => pool.add(t));
          }
        });
        if (skill.tags) skill.tags.forEach((t: string) => pool.add(t));
        isActive = sk.condition_tags.every((t: string) => pool.has(t));
      }

      if (isActive && sk.modifiers) {
        sk.modifiers.forEach((m: any) => {
          if (m.target === 'stat') {
            // Note: On applique flat ici, mais normalement on applique base + round(base*percent/100)
            if (m.mode === 'percent') {
                const base = character.stats?.[m.targetId] || 20;
                statsFlat[m.targetId] = (statsFlat[m.targetId] || 0) + Math.round(base * (m.value / 100));
            } else {
                statsFlat[m.targetId] = (statsFlat[m.targetId] || 0) + (m.value || 0);
            }
          }
        });
      }
    });

    DEFAULT_STATS.forEach(s => {
      const base = character.stats?.[s.id] || 20;
      const mod = statsFlat[s.id] || 0;
      statValues[s.id.toLowerCase()] = base + mod;
      labelMapping[s.id.toLowerCase()] = s.name;
    });
    DEFAULT_BARS.forEach(b => {
      statValues[b.id.toLowerCase()] = (character.bars?.[b.id] || 0);
      labelMapping[b.id.toLowerCase()] = b.name;
    });

    // Calcul des coûts
    const updatedBars = { ...(character.bars || {}) };
    let costApplied = false;

    const costsToApply = skill.costs || (skill.cost ? [skill.cost] : []);
    
    costsToApply.forEach((c: any) => {
      const barId = c.barId?.toLowerCase();
      const currentVal = updatedBars[barId] || 0;
      let costValue = 0;
      if (c.mode === 'dice' && c.formula) {
        let formula = c.formula;
        Object.keys(statValues).sort((a, b) => b.length - a.length).forEach(key => {
          formula = formula.replace(new RegExp(`(?<=\\b|d)${key}\\b`, 'gi'), `(${labelMapping[key]}=${statValues[key]})`);
        });
        const rollRes = parseAndRoll(formula);
        costValue = rollRes.total;
        diceResults.push({ rolls: rollRes.rolls || [], total: rollRes.total, bonus: 0, diceString: c.formula, label: `Coût en ${barId.toUpperCase()}`, color: '#ff4444', secret: !diceSharingEnabled, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name });
      } else if (c.mode === 'percent') {
        const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
        const maxVal = updatedBars[maxKey] || currentVal || 100;
        costValue = Math.round(maxVal * (c.value / 100));
      } else {
        costValue = c.value || 0;
      }
      
      updatedBars[barId] = Math.max(0, currentVal - costValue);
      costApplied = true;
    });

    if (skill.effects && skill.effects.length > 0) {
      skill.effects.forEach((eff: any) => {
        const label = eff.description || skill.name;
        const formulaStr = eff.formula || '';
        if (eff.mode === 'dice' && formulaStr) {
          let formula = formulaStr;
          Object.keys(statValues).sort((a, b) => b.length - a.length).forEach(key => {
            formula = formula.replace(new RegExp(`(?<=\\b|d)${key}\\b`, 'gi'), `(${labelMapping[key]}=${statValues[key]})`);
          });
          const rollRes = parseAndRoll(formula);
          const rollTotal = Math.round(rollRes.total);
          // Appliquer l'effet de soin directement sur les bars
          if ((eff.type === 'heal' || eff.targetProperty === 'current') && eff.targetId) {
            const barId = eff.targetId.toLowerCase();
            const currentVal = updatedBars[barId] ?? 0;
            const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
            const maxVal = updatedBars[maxKey] ?? currentVal ?? 100;
            updatedBars[barId] = Math.max(0, Math.min(maxVal, currentVal + rollTotal));
            costApplied = true;
          }
          diceResults.push({ rolls: rollRes.rolls || [], total: rollTotal, bonus: 0, diceString: formulaStr, label, groups: rollRes.groups, color: '#d4af37', secret: !diceSharingEnabled, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name });
        } else if (eff.valeur !== undefined) {
          // Appliquer l'effet de soin fixe directement
          if ((eff.type === 'heal' || eff.targetProperty === 'current') && eff.targetId) {
            const barId = eff.targetId.toLowerCase();
            const currentVal = updatedBars[barId] ?? 0;
            const maxKey = `max${barId.charAt(0).toUpperCase()}${barId.slice(1)}`;
            const maxVal = updatedBars[maxKey] ?? currentVal ?? 100;
            updatedBars[barId] = Math.max(0, Math.min(maxVal, currentVal + (eff.valeur || 0)));
            costApplied = true;
          }
          diceResults.push({ rolls: [eff.valeur], total: eff.valeur, bonus: 0, diceString: 'Fixe', label, color: '#d4af37', secret: !diceSharingEnabled, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name });
        }
      });
    }
    const finalResults = diceResults.length > 0 ? diceResults : [{ rolls: [], total: 0, bonus: 0, diceString: 'Utilisation', label: skill.name, color: '#d4af37', secret: !diceSharingEnabled, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name }];
    
    // Si un coût ou un soin a été appliqué, on met à jour le personnage
    if (costApplied) {
      const updatedChar = { ...character, bars: updatedBars };
      const { useCharactersStore } = await import('../../store/characters');
      useCharactersStore.getState().addOrUpdateCharacter(updatedChar, false);
      if (window.electronAPI) {
        const { addSessionCharacter } = await import('../../services/characters.service');
        await addSessionCharacter(updatedChar as any);
      }
      broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
    }

    setDiceResult(finalResults);
    if (diceSharingEnabled) {
      finalResults.forEach(r => broadcast({ type: 'DICE_ROLL', payload: r }));
    } else if (!isMJ && session?.hostPeerId) {
      finalResults.forEach(r => sendTo(session.hostPeerId, { type: 'SECRET_DICE_ROLL', payload: r }));
    }
  };

 const handleGiveSkillToCharacter = async (skill: any) => {
 if (!character || !isMJ) return;
 if (character.custom_skills?.some((s: any) => s.id === skill.id)) {
 alert(t('context.alreadyHasSkill', "Ce voyageur skill déjà cet arcane."));
 return;
 }
 const updatedChar = {
 ...character,
 custom_skills: [...(character.custom_skills || []), { ...skill, is_active: false }]
 };
 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 };

 const handleRemoveFromCharacter = async (skill: any) => {
 if (!character || !isMJ || !(await useConfirmStore.getState().ask(t('context.forgetSkill', `Oublier ${skill.name} ?`, { name: skill.name })))) return;
 const updatedChar = {
 ...character,
 custom_skills: (character.custom_skills || []).filter((s: any) => s.id !== skill.id)
 };
 addOrUpdateCharacter(updatedChar, false);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 if (selectedSkill?.id === skill.id) setSelectedSkill(null);
 };

 const handleDeleteSkillTemplate = async (id: string) => {
 if (!isMJ || !(await useConfirmStore.getState().ask(t('context.deleteSkill', "Supprimer cette compétence du codex ?")))) return;
 await removeSkill(sessionId, id);
 if (selectedSkill?.id === id) setSelectedSkill(null);
 };

 const effectiveTab = (!character && isMJ) ? 'forge' : activeTab;

 return (
 <div ref={containerRef} className="flex flex-col h-full animate-in fade-in duration-500 relative bg-[#0D0D0F]">
 
 {/* ─── MODALE DÉTAIL (Mode Mobile) ─── */}
 {!isWideView && selectedSkill && (
 <div className="absolute inset-0 z-50 flex items-center justify-center p-2 bg-black/80 backdrop-blur-md" onClick={() => setSelectedSkill(null)}>
 <div className="w-full max-w-sm bg-[#0D0D0F]/95 border border-silver-DEFAULT/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
 <SkillDetailContent 
 skill={selectedSkill} 
 isMJ={isMJ}
 onEdit={effectiveTab === 'forge' && isMJ ? () => setShowSkillCreateModal(true, selectedSkill, 'forge') : (effectiveTab === 'inventory' ? () => setShowSkillCreateModal(true, selectedSkill, 'inventory') : undefined)}
 onDelete={effectiveTab === 'forge' && isMJ ? () => handleDeleteSkillTemplate(selectedSkill.id) : (effectiveTab === 'inventory' && isMJ ? () => handleRemoveFromCharacter(selectedSkill) : undefined)}
 showActions={false}
 />
 <button 
 onClick={() => setSelectedSkill(null)} 
 className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white/60 hover:text-white transition-colors z-50"
 >
 <X size={20} />
 </button>
 </div>
 </div>
 )}

 <SkillCreationModal sessionId={sessionId} />

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
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder={t('common.searchPlaceholder', "CHERCHER...").toUpperCase()}
 className="w-full bg-black/60 border border-silver-DEFAULT/10 rounded-xl py-2 pl-9 pr-3 text-[11px] font-quantico text-glacier-bright placeholder:text-silver-bright/40 focus:outline-none focus:border-silver-DEFAULT/30 transition-all shadow-inner uppercase tracking-widest"
 />
 </div>
 {effectiveTab === 'forge' && isMJ && (
 <button 
 onClick={() => setShowSkillCreateModal(true, null, 'forge')}
 className="p-2 rounded-xl bg-glacier-DEFAULT/10 border border-silver-DEFAULT/20 text-glacier-bright hover:bg-glacier-DEFAULT/20 transition-all flex items-center justify-center group"
 >
 <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
 </button>
 )}
 </div>

 {/* Barre de Tags Compacte */}
 <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
 <button 
 onClick={() => setSelectedTag(null)}
 className={`px-2.5 py-1 rounded-full text-[11px] font-quantico font-black uppercase tracking-widest border transition-all whitespace-nowrap ${!selectedTag ? 'bg-glacier-DEFAULT text-black border-silver-DEFAULT' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'}`}
 >
 {t('common.all', 'TOUT').toUpperCase()}
 </button>
 {tags.map(tag => (
 <button 
 key={tag.id}
 onClick={() => setSelectedTag(tag.id)}
 className={`px-2.5 py-1 rounded-full text-[11px] font-quantico font-black uppercase tracking-widest border transition-all whitespace-nowrap ${selectedTag === tag.id ? 'bg-glacier-DEFAULT text-black border-silver-DEFAULT' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'}`}
 style={selectedTag === tag.id ? {} : { borderLeftColor: tag.color, borderLeftWidth: '2px' }}
 >
 {tag.name}
 </button>
 ))}
 </div>

 <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1.5 pb-4 min-h-0">
 {(effectiveTab === 'inventory' ? characterSkills : filteredLibrary).map((skill) => {
 const isActive = selectedSkill?.id === skill.id;
 const isEquipped = effectiveTab === 'inventory' && skill.is_active;
 
 return (
 <div 
 key={skill.id}
 className={`group relative rounded-xl p-2.5 transition-all flex items-center gap-3 overflow-hidden ${
 isActive ? 'border-glacier-bright bg-glacier-DEFAULT/10 shadow-[0_0_15px_rgba(157, 168, 184,0.1)]' : 'border-white/[0.05] bg-white/[0.02] hover:border-silver-DEFAULT/30'
 }`}
 >
 <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner">
 {skill.image_url ? (
 <AssetImage src={skill.image_url} alt="" className={`w-full h-full object-cover ${isEquipped ? 'opacity-100' : 'opacity-40 group-hover:opacity-100 transition-opacity'}`} />
 ) : (
 <Zap size={18} className={isEquipped ? 'text-silver-bright' : 'text-white/10 group-hover:text-silver-bright/40 transition-colors'} />
 )}
 </div>

 <div className="flex-1 min-w-0 flex flex-col justify-center">
 <h4 className={`text-xs font-quantico font-black tracking-widest truncate uppercase transition-colors ${isEquipped ? 'text-glacier-bright drop-shadow-[0_0_8px_rgba(157, 168, 184,0.4)]' : (isActive ? 'text-silver-bright' : 'text-white/60 group-hover:text-white')}`}>
 {skill.name}
 </h4>
 <span className="text-[11px] font-mono text-white/60 uppercase tracking-tighter truncate">{skill.type || t('context.skillType', 'Compétence')}</span>
 </div>

 {/* ─── ACTIONS SUR LA BARRE ─── */}
 <div className="flex items-center gap-1 shrink-0 z-10">
 {effectiveTab === 'inventory' ? (
 <>
 <div className={`transition-all duration-300 ${isEquipped ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'}`}>
 {skill.type === 'active' && (
 <button 
 onClick={(e) => { e.stopPropagation(); handleUseSkill(skill); }}
 className="p-1.5 rounded-lg bg-glacier-DEFAULT/20 text-glacier-bright border border-glacier-DEFAULT/30 hover:bg-glacier-DEFAULT/40 transition-all"
 title={t('context.useSkill', "Utiliser")}
 >
 <Zap size={10} />
 </button>
 )}
 {skill.type === 'passive_toggle' && (
 <button 
 onClick={(e) => { e.stopPropagation(); handleToggleSkillActive(skill); }}
 className={`p-1.5 rounded-lg transition-all ${isEquipped ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/40' : 'bg-glacier-DEFAULT text-black group-hover:bg-glacier-bright transition-colors'}`}
 title={isEquipped ? t('context.deactivate', "Désactiver") : t('context.activate', "Activer")}
 >
 <Power size={10} />
 </button>
 )}
 </div>

 {/* Bouton Détails (Info) */}
 <button 
 onClick={(e) => { e.stopPropagation(); setSelectedSkill(skill, false); }}
 className="px-2 py-1.5 rounded-lg text-glacier-bright hover:bg-glacier-DEFAULT/20 transition-colors flex items-center gap-1 border border-transparent hover:border-glacier-DEFAULT/30"
 title={t('common.seeDetails', "Voir les détails")}
 >
 <Info size={14} />
 <span className="text-[10px] font-quantico uppercase tracking-widest hidden sm:inline">Détails</span>
 </button>

 {isMJ && (
 <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity ml-0.5 pl-0.5 border-l border-white/5">
 <button 
 onClick={(e) => { e.stopPropagation(); handleRemoveFromCharacter(skill); }}
 className="p-1.5 rounded-lg bg-red-500/10 text-red-500/40 hover:text-red-500 transition-colors"
 title={t('common.delete', "Supprimer")}
 >
 <Trash2 size={10} />
 </button>
 </div>
 )}
 </>
 ) : (
 <>
 {isMJ && (
 <div className="flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
 {character && (
 <button 
 onClick={(e) => { e.stopPropagation(); handleGiveSkillToCharacter(skill); }}
 className="p-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-all"
 title={t('common.give', "Offrir")}
 >
 <Plus size={10} />
 </button>
 )}
 <button 
 onClick={(e) => { e.stopPropagation(); setShowSkillCreateModal(true, skill, 'forge'); }}
 className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
 title={t('common.edit', "Modifier")}
 >
 <PenTool size={10} />
 </button>
 <button 
 onClick={(e) => { e.stopPropagation(); handleDeleteSkillTemplate(skill.id); }}
 className="p-1.5 rounded-lg bg-red-500/10 text-red-500/40 hover:text-red-500 transition-colors"
 title={t('common.delete', "Supprimer")}
 >
 <Trash2 size={10} />
 </button>
 </div>
 )}
 <button 
 onClick={(e) => { e.stopPropagation(); setSelectedSkill(skill, false); }}
 className="p-1.5 rounded-lg text-white/60 hover:text-glacier-bright hover:bg-white/5 transition-all opacity-30 group-hover:opacity-100"
 title={t('common.seeDetails', "Voir les détails")}
 >
 <ChevronRight size={14} />
 </button>
 </>
 )}
 </div>
 
 {isEquipped && (
 <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-glacier-DEFAULT shadow-[0_0_10px_rgba(157, 168, 184,0.5)]" />
 )}
 </div>
 );
 })}

 {(effectiveTab === 'inventory' ? characterSkills : filteredLibrary).length === 0 && (
 <div className="flex flex-col items-center justify-center py-10 opacity-10 grayscale">
 <BookOpen size={32} className="mb-2" />
 <span className="text-xs font-quantico tracking-widest italic">{t('common.empty', "VIDE...")}</span>
 </div>
 )}
 </div>
 </div>

 {/* ─── PANNEAU DE DÉTAIL (Mode Codex) ─── */}
 {isWideView && (
 <div className={`transition-all duration-500 overflow-hidden bg-black/20 flex flex-col min-h-0 ${selectedSkill ? 'w-[384px] shrink-0 border-l border-white/5 opacity-100' : 'w-0 opacity-0'}`}>
 {selectedSkill ? (
 <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right-4 duration-500 relative">
 <div className="p-3 border-b border-white/5 flex justify-between items-center bg-black/40 shrink-0">
 <span className="text-[11px] font-quantico font-black text-silver-bright tracking-[0.3em] uppercase">{t('context.skillDetails', "Détails de la Skill")}</span>
 <button onClick={() => setSelectedSkill(null)} className="p-1 rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors">
 <X size={14} />
 </button>
 </div>
 <div className="flex-1 overflow-hidden flex flex-col min-h-0">
 <SkillDetailContent 
 skill={selectedSkill} 
 isMJ={isMJ}
 fullHeight={true}
 onEdit={effectiveTab === 'forge' && isMJ ? () => setShowSkillCreateModal(true, selectedSkill, 'forge') : (effectiveTab === 'inventory' ? () => setShowSkillCreateModal(true, selectedSkill, 'inventory') : undefined)}
 onDelete={effectiveTab === 'forge' && isMJ ? () => handleDeleteSkillTemplate(selectedSkill.id) : (effectiveTab === 'inventory' && isMJ ? () => handleRemoveFromCharacter(selectedSkill) : undefined)}
 />
 </div>
 </div>
 ) : (
 <div className="h-full flex flex-col items-center justify-center opacity-10 pointer-events-none">
 <Sparkles size={64} className="mb-4 text-silver-bright" />
 <span className="text-xs font-quantico font-black tracking-[0.4em] uppercase">{t('context.skillCodex', "Codex des Skills")}</span>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 );
}
