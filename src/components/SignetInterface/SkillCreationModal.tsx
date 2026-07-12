import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Zap, Plus, X, Save, BarChart2, BookOpen, Shuffle, Backpack, ChevronDown, Dices, Power, Upload, Loader2, Trash2 } from 'lucide-react';
import { useSkillsStore } from '../../store/skills';
import { useUIStore } from '../../store/ui';
import { useAuthStore } from '../../store/auth';
import { useTagsStore } from '../../store/tags';
import { TagManagementModal } from './TagManagementModal';
import { DEFAULT_STATS, DEFAULT_BARS } from '../../systems/seal/constants';
import { useAssetUpload } from '../../hooks/useAssetUpload';
import { useSessionStore } from '../../store/session';
import { useTranslation } from 'react-i18next';

interface SkillCreationModalProps {
 sessionId: string;
}

export function SkillCreationModal({ sessionId }: SkillCreationModalProps) {
 const { t } = useTranslation();
 const { showSkillCreateModal, setShowSkillCreateModal, skillToEdit, skillCreationType } = useUIStore();
 const { addSkill } = useSkillsStore();
 const { tags } = useTagsStore();
 const [showTagManager, setShowTagManager] = useState(false);
 const session = useSessionStore(state => state.sessions.find(s => s.id === sessionId));
 const statDefs = session?.settings?.stats || DEFAULT_STATS;
 const barDefs = session?.settings?.bars || DEFAULT_BARS;
 
 const [name, setName] = useState('');
 const [description, setDescription] = useState('');
 const [type, setType] = useState<'active' | 'passive_auto' | 'passive_toggle' | 'passive_conditional'>('active');
 const { imageUrl, setImageUrl, isUploading, handleFileUpload } = useAssetUpload();
 const [selectedTags, setSelectedTags] = useState<string[]>([]);

 // Coûts multiples
 const [costs, setCosts] = useState<any[]>([]);

 // Effets techniques (Dégâts, Soins, etc)
 const [effects, setEffects] = useState<any[]>([]);

 // Modificateurs (Bonus passifs ou Aura)
 const [modifiers, setModifiers] = useState<any[]>([]);

 // Conditions
 const [conditionType, setConditionType] = useState<'none' | 'item' | 'skill' | 'both'>('none');
 const [conditionTags, setConditionTags] = useState<string[]>([]);

 useEffect(() => {
 if (showSkillCreateModal && skillToEdit) {
 setName(skillToEdit.name || '');
 setDescription(skillToEdit.description || '');
 setType(skillToEdit.type || 'active');
 setImageUrl(skillToEdit.image_url || '');
 setSelectedTags(skillToEdit.tags || []);
      if (skillToEdit.costs && Array.isArray(skillToEdit.costs)) {
        setCosts(skillToEdit.costs.filter((c: any) => c != null));
      } else if (skillToEdit.cost) {
        setCosts([{ id: window.crypto.randomUUID ? window.crypto.randomUUID() : 'temp-id', mode: 'fixed', value: skillToEdit.cost.value, barId: skillToEdit.cost.barId }]);
      } else {
        setCosts([]);
      }
      setEffects(Array.isArray(skillToEdit.effects) ? skillToEdit.effects.filter((e: any) => e != null) : []);
      setModifiers(Array.isArray(skillToEdit.modifiers) ? skillToEdit.modifiers.filter((m: any) => m != null) : []);
      setConditionType(skillToEdit.condition_type || 'none');
      setConditionTags(Array.isArray(skillToEdit.condition_tags) ? skillToEdit.condition_tags.filter((t: any) => t != null) : []);
 } else {
 setName('');
 setDescription('');
 setType('active');
 setImageUrl('');
 setSelectedTags([]);
      setCosts([]);
 setEffects([]);
 setModifiers([]);
 setConditionType('none');
 setConditionTags([]);
 }
 }, [showSkillCreateModal, skillToEdit]);

 const handleSave = async () => {
 if (!name) return;

 const skillData = {
 id: skillToEdit?.id || crypto.randomUUID(),
 name,
 description,
 type,
 image_url: imageUrl,
 tags: selectedTags,
      costs: costs.length > 0 ? costs : undefined,
 effects,
 modifiers,
 condition_type: conditionType !== 'none' ? conditionType : undefined,
 condition_tags: conditionTags.length > 0 ? conditionTags : undefined,
 };

 if (skillCreationType === 'inventory') {
 const { useCharactersStore } = await import('../../store/characters');
 const { controlledCharacterId } = useCharactersStore.getState();
 const character = useCharactersStore.getState().characters.find(c => c.id === controlledCharacterId);
 if (character) {
 const updatedChar = {
 ...character,
 custom_skills: (character.custom_skills || []).map((s: any) => s.id === skillData.id ? { ...skillData, is_active: s.is_active } : s)
 };
 useCharactersStore.getState().addOrUpdateCharacter(updatedChar);
 }
 } else {
 await addSkill(sessionId, skillData as any);
 }

 setShowSkillCreateModal(false);
 };

  const addCost = () => {
    setCosts([...costs, { id: crypto.randomUUID(), mode: 'fixed', value: 1, barId: DEFAULT_BARS[0]?.id || 'hp' }]);
  };

  const updateCost = (id: string, updates: any) => {
    setCosts(costs.map(c => c.id === id ? { ...c, ...updates } : c));
  };

 const addEffect = () => {
 setEffects([...effects, { id: crypto.randomUUID(), type: 'damage', mode: 'dice', formula: '1d6', valeur: 0, description: '' }]);
 };

 const updateEffect = (id: string, updates: any) => {
 setEffects(effects.map(e => e.id === id ? { ...e, ...updates } : e));
 };

 const addModifier = () => {
 setModifiers([...modifiers, { target: 'stat', targetId: 'strength', mode: 'flat', value: 1 }]);
 };

 const updateModifier = (index: number, updates: any) => {
 const newMods = [...modifiers];
 newMods[index] = { ...newMods[index], ...updates };
 setModifiers(newMods);
 };



 if (!showSkillCreateModal) return null;

 return createPortal(
 <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 lg:p-10 animate-in fade-in zoom-in-95 duration-300">
 <div className="w-full max-w-4xl max-h-[90vh] bg-[#0D0D0F] border border-silver-DEFAULT/40 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8),0_0_40px_rgba(79,164,184,0.1)] flex flex-col overflow-hidden relative">
 
 {/* Decorative Golden Line Top */}
 <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-glacier-bright to-transparent opacity-50" />

 {/* HEADER FIXED */}
 <header className="shrink-0 p-6 lg:p-8 border-b border-silver-DEFAULT/20 flex justify-between items-center bg-black/40 z-20">
 <div className="flex items-center gap-5">
 <div className="p-4 rounded-2xl bg-glacier-DEFAULT/10 border border-silver-DEFAULT/20 text-glacier-bright shadow-lg shadow-glacier-DEFAULT/5 transition-transform hover:scale-110 duration-500">
 <Sparkles size={28} className="animate-pulse" />
 </div>
 <div>
 <h2 className="text-2xl font-quantico font-black text-white uppercase tracking-[0.3em] leading-none mb-2">
 {skillToEdit ? t('context.editSkill', "MODIFIER LA COMPÉTENCE") : t('context.createSkill', "CRÉER UNE COMPÉTENCE")}
 </h2>
 <p className="text-xs font-quantico text-silver-bright/60 uppercase tracking-[0.4em]">{t('context.skillsManagement', "Gestion des compétences")}</p>
 </div>
 </div>
 <button 
 onClick={() => setShowSkillCreateModal(false)}
 className="p-3 rounded-full hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
 >
 <X size={24} />
 </button>
 </header>

 {/* SCROLLABLE CONTENT */}
 <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-12 max-w-3xl mx-auto w-full">
 
 {/* COLONNE GAUCHE : IDENTITÉ */}
 <div className="space-y-10">
 <section className="space-y-6">
 <h3 className="text-xs font-quantico font-black text-silver-bright/70 uppercase tracking-[0.3em] flex items-center gap-3">
 <div className="w-1.5 h-1.5 rounded-full bg-glacier-bright animate-pulse" /> {t('context.informations', "Informations")}
 </h3>
 <div className="space-y-6">
 <div className="space-y-2">
 <label className="text-[11px] font-quantico font-black text-white/70 uppercase tracking-widest ml-1">{t('context.skillName', "Nom de la compétence")}</label>
 <input 
 type="text" 
 value={name} 
 onChange={e => setName(e.target.value)} 
 placeholder={t('context.skillNamePlaceholder', "NOM DE L'ARCANE...")}
 className="w-full bg-black/60 border border-silver-DEFAULT/20 rounded-2xl px-5 py-4 text-sm font-quantico text-white placeholder:text-white/30 focus:border-glacier-bright focus:bg-black/80 focus:shadow-[0_0_15px_rgba(79,164,184,0.1)] outline-none transition-all uppercase tracking-widest shadow-inner"
 />
 </div>
 <div className="space-y-2">
 <label className="text-[11px] font-quantico font-black text-white/70 uppercase tracking-widest ml-1">{t('common.description', "Description")}</label>
 <textarea 
 value={description} 
 onChange={e => setDescription(e.target.value)}
 placeholder={t('context.skillDescPlaceholder', "DÉCRIVEZ LA NATURE DE CET ARCANNE...")}
 rows={4}
 className="w-full bg-black/60 border border-silver-DEFAULT/20 rounded-2xl px-5 py-4 text-sm font-garamond italic text-white/70 placeholder:text-white/30 focus:border-glacier-bright focus:bg-black/80 outline-none transition-all shadow-inner custom-scrollbar resize-none"
 />
 </div>
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <label className="text-[11px] font-quantico font-black text-white/70 uppercase tracking-widest ml-1">{t('context.tags', "Tags & Catégories")}</label>
 <div className="flex gap-2">
 <select 
 className="flex-1 bg-black/60 border border-silver-DEFAULT/20 rounded-lg px-2 py-1 text-xs text-white outline-none cursor-pointer"
 value=""
 onChange={(e) => {
 const val = e.target.value;
 if (val && !selectedTags.includes(val)) setSelectedTags([...selectedTags, val]);
 }}
 >
 <option value="" disabled>{t('common.select', "Sélectionner...")}</option>
 {tags.filter(t => !selectedTags.includes(t.id)).map(t => (
 <option key={t.id} value={t.id}>{t.name}</option>
 ))}
 </select>
 <button onClick={() => setShowTagManager(true)} className="px-2 py-1 rounded-lg bg-glacier-DEFAULT/10 hover:bg-glacier-DEFAULT/20 border border-silver-DEFAULT/20 text-glacier-bright transition-colors">
 <Plus size={14} />
 </button>
 </div>
 </div>
 <div className="flex flex-wrap gap-2">
 {selectedTags.length === 0 && (
 <span className="text-[11px] font-garamond italic text-white/30">{t('context.noTags', "Aucun tag sélectionné...")}</span>
 )}
 {selectedTags.map(tagId => {
 const tag = tags.find(t => t.id === tagId);
 if (!tag) return null;
 return (
 <div key={tag.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-quantico text-white uppercase tracking-widest" style={{ borderLeftColor: tag.color, borderLeftWidth: '2px' }}>
 <span>{tag.name}</span>
 <button onClick={() => setSelectedTags(selectedTags.filter(id => id !== tag.id))} className="text-white/40 hover:text-red-400 transition-colors ml-1">
 <X size={10} />
 </button>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 </section>

 <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="text-[11px] font-quantico font-black text-white/70 uppercase tracking-widest ml-1">{t('context.skillType', "Type de compétence")}</label>
 <select 
 value={type} 
 onChange={e => setType(e.target.value as any)}
 className="w-full bg-black/60 border border-silver-DEFAULT/20 rounded-2xl px-5 py-4 text-xs font-quantico text-white uppercase focus:border-glacier-bright outline-none appearance-none cursor-pointer"
 >
 <option value="active">{t('context.activeSkill', "Compétence Active")}</option>
 <option value="passive_auto">{t('context.passiveSkill', "Passif Permanent")}</option>
 <option value="passive_toggle">{t('context.auraSkill', "Aura Activable")}</option>
 <option value="passive_conditional">{t('context.conditionalPassive', "Passif Conditionnel")}</option>
 </select>
 </div>
 <div className="space-y-2">
 <label className="text-[11px] font-quantico font-black text-white/70 uppercase tracking-widest ml-1">{t('context.image', "Image")}</label>
 <div className="flex gap-2">
 <input 
 type="text" 
 value={imageUrl} 
 onChange={e => setImageUrl(e.target.value)}
 placeholder={t('context.urlOrSeal', "URL OU SCEAU...")}
 className="flex-1 bg-black/60 border border-silver-DEFAULT/20 rounded-2xl px-4 py-4 text-[11px] font-mono text-white/60 focus:border-glacier-bright outline-none"
 />
 <label className="p-4 rounded-2xl bg-glacier-DEFAULT/10 border border-silver-DEFAULT/20 text-glacier-bright hover:bg-glacier-DEFAULT/20 cursor-pointer transition-all relative">
 {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
 <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
 </label>
 </div>
 </div>
 </section>

      {/* COÛTS */}
      <section className="space-y-6 p-6 rounded-[2rem] bg-white/[0.02] border border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-quantico font-black text-silver-bright/70 uppercase tracking-[0.3em] flex items-center gap-3">
            <Power size={14} /> {t('context.costs', "Coûts")}
          </h3>
          <button onClick={addCost} className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all shadow-lg">
            <Plus size={16} />
          </button>
        </div>
        
        {costs.length > 0 && (
          <div className="space-y-4 max-h-48 overflow-y-auto custom-scrollbar pr-2">
            {costs.map((c) => (
              <div key={c.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-3 relative animate-in slide-in-from-top-2 duration-300">
                <button 
                  onClick={() => setCosts(costs.filter(x => x.id !== c.id))}
                  className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all z-10"
                >
                  <X size={12} />
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  <select 
                    value={c.barId} 
                    onChange={e => updateCost(c.id, { barId: e.target.value })}
                    className="bg-black border border-white/10 rounded-xl px-3 py-2 text-[11px] font-quantico text-white uppercase focus:border-glacier-bright outline-none"
                  >
                    {DEFAULT_BARS.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <select 
                    value={c.mode} 
                    onChange={e => updateCost(c.id, { mode: e.target.value })}
                    className="bg-black border border-white/10 rounded-xl px-3 py-2 text-[11px] font-quantico text-white uppercase focus:border-glacier-bright outline-none"
                  >
                    <option value="fixed">{t('context.fixedValue', 'Fixe')}</option>
                    <option value="percent">{t('context.percentage', 'Pourcentage (%)')}</option>
                    <option value="dice">{t('context.diceFormula', 'Jet de Dés / Formule')}</option>
                  </select>
                </div>
                
                {c.mode === 'dice' ? (
                  <input 
                    type="text" 
                    value={c.formula || ''} 
                    onChange={e => updateCost(c.id, { formula: e.target.value })}
                    placeholder="ex: 1d6 + strength"
                    className="bg-black border border-white/10 rounded-xl px-4 py-3 text-[12px] font-mono text-glacier-bright text-center outline-none focus:border-glacier-bright w-full"
                  />
                ) : (
                  <input 
                    type="number" 
                    value={c.value} 
                    onChange={e => updateCost(c.id, { value: parseInt(e.target.value) || 0 })}
                    className="bg-black border border-white/10 rounded-xl px-4 py-3 text-[12px] font-mono text-glacier-bright text-center outline-none focus:border-glacier-bright w-full"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </section>
 </div>

 {/* COLONNE DROITE : MÉCANIQUES */}
 <div className="space-y-10">
 
 {/* ACTIONS & JETS DE DES */}
 <section className="space-y-6">
 <div className="flex items-center justify-between border-b border-silver-DEFAULT/20 pb-3">
 <h3 className="text-xs font-quantico font-black text-glacier-bright uppercase tracking-[0.3em] flex items-center gap-3">
 <Zap size={16} className="text-glacier-bright animate-pulse" /> {t('context.actionAndRolls', "Actions & Jets de Dés")}
 </h3>
 <button onClick={addEffect} className="p-2 rounded-xl bg-glacier-DEFAULT text-black hover:bg-glacier-bright transition-all shadow-lg">
 <Plus size={16} />
 </button>
 </div>
 <div className="space-y-4 max-h-72 overflow-y-auto custom-scrollbar pr-2">
 {effects.map((eff) => (
 <div key={eff.id} className="p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/5 space-y-4 relative group hover:border-silver-DEFAULT/30 transition-all animate-in slide-in-from-right-4 duration-300">
 <button 
 onClick={() => setEffects(effects.filter(e => e.id !== eff.id))}
 className="absolute -top-2 -right-2 p-2 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 opacity-30 group-hover:opacity-100 transition-all hover:scale-110"
 >
 <Trash2 size={12} />
 </button>
 <div className="grid grid-cols-3 gap-3">
 <select 
 value={eff.type} 
 onChange={e => updateEffect(eff.id, { type: e.target.value })}
 className="col-span-1 bg-black border border-white/10 rounded-xl px-3 py-2 text-[11px] font-quantico text-white uppercase outline-none focus:border-glacier-bright"
 >
 <option value="damage">{t('context.damage', "Dégâts")}</option>
 <option value="heal">{t('context.heal', "Soin")}</option>
 <option value="pure_roll">{t('context.pureRoll', "Jet Simple")}</option>
 <option value="buff">{t('context.buff', "Bonus (Narratif)")}</option>
 <option value="debuff">{t('context.debuff', "Malus (Narratif)")}</option>
 <option value="utility">{t('context.utility', "Utilité")}</option>
 </select>
 <div className="col-span-2 flex gap-2">
 <select 
 value={eff.mode} 
 onChange={e => updateEffect(eff.id, { mode: e.target.value })}
 className="w-24 bg-black border border-white/10 rounded-xl px-3 py-2 text-[11px] font-quantico text-white outline-none"
 >
 <option value="dice">{t('context.dice', "Dés")}</option>
 <option value="flat">{t('context.flat', "Fixe")}</option>
 </select>
 <input 
 type="text" 
 value={eff.mode === 'dice' ? eff.formula : eff.valeur}
 onChange={e => updateEffect(eff.id, eff.mode === 'dice' ? { formula: e.target.value } : { valeur: parseInt(e.target.value) })}
 placeholder={eff.mode === 'dice' ? "1d6..." : "0"}
 className="flex-1 bg-glacier-DEFAULT/10 border border-silver-DEFAULT/40 rounded-xl px-3 py-2 text-[11px] font-mono text-glacier-bright text-center outline-none focus:border-glacier-bright"
 />
 </div>
 </div>
 <input 
 type="text" 
 value={eff.description} 
 onChange={e => updateEffect(eff.id, { description: e.target.value })}
 placeholder={t('context.effectDescPlaceholder', "PROPRIÉTÉ DE LA MANIFESTATION...")}
 className="w-full bg-black/40 border border-white/5 rounded-xl text-xs font-inter italic text-white/50 px-4 py-2.5 focus:outline-none focus:border-silver-DEFAULT/40"
 />
 </div>
 ))}
 {effects.length === 0 && (
 <div className="py-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
 <span className="text-xs font-quantico text-white/10 uppercase tracking-[0.4em] italic">{t('context.noActionAndRolls', "Aucune action / jet")}</span>
 </div>
 )}
 </div>
 </section>

 {/* BONUS PASSIFS */}
 <section className="space-y-6">
 <div className="flex items-center justify-between border-b border-silver-DEFAULT/20 pb-3">
 <h3 className="text-xs font-quantico font-black text-glacier-bright uppercase tracking-[0.3em] flex items-center gap-3" title="S'applique passivement au personnage quand la compétence est équipée">
 <BarChart2 size={16} className="text-glacier-bright" /> {t('context.passiveAuras', "Bonus Passifs Permanents")}
 </h3>
 <button onClick={addModifier} className="p-2 rounded-xl bg-glacier-DEFAULT text-black hover:bg-glacier-bright transition-all shadow-lg">
 <Plus size={16} />
 </button>
 </div>
 <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-2">
 {modifiers.map((m, i) => (
 <div key={i} className="flex flex-col gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-silver-DEFAULT/30 transition-all animate-in slide-in-from-right-4 duration-300">
 <div className="flex items-center gap-3">
 <select 
 value={m.target} 
 onChange={e => updateModifier(i, { target: e.target.value as any })}
 className="w-28 bg-black border border-white/10 rounded-xl px-3 py-2.5 text-[11px] font-quantico font-black text-silver-bright uppercase outline-none"
 >
 <option value="stat">{t('context.attribute', "ATTRIBUT").toUpperCase()}</option>
 <option value="bar">{t('context.resource', "RESSOURCE").toUpperCase()}</option>
 </select>
 <select 
 value={m.targetId} 
 onChange={e => updateModifier(i, { targetId: e.target.value })}
 className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs font-quantico font-bold text-white uppercase outline-none focus:border-glacier-bright"
 >
 {m.target === 'stat' ? statDefs.map((s: any) => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>) : barDefs.map((b: any) => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)}
 </select>
 <button onClick={() => setModifiers(modifiers.filter((_, idx) => idx !== i))} className="p-2 rounded-full text-white/60 hover:text-red-500 hover:bg-red-500/10 transition-all">
 <Trash2 size={14} />
 </button>
 </div>
 <div className="flex gap-3 items-center">
 <select 
 value={m.mode || 'flat'} 
 onChange={e => updateModifier(i, { mode: e.target.value as any })}
 className="flex-[2] bg-black border border-white/10 rounded-xl px-4 py-2.5 text-[11px] text-white/60 font-quantico outline-none appearance-none cursor-pointer text-center"
 >
 <option value="flat">{t('context.flatValue', "VALEUR FIXE")}</option>
 <option value="percent">{t('context.percent', "POURCENTAGE")}</option>
 <option value="dice">{t('context.diceRoll', "JET DE DÉS")}</option>
 </select>
 <div className="flex-1">
 {m.mode === 'dice' ? (
   <input 
     type="text" 
     placeholder="1d6..."
     value={m.formula || ''} 
     onChange={e => updateModifier(i, { formula: e.target.value })}
     className="w-full bg-glacier-DEFAULT/10 border border-silver-DEFAULT/40 rounded-xl px-3 py-2.5 text-[11px] font-mono text-glacier-bright text-center outline-none focus:border-glacier-bright"
   />
 ) : (
   <input 
     type="number" 
     value={m.value} 
     onChange={e => updateModifier(i, { value: parseInt(e.target.value) || 0 })}
     className="w-full bg-glacier-DEFAULT/10 border border-silver-DEFAULT/40 rounded-xl px-3 py-2.5 text-[11px] font-mono text-glacier-bright text-center outline-none focus:border-glacier-bright"
   />
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </section>

 {/* CONDITIONS (POUR PASSIF CONDITIONNEL) */}
 {type === 'passive_conditional' && (
 <section className="space-y-6">
 <div className="flex items-center justify-between border-b border-silver-DEFAULT/20 pb-3">
 <h3 className="text-xs font-quantico font-black text-glacier-bright uppercase tracking-[0.3em] flex items-center gap-3">
 <Shuffle size={16} className="text-glacier-bright" /> {t('context.activationConditions', "Conditions d'Activation")}
 </h3>
 </div>
 <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
 <p className="text-[11px] font-quantico text-silver-bright/60 uppercase tracking-widest leading-relaxed">
 {t('context.conditionalDesc', "Le passif ne sera actif QUE si le personnage détient ou active au moins l'un des tags sélectionnés ci-dessous.")}
 </p>
 <div className="flex flex-col gap-3">
  <label className="text-[11px] font-quantico font-black text-white/70 uppercase tracking-widest ml-1">{t('context.conditionSource', "Source des tags")}</label>
  <div className="grid grid-cols-3 gap-2">
  {[
  { value: 'item', label: '🗡 Objet équipé' },
  { value: 'skill', label: '⚡ Compétence active' },
  { value: 'both', label: '✦ Les deux' },
  ].map(opt => (
  <button
  key={opt.value}
  type="button"
  onClick={() => setConditionType(opt.value as any)}
  className={`py-2 px-2 rounded-xl text-[10px] font-quantico font-black uppercase tracking-widest border transition-all ${conditionType === opt.value || (opt.value === 'both' && (conditionType === 'none' || conditionType === 'both')) ? 'bg-glacier-DEFAULT/20 border-glacier-bright text-glacier-bright' : 'bg-black/40 border-white/10 text-white/50 hover:border-white/30'}`}
  >
  {opt.label}
  </button>
  ))}
  </div>
  </div>
  <div className="flex flex-col gap-3">
  <label className="text-[11px] font-quantico font-black text-white/70 uppercase tracking-widest ml-1">{t('context.requiredTags', "Tags Requis (Condition)")}</label>
 <div className="flex gap-2">
 <select 
 className="flex-1 bg-black/60 border border-silver-DEFAULT/20 rounded-lg px-2 py-1 text-xs text-white outline-none cursor-pointer"
 value=""
 onChange={(e) => {
 const val = e.target.value;
 if (val && !conditionTags.includes(val)) setConditionTags([...conditionTags, val]);
 setConditionType('both');
 }}
 >
 <option value="" disabled>{t('common.select', "Sélectionner un tag requis...")}</option>
 {tags.filter(t => !conditionTags.includes(t.id)).map(t => (
 <option key={t.id} value={t.id}>{t.name}</option>
 ))}
 </select>
 </div>
 <div className="flex flex-wrap gap-2">
 {conditionTags.length === 0 && (
 <span className="text-[11px] font-garamond italic text-white/30">{t('context.noTagsRequired', "Aucun tag requis...")}</span>
 )}
 {conditionTags.map(tagId => {
 const tag = tags.find(t => t.id === tagId);
 if (!tag) return null;
 return (
 <div key={tag.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-quantico text-white uppercase tracking-widest" style={{ borderLeftColor: tag.color, borderLeftWidth: '2px' }}>
 <span>{tag.name}</span>
 <button onClick={() => setConditionTags(conditionTags.filter(id => id !== tag.id))} className="text-white/40 hover:text-red-400 transition-colors ml-1">
 <X size={10} />
 </button>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 </section>
 )}

 </div>
 </main>

 {/* FOOTER FIXED & NOBLE */}
 <footer className="shrink-0 p-4 sm:p-8 lg:p-10 border-t border-silver-DEFAULT/30 bg-black/60 backdrop-blur-3xl z-30 relative shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
 <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-glacier-bright/20 to-transparent" />
 
 <div className="flex gap-4">
 <button 
 onClick={() => setShowSkillCreateModal(false)}
 className="flex-1 py-4 rounded-2xl text-white/70 hover:text-white text-xs font-quantico font-black uppercase tracking-[0.3em] transition-all border border-white/20 hover:border-white/40"
 >
 {t('common.cancel', "Annuler")}
 </button>
 <button 
 onClick={handleSave}
 disabled={!name.trim()}
 className={`flex-[2] py-5 text-[11px] font-quantico font-black tracking-[0.4em] rounded-2xl transition-all flex justify-center items-center gap-4 relative group overflow-hidden border-2 ${
 !name.trim()
 ? 'bg-black/20 text-white/40 border-white/15 cursor-not-allowed'
 : 'bg-glacier-DEFAULT text-black border-silver-DEFAULT hover:bg-glacier-bright hover:shadow-[0_0_40px_rgba(79,164,184,0.4)]'
 }`}
 >
 {name.trim() && <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />}
 <Save size={20} className="relative z-10" />
 <span className="relative z-10">{t('common.save', "Enregistrer")}</span>
 </button>
 </div>
 </footer>
 {showTagManager && (
 <TagManagementModal sessionId={sessionId} onClose={() => setShowTagManager(false)} />
 )}
 </div>
 </div>,
 document.body
 );
}
