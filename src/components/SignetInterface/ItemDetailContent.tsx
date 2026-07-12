import React, { useState } from 'react';
import { Shield, Star, Sword, Package, Trash2, Hammer, Zap, Sparkles, Power, Info } from 'lucide-react';
import { Item } from '../../services/items.service';
import { useItemsStore } from '../../store/items';
import { useCharactersStore } from '../../store/characters';
import { usePeer } from '../../hooks/usePeer';
import { useAuthStore } from '../../store/auth';
import { useDiceStore } from '../../store/dice';
import { useSessionStore } from '../../store/session';
import { DEFAULT_STATS, DEFAULT_BARS } from '../../systems/seal/constants';
import { AssetImage } from '../AssetImage';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { SkillDetailContent } from './SkillDetailContent';
import { parseAndRoll } from '../../services/des.service';
import { useSkillsStore } from '../../store/skills';

interface ItemDetailContentProps {
 item: any;
 character?: any;
 onToggleEquip?: () => void;
 onUse?: () => void;
 onEdit?: () => void;
 onDelete?: () => void;
 onGive?: () => void;
 isMJ?: boolean;
 showActions?: boolean;
 fullHeight?: boolean;
}

export function ItemDetailContent({ 
 item: initialItem, 
 character: propCharacter, 
 onToggleEquip, 
 onUse, 
 onEdit, 
 onDelete, 
 onGive, 
 isMJ,
 showActions = true,
 fullHeight = false
}: ItemDetailContentProps) {
 const { t } = useTranslation();
 const { items } = useItemsStore();
 const { characters } = useCharactersStore();
 const { user } = useAuthStore();
 const { broadcast, sendTo } = usePeer();
 const { setDiceResult, diceSharingEnabled } = useDiceStore();

 const [showSkillsModal, setShowSkillsModal] = useState(false);
 const [selectedSkillForDetail, setSelectedSkillForDetail] = useState<any | null>(null);

 // On retrouve la version la plus fraîche du personnage et de l'item
 const character = propCharacter ? (characters.find(c => c.id === propCharacter.id) || propCharacter) : null;
 
 const item = React.useMemo(() => {
 if (!initialItem) return null;
 
 if (character?.inventory) {
 const foundInInv = character.inventory.find((i: any) => i.instanceId === initialItem.instanceId);
 if (foundInInv) return foundInInv;
 }
 
 const foundInForge = items.find(i => i.id === initialItem.id);
 if (foundInForge) return foundInForge;

 return initialItem;
 }, [initialItem, items, character?.inventory]);

 if (!item) return (
 <div className="flex flex-col items-center justify-center h-full opacity-40 py-20">
 <Package size={64} className="mb-4 text-silver-bright" />
 <span className="font-quantico tracking-widest uppercase text-glacier-bright text-xs">{t('context.selectRelic', 'Sélectionnez une relique')}</span>
 </div>
 );

 const isEquipped = item.equipped;
 const isConsumable = item.category === 'Consumable';

 const getTargetName = (m: any) => {
 if (m.target === 'stat') return DEFAULT_STATS.find(s => s.id === m.targetId)?.name || m.targetId;
 return (DEFAULT_BARS.find(b => b.id === m.targetId)?.name || m.targetId) + (m.targetProperty === 'max' ? ' Max' : '');
 };

 const possessedCount = React.useMemo(() => {
 if (!item || !character?.inventory) return 0;
 return character.inventory.filter((i: any) => i.id === item.id).length;
 }, [item, character?.inventory]);

 const handleUseSkill = async (baseSkill: any) => {
  if (!character) return;
  
  const template = useSkillsStore.getState().skills.find((s: any) => s.id === baseSkill.id);
  const skill = template ? { ...template, ...baseSkill, costs: template.costs || baseSkill.costs, cost: template.cost || baseSkill.cost, effects: template.effects || baseSkill.effects } : baseSkill;

  const statValues: Record<string, number> = {};
  const labelMapping: Record<string, string> = {};
  DEFAULT_STATS.forEach((s: any) => {
    statValues[s.id.toLowerCase()] = (character.stats?.[s.id] || 0);
    labelMapping[s.id.toLowerCase()] = s.name;
  });
  DEFAULT_BARS.forEach((b: any) => {
    statValues[b.id.toLowerCase()] = character.bars?.[b.id]?.max || 100;
    labelMapping[b.id.toLowerCase()] = b.name;
  });

  const updatedBars = { ...(character.bars || {}) };
  let costApplied = false;
  const diceResults: any[] = [];

  const costsToApply = skill.costs || (skill.cost ? [skill.cost] : []);
  
  costsToApply.filter((c: any) => c != null).forEach((c: any) => {
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
    skill.effects.filter((e: any) => e != null).forEach((eff: any) => {
      const label = eff.description || skill.name;
      const formulaStr = eff.formula || '';
      if (eff.mode === 'dice' && formulaStr) {
        let formula = formulaStr;
        Object.keys(statValues).sort((a, b) => b.length - a.length).forEach(key => {
          formula = formula.replace(new RegExp(`(?<=\\b|d)${key}\\b`, 'gi'), `(${labelMapping[key]}=${statValues[key]})`);
        });
        const rollRes = parseAndRoll(formula);
        if (rollRes.rolls.length > 0 || rollRes.total > 0) {
          diceResults.push({ rolls: rollRes.rolls || [], total: rollRes.total, bonus: 0, diceString: formulaStr, label, groups: rollRes.groups, color: '#d4af37', secret: false, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name });
        }
      } else if (eff.valeur !== undefined) {
        diceResults.push({ rolls: [eff.valeur], total: eff.valeur, bonus: 0, diceString: 'Fixe', label, color: '#d4af37', secret: false, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name });
      } else {
        diceResults.push({ rolls: [], total: 0, bonus: 0, diceString: 'Effet', label, color: '#d4af37', secret: false, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name });
      }
    });
  }
  const finalResults = diceResults.length > 0 ? diceResults : [{ rolls: [], total: 0, bonus: 0, diceString: 'Utilisation', label: skill.name, color: '#d4af37', secret: !diceSharingEnabled, timestamp: Date.now(), sender_id: user?.id, sender_name: character.name }];
  
  if (costApplied) {
    const updatedChar = { ...character, bars: updatedBars };
    const charsStore = useCharactersStore.getState();
    charsStore.addOrUpdateCharacter(updatedChar, false);
    if (window.electronAPI) {
      import('../../services/characters.service').then(({ addSessionCharacter }) => {
        addSessionCharacter(updatedChar as any);
      });
    }
    broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
  }

  setDiceResult(finalResults);
  if (diceSharingEnabled) {
    finalResults.forEach(r => broadcast({ type: 'DICE_ROLL', payload: r }));
  } else {
    const sessionStore = useSessionStore.getState();
    const hostPeerId = sessionStore.sessions.find(s => s.id)?.hostPeerId;
    if (!isMJ && hostPeerId) {
      finalResults.forEach(r => sendTo(hostPeerId, { type: 'SECRET_DICE_ROLL', payload: r }));
    }
  }
  
  const logPayload = {
    skill_id: skill.id,
    skill_name: skill.name,
    skill_type: skill.type,
    description: skill.description,
    action: `Utilisée depuis ${item.name}`,
    sender_id: user?.id,
    sender_name: character.name,
    results: diceResults
  };
  broadcast({ type: 'SKILL_USED', payload: logPayload });
 };

 const handleToggleItemSkillActive = async (baseSkill: any) => {
  if (!character || !item) return;
  
  const template = useSkillsStore.getState().skills.find((s: any) => s.id === baseSkill.id);
  const skillToToggle = template ? { ...template, ...baseSkill, costs: template.costs || baseSkill.costs, cost: template.cost || baseSkill.cost } : baseSkill;

  const newActive = !skillToToggle.is_active;
  
  let updatedModifiers = skillToToggle.modifiers || [];
  const diceResults: any[] = [];
  
  const updatedBars = { ...(character.bars || {}) };
  let costApplied = false;

  const statValues: Record<string, number> = {};
  const labelMapping: Record<string, string> = {};
  DEFAULT_STATS.forEach((s: any) => { statValues[s.id.toLowerCase()] = (character.stats?.[s.id] || 0); labelMapping[s.id.toLowerCase()] = s.name; });
  DEFAULT_BARS.forEach((b: any) => { statValues[b.id.toLowerCase()] = character.bars?.[b.id]?.max || 100; labelMapping[b.id.toLowerCase()] = b.name; });

  if (newActive) {
    const costsToApply = skillToToggle.costs || (skillToToggle.cost ? [skillToToggle.cost] : []);
    costsToApply.filter((c: any) => c != null).forEach((c: any) => {
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

    updatedModifiers = updatedModifiers.map((m: any) => {
      if (m && m.mode === 'dice' && m.formula) {
        let formula = m.formula;
        Object.keys(statValues).sort((a, b) => b.length - a.length).forEach(key => {
          formula = formula.replace(new RegExp(`(?<=\\b|d)${key}\\b`, 'gi'), `(${labelMapping[key]}=${statValues[key]})`);
        });
        const rollRes = parseAndRoll(formula);
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
          Object.keys(statValues).sort((a, b) => b.length - a.length).forEach(key => {
            formula = formula.replace(new RegExp(`(?<=\\b|d)${key}\\b`, 'gi'), `(${labelMapping[key]}=${statValues[key]})`);
          });
          const rollRes = parseAndRoll(formula);
          if (rollRes.rolls.length > 0 || rollRes.total > 0) {
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

  const updatedInventory = (character.inventory || []).map((invItem: any) => {
    if (invItem.instanceId === item.instanceId) {
      return {
        ...invItem,
        skills: (invItem.skills || item.skills || []).map((s: any) =>
          s.id === skillToToggle.id ? { ...s, is_active: newActive, modifiers: updatedModifiers } : s
        )
      };
    }
    return invItem;
  });

  const updatedChar = {
    ...character,
    bars: costApplied ? updatedBars : character.bars,
    inventory: updatedInventory
  };

  const charsStore = useCharactersStore.getState();
  charsStore.addOrUpdateCharacter(updatedChar, false);
  if (window.electronAPI) {
    import('../../services/characters.service').then(({ addSessionCharacter }) => {
      addSessionCharacter(updatedChar as any);
    });
  }
  broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
  
  if (diceResults.length > 0) {
    setDiceResult(diceResults);
    if (diceSharingEnabled) {
      diceResults.forEach(r => broadcast({ type: 'DICE_ROLL', payload: r }));
    } else {
      const sessionStore = useSessionStore.getState();
      const hostPeerId = sessionStore.sessions.find(s => s.id)?.hostPeerId;
      if (!isMJ && hostPeerId) {
        diceResults.forEach(r => sendTo(hostPeerId, { type: 'SECRET_DICE_ROLL', payload: r }));
      }
    }
  }

  const logPayload = {
    skill_id: skillToToggle.id,
    skill_name: skillToToggle.name,
    skill_type: skillToToggle.type,
    description: skillToToggle.description,
    action: `${newActive ? 'Activée' : 'Désactivée'} depuis ${item.name}`,
    sender_id: user?.id,
    sender_name: character.name,
    results: diceResults
  };
  broadcast({ type: 'SKILL_USED', payload: logPayload });
 };

 return (
 <div className={`w-full min-h-0 flex flex-col relative overflow-hidden bg-[#0D0D0F] ${fullHeight ? 'flex-1' : ''}`}>
 <div 
 className="relative h-32 shrink-0 flex items-center justify-center overflow-hidden border-b border-silver-DEFAULT/20"
 style={{
 background: 'rgba(14, 0, 6, 0.45)',
 backdropFilter: 'blur(16px)',
 }}
 >
 {item.image_url ? (
 <>
 <div className="absolute inset-0 bg-black/60" style={{ backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />
 <AssetImage src={item.image_url} alt="" className="relative z-10 w-full h-full object-contain p-3 drop-shadow-2xl" />
 </>
 ) : (
 <Package size={48} className="text-silver-bright/10 relative z-10" />
 )}
 
 <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0F] via-transparent to-transparent z-20" />
 
 <div className="absolute bottom-2 left-4 right-4 z-30 flex items-end justify-between gap-2">
   <div className="flex flex-col min-w-0">
     <span className="mb-0.5 px-1.5 py-0.5 rounded bg-glacier-DEFAULT/10 text-glacier-bright text-[6px] font-quantico font-black tracking-widest uppercase border border-silver-DEFAULT/20 w-fit">
     {item.category}
     </span>
     <h2 className="text-base font-quantico font-black text-white uppercase tracking-tight truncate">
     {item.name}
     </h2>
   </div>
   
   <div className="flex flex-col items-end gap-1 shrink-0">
     {possessedCount > 0 && (
       <span className="px-2 py-0.5 rounded bg-glacier-DEFAULT text-black font-quantico font-black text-xs shadow-lg border border-black/10">
       x{possessedCount}
       </span>
     )}
   </div>
 </div>
 </div>

 <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">

 {item.skills && item.skills.length > 0 && (
   <div className="shrink-0 px-4 pt-4 pb-1">
     <button 
       onClick={() => setShowSkillsModal(true)}
       className="w-full py-3 rounded-xl font-quantico font-black text-[12px] tracking-[0.2em] transition-all flex items-center justify-center gap-2 border bg-glacier-DEFAULT/10 text-glacier-bright border-glacier-DEFAULT/30 hover:bg-glacier-DEFAULT/20 hover:shadow-[0_0_15px_rgba(79,164,184,0.2)]"
     >
       <Sparkles size={16} /> VOIR LES COMPÉTENCES LIÉES
     </button>
   </div>
 )}
 
 <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/5">
 <div className="flex items-center gap-2 mb-2 opacity-40">
 <div className="h-px flex-1 bg-glacier-DEFAULT/30" />
 <span className="text-[6px] font-quantico font-black uppercase tracking-[0.3em]">{t('context.chroniclesTitle', 'Chroniques')}</span>
 <div className="h-px flex-1 bg-glacier-DEFAULT/30" />
 </div>
 <div className="pr-2">
 <p className="font-garamond italic text-xs text-white/50 leading-relaxed text-center">
 "{item.description || t('context.noItemStory', "Aucun récit n'accompagne cet objet...")}"
 </p>
 </div>
 </div>

 <div className="shrink-0 px-4 py-3 min-h-0 space-y-4">
 <div>
 <div className="flex items-center gap-2 mb-3 opacity-40">
 <div className="h-px flex-1 bg-glacier-DEFAULT/30" />
 <span className="text-[6px] font-quantico font-black uppercase tracking-[0.3em]">{t('context.arithmancyTitle', 'Arithmancie')}</span>
 <div className="h-px flex-1 bg-glacier-DEFAULT/30" />
 </div>
 
 <div className="space-y-1.5">
 {item.modifiers && item.modifiers.filter((m:any) => m != null).length > 0 ? (
 <>
 {item.modifiers.filter((m:any) => m != null).map((m: any, i: number) => (
 <div 
 key={i} 
 className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 transition-all hover:border-silver-DEFAULT/20"
 >
 <div className="flex flex-col min-w-0">
 <span className="text-xs font-quantico font-black text-white/60 uppercase tracking-widest truncate">{getTargetName(m)}</span>
 <span className="text-[6px] font-mono text-silver-bright/30 uppercase">
 {m.target === 'stat' ? t('context.attribute', 'Attribut') : t('context.resource', 'Ressource')}
 </span>
 </div>
 <span className="text-xs font-quantico font-black text-glacier-bright">
 {m.mode === 'dice' ? m.formula : `${m.value >= 0 ? '+' : ''}${m.value}${m.mode === 'percent' ? '%' : ''}`}
 </span>
 </div>
 ))}
 </>
 ) : (
 <div className="flex flex-col items-center justify-center opacity-5 py-4">
 <Sparkles size={20} />
 <span className="text-[6px] font-quantico uppercase tracking-widest mt-1">{t('context.neutral', 'Neutre')}</span>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>

 {showActions && (
 <div className="p-3 bg-black/40 border-t border-white/5 backdrop-blur-xl shrink-0">
 <div className="flex flex-col gap-1.5">
 {character && (
 <>
 {isConsumable ? (
 <button 
 onClick={onUse}
 className="w-full py-2.5 rounded-xl font-quantico font-black text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 border bg-glacier-bright text-black border-glacier-bright hover:shadow-[0_0_20px_rgba(79,164,184,0.3)]"
 >
 <Zap size={12} /> {t('common.use', 'Utiliser').toUpperCase()}
 </button>
 ) : onToggleEquip && (
 <button 
 onClick={onToggleEquip}
 className={`w-full py-2.5 rounded-xl font-quantico font-black text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 border ${
 isEquipped 
 ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
 : 'bg-glacier-DEFAULT text-black border-silver-DEFAULT hover:shadow-[0_0_20px_rgba(79,164,184,0.3)]'
 }`}
 >
 {isEquipped ? <Trash2 size={12} /> : <Shield size={12} />}
 {isEquipped ? t('common.unequip', 'Déséquiper').toUpperCase() : t('common.equip', 'Équiper').toUpperCase()}
 </button>
 )}
 </>
 )}

 {isMJ && (
 <div className="flex gap-1.5">
 {onGive && character && (
 <button 
 onClick={onGive}
 className="flex-1 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all font-quantico text-[11px] font-black uppercase tracking-widest"
 >
 {t('common.give', 'Offrir')}
 </button>
 )}
 {onEdit && (
 <button 
 onClick={onEdit}
 className="flex-1 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all font-quantico text-[11px] font-black uppercase tracking-widest"
 >
 {t('common.edit', 'Modifier')}
 </button>
 )}
 {onDelete && (
 <button 
 onClick={onDelete}
 className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500/40 hover:text-red-500 transition-all"
 >
 <Trash2 size={12} />
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 )}
 
 {showSkillsModal && (
   <div className="absolute inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
     <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0D0D0F]">
       <h3 className="text-sm font-quantico font-black text-glacier-bright uppercase tracking-[0.2em] flex items-center gap-2">
         <Sparkles size={16} /> Compétences
       </h3>
       <button onClick={() => {
         if (selectedSkillForDetail) setSelectedSkillForDetail(null);
         else setShowSkillsModal(false);
       }} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors">
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
       </button>
     </div>
     <div className="flex-1 overflow-y-auto custom-scrollbar p-0 relative">
       {selectedSkillForDetail ? (
         <div className="h-full">
           <SkillDetailContent 
             skill={selectedSkillForDetail}
           />
         </div>
       ) : (
         <div className="p-4 space-y-2">
           {item.skills.map((skill: any) => (
             <div key={skill.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-3 group hover:bg-white/[0.04] transition-colors">
               <div className="flex justify-between items-start">
                 <div className="flex-1 min-w-0 pr-4">
                   <h4 className="text-sm font-quantico font-black text-white uppercase tracking-widest truncate">{skill.name}</h4>
                   <span className="text-[10px] font-mono text-silver-bright/50 uppercase">{skill.type || 'Compétence'}</span>
                 </div>
                 <div className="flex items-center gap-2 shrink-0">
                   <button 
                     onClick={() => setSelectedSkillForDetail(skill)}
                     className="px-2 py-1.5 rounded-lg text-glacier-bright hover:bg-glacier-DEFAULT/20 transition-colors flex items-center gap-1 border border-transparent hover:border-glacier-DEFAULT/30"
                     title="Détails"
                   >
                     <Info size={14} />
                     <span className="text-[10px] font-quantico uppercase tracking-widest hidden sm:inline">Détails</span>
                   </button>
                   {character && isEquipped && (
                     <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                       {(!skill.type || skill.type === 'active') && (
                         <button 
                           onClick={() => { handleUseSkill(skill); setShowSkillsModal(false); }}
                           className="px-3 py-2 rounded-xl bg-glacier-DEFAULT text-black font-quantico font-black text-[10px] tracking-widest flex items-center gap-2 hover:shadow-[0_0_15px_rgba(79,164,184,0.4)] transition-all"
                         >
                           <Zap size={12} /> UTILISER
                         </button>
                       )}
                       {skill.type === 'passive_toggle' && (
                         <button 
                           onClick={() => handleToggleItemSkillActive(skill)}
                           className={`px-3 py-2 rounded-xl font-quantico font-black text-[10px] tracking-widest flex items-center gap-2 transition-all ${
                             skill.is_active 
                               ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/40' 
                               : 'bg-glacier-DEFAULT text-black hover:shadow-[0_0_15px_rgba(79,164,184,0.4)]'
                           }`}
                         >
                           <Power size={12} /> {skill.is_active ? 'DÉSACTIVER' : 'ACTIVER'}
                         </button>
                       )}
                     </div>
                   )}
                 </div>
               </div>
             </div>
           ))}
         </div>
       )}
     </div>
   </div>
 )}
 </div>
 );
}
