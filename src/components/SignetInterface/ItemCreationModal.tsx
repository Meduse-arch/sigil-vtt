import React, { useState, useEffect, useRef } from 'react';
import { Hammer, Package, Plus, X, Minus, Sparkles, Sword, Shield, Gem, FlaskConical, Save, Upload, Loader2 } from 'lucide-react';
import { useUIStore } from '../../store/ui';
import { useItemsStore } from '../../store/items';
import { useCharactersStore } from '../../store/characters';
import { useAuthStore, SecurityLevel } from '../../store/auth';
import { usePeer } from '../../hooks/usePeer';
import { Item, ItemModifier } from '../../services/items.service';
import { DEFAULT_STATS, DEFAULT_BARS } from '../../systems/seal/constants';
import { addSessionCharacter } from '../../services/characters.service';
import { useSessionStore } from '../../store/session';
import { useAssetUpload } from '../../hooks/useAssetUpload';
import { useTagsStore } from '../../store/tags';
import { useSkillsStore } from '../../store/skills';
import { AssetImage } from '../AssetImage';
import { useTranslation } from 'react-i18next';

interface ItemCreationModalProps {
 sessionId: string;
}

const CATEGORIES = [
 { id: 'Arme', icon: Sword },
 { id: 'Armure', icon: Shield },
 { id: 'Consommable', icon: FlaskConical },
 { id: 'Artéfact', icon: Sparkles },
 { id: 'Bijou', icon: Gem },
 { id: 'Divers', icon: Package }
];

export function ItemCreationModal({ sessionId }: ItemCreationModalProps) {
 const { t } = useTranslation();
 const { showCreateModal, itemCreationType, itemCreationCharacterId, setShowCreateModal, itemToEdit } = useUIStore();
 const { addItem } = useItemsStore();
 const { characters, addOrUpdateCharacter } = useCharactersStore();
 const { user } = useAuthStore();
 const { broadcast } = usePeer();
 const session = useSessionStore(state => state.sessions.find(s => s.id === sessionId));
 const isMJ = !!user && user.role >= SecurityLevel.MJ;

 const [name, setName] = useState('');
 const [description, setDescription] = useState('');
 const [category, setCategory] = useState('Divers');
 const { imageUrl, setImageUrl, isUploading, fileInputRef, previewUrl, handleFileUpload } = useAssetUpload();
 const { tags } = useTagsStore();
 const { skills } = useSkillsStore();
 const [modifiers, setModifiers] = useState<ItemModifier[]>([]);
 const [selectedTags, setSelectedTags] = useState<string[]>([]);
 const [selectedSkills, setSelectedSkills] = useState<any[]>([]);

 useEffect(() => {
 if (showCreateModal && itemToEdit) {
 setName(itemToEdit.name || '');
 setDescription(itemToEdit.description || '');
 setCategory(itemToEdit.category || 'Divers');
 setImageUrl(itemToEdit.image_url || '');
 setModifiers(Array.isArray(itemToEdit.modifiers) ? itemToEdit.modifiers.filter((m: any) => m != null) : []);
 setSelectedTags(Array.isArray(itemToEdit.tags) ? itemToEdit.tags.filter((t: any) => t != null) : []);
 setSelectedSkills(itemToEdit.skills || []);
 } else if (showCreateModal) {
 resetForm();
 }
 }, [showCreateModal, itemToEdit]);

 const statDefs = session?.settings?.stats || DEFAULT_STATS;
 const barDefs = session?.settings?.bars || DEFAULT_BARS;

 if (!showCreateModal || !isMJ) return null;

 const resetForm = () => {
 setName('');
 setDescription('');
 setCategory('Divers');
 setImageUrl('');
 setModifiers([]);
 setSelectedTags([]);
 setSelectedSkills([]);
 };

 const handleClose = () => {
 resetForm();
 setShowCreateModal(false);
 };

 const addModifier = () => {
 setModifiers([...modifiers, { 
 target: 'stat', 
 targetId: statDefs[0].id, 
 mode: 'flat', 
 value: 1 
 }]);
 };

 const updateModifier = (index: number, updates: Partial<ItemModifier>) => {
 const updated = [...modifiers];
 updated[index] = { ...updated[index], ...updates } as ItemModifier;
 
 if (updates.target === 'bar') {
 updated[index].targetId = barDefs[0]?.id || '';
 updated[index].targetProperty = 'max';
 } else if (updates.target === 'stat') {
 updated[index].targetId = statDefs[0]?.id || '';
 delete updated[index].targetProperty;
 }

 setModifiers(updated);
 };

 const removeModifier = (index: number) => {
 setModifiers(modifiers.filter((_, i) => i !== index));
 };

 const handleSubmit = async () => {
 if (!name.trim()) return;

 const newItem: Item = {
 id: itemToEdit?.id || crypto.randomUUID(),
 name,
 description: description || t('context.mysteriousItem', 'Un objet mystérieux...'),
 category,
 image_url: imageUrl,
 effects: [],
 modifiers,
 tags: selectedTags,
 skills: selectedSkills
 };

 if (itemCreationType === 'forge') {
 await addItem(sessionId, newItem);
 } else if (itemCreationType === 'inventory' && itemCreationCharacterId) {
 const character = characters.find(c => c.id === itemCreationCharacterId);
 if (character) {
 const itemInstanceId = itemToEdit?.instanceId || crypto.randomUUID();
 const equipped = itemToEdit ? itemToEdit.equipped : false;
 const clonedItem = { ...newItem, instanceId: itemInstanceId, equipped };
 
 let newInventory = [...(character.inventory || [])];
 if (itemToEdit) {
 newInventory = newInventory.map((i: any) => i.instanceId === itemInstanceId ? clonedItem : i);
 } else {
 newInventory.push(clonedItem);
 }

 const updatedChar = {
 ...character,
 inventory: newInventory
 };
 addOrUpdateCharacter(updatedChar);
 if (window.electronAPI) await addSessionCharacter(updatedChar);
 broadcast({ type: 'CHAR_UPDATE', payload: updatedChar });
 }
 }

 handleClose();
 };

 return (
 <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 lg:p-10 animate-in fade-in zoom-in-95 duration-300">
 <div className="bg-[#0D0D0F] border border-silver-DEFAULT/40 rounded-[2rem] w-full max-w-4xl max-h-[90vh] shadow-[0_0_100px_rgba(0,0,0,0.8),0_0_40px_rgba(79,164,184,0.1)] flex flex-col overflow-hidden relative">
 
 {/* Decorative Golden Line Top */}
 <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-glacier-bright to-transparent opacity-50" />

 {/* Header Noble Fixed */}
 <header className="shrink-0 bg-black/40 p-6 lg:p-8 border-b border-silver-DEFAULT/20 flex justify-between items-center z-20">
 <div className="flex items-center gap-5">
 <div className="p-4 rounded-2xl bg-glacier-DEFAULT text-black shadow-[0_0_20px_rgba(79,164,184,0.4)] transition-transform hover:scale-110 duration-500">
 {itemCreationType === 'forge' ? <Hammer size={28} /> : <Package size={28} />}
 </div>
 <div>
 <h3 className="text-2xl font-quantico font-black text-white uppercase tracking-[0.3em] leading-none mb-2">
 {itemCreationType === 'forge' ? t('context.createItem', "CRÉER UN OBJET") : t('context.addItem', "AJOUTER UN OBJET")}
 </h3>
 <p className="text-xs font-quantico text-silver-bright/60 uppercase tracking-[0.4em]">
 {itemCreationType === 'forge' ? t('context.forgeDesc', "Forge d'objets — Archives") : t('context.addToInventory', "Ajouter à l'inventaire du personnage")}
 </p>
 </div>
 </div>
 <button 
 onClick={handleClose} 
 className="p-3 rounded-full hover:bg-red-500/10 text-white/60 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
 >
 <X size={24} />
 </button>
 </header>

 {/* Scrollable Body */}
 <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 lg:p-12 space-y-8 sm:space-y-12">
      {/* Main Form Sections */}
      <div className="space-y-8 sm:space-y-12 max-w-3xl mx-auto w-full">
 
 {/* Colonne Gauche : Identité */}
 <div className="space-y-8">
 <div className="flex flex-col gap-3">
 <label className="text-xs font-quantico font-black text-silver-bright/70 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-glacier-bright animate-pulse" /> {t('context.itemName', "Nom de l'objet")}
 </label>
 <input 
 type="text" 
 placeholder={t('context.itemNamePlaceholder', "NOM DE L'ARTÉFACT...")} 
 value={name} 
 onChange={e => setName(e.target.value)} 
 className="bg-black/60 border border-silver-DEFAULT/20 rounded-2xl px-5 py-4 text-sm font-quantico text-white placeholder:text-white/30 focus:border-glacier-bright focus:bg-black/80 focus:shadow-[0_0_15px_rgba(79,164,184,0.1)] outline-none transition-all uppercase tracking-widest shadow-inner" 
 autoFocus 
 />
 </div>

 <div className="flex flex-col gap-3">
 <label className="text-xs font-quantico font-black text-silver-bright/70 uppercase tracking-[0.2em] ml-1">{t('context.itemType', "Type d'objet")}</label>
 <select 
 value={category} 
 onChange={e => setCategory(e.target.value)}
 className="w-full bg-black/60 border border-silver-DEFAULT/20 rounded-2xl px-5 py-4 text-xs font-quantico text-white uppercase focus:border-glacier-bright outline-none appearance-none cursor-pointer"
 >
 {CATEGORIES.map(c => (
 <option key={c.id} value={c.id} className="bg-[#0D0D0F]">
 {c.id.toUpperCase()}
 </option>
 ))}
 </select>
 </div>

 <div className="flex flex-col gap-3">
 <label className="text-xs font-quantico font-black text-silver-bright/70 uppercase tracking-[0.2em] ml-1">{t('common.description', "Description")}</label>
 <textarea 
 placeholder={t('context.itemDescPlaceholder', "Récitez ici la légende qui entoure cet artefact...")} 
 value={description} 
 onChange={e => setDescription(e.target.value)} 
 className="bg-black/60 border border-silver-DEFAULT/20 rounded-2xl px-5 py-4 text-sm font-garamond italic text-white/70 placeholder:text-white/30 focus:border-glacier-bright focus:bg-black/80 outline-none transition-all resize-none h-32 shadow-inner custom-scrollbar" 
 />
 </div>

 <div className="flex flex-col gap-3">
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

 {/* Colonne Droite : Apparence & Modificateurs */}
 <div className="space-y-8">
 <div className="flex flex-col gap-4">
 <label className="text-xs font-quantico font-black text-silver-bright/70 uppercase tracking-[0.2em] ml-1">{t('context.image', "Image")}</label>
 <div className="flex gap-6 items-start">
 <div className="w-24 h-24 rounded-3xl border-2 border-silver-DEFAULT/20 bg-black/40 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl relative group">
 {previewUrl ? (
 <AssetImage src={previewUrl} className="w-full h-full object-contain p-2" alt="Item" />
 ) : (
 <Package size={32} className="text-white/10" />
 )}
 <div className="absolute inset-0 bg-glacier-DEFAULT/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
 </div>
 <div className="flex-1 space-y-4">
 <div className="flex gap-2">
 <input 
 type="text" 
 placeholder={t('context.urlPlaceholder', "URL OU IDENTIFIANT...")} 
 value={imageUrl} 
 onChange={e => setImageUrl(e.target.value)} 
 className="flex-1 bg-black/60 border border-silver-DEFAULT/20 rounded-xl px-4 py-3 text-xs font-mono text-glacier-bright/60 placeholder:text-white/30 focus:border-glacier-bright outline-none transition-all" 
 />
 <button 
 onClick={() => fileInputRef.current?.click()}
 disabled={isUploading}
 className="p-3 rounded-xl bg-glacier-DEFAULT/10 border border-silver-DEFAULT/20 text-glacier-bright hover:bg-glacier-DEFAULT/20 transition-all flex items-center justify-center min-w-[48px] shadow-lg"
 >
 {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
 </button>
 <input 
 type="file" 
 ref={fileInputRef} 
 className="hidden" 
 accept="image/*"
 onChange={handleFileUpload}
 />
 </div>
 <p className="text-xs font-quantico text-white/60 uppercase tracking-[0.2em] leading-relaxed">
 {t('context.localImageTip', "Utilisez une image locale pour la synchroniser avec tous les joueurs.")}
 </p>
 </div>
 </div>
 </div>

 {/* Modifiers UI High Visibility */}
 <div className="space-y-4">
 <div className="flex justify-between items-center border-b border-silver-DEFAULT/30 pb-3">
 <h3 className="text-xs font-quantico font-black text-glacier-bright uppercase tracking-[0.3em] flex items-center gap-2">
 <Sparkles size={16} className="text-glacier-bright animate-pulse" /> {t('context.statModifiers', "Modificateurs de stats")}
 </h3>
 <button onClick={addModifier} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-glacier-DEFAULT text-black font-quantico text-[11px] font-black tracking-widest border-2 border-silver-DEFAULT hover:bg-glacier-bright transition-all">
 <Plus size={14} /> {t('common.add', "Ajouter")}
 </button>
 </div>
 
 <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-2">
 {modifiers.map((m, i) => (
 <div key={i} className="flex flex-col gap-3 p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] relative group hover:border-silver-DEFAULT/30 transition-all animate-in slide-in-from-right-4 duration-300">
 <div className="flex gap-3">
 <select 
 value={m.target} 
 onChange={e => updateModifier(i, { target: e.target.value as any })}
 className="flex-1 bg-black border border-silver-DEFAULT/30 rounded-xl px-3 py-2.5 text-[11px] text-silver-bright font-quantico font-black outline-none appearance-none cursor-pointer text-center"
 >
 <option value="stat">{t('context.attribute', "ATTRIBUT").toUpperCase()}</option>
 <option value="bar">{t('context.resource', "RESSOURCE").toUpperCase()}</option>
 </select>
 <select 
 value={m.targetId} 
 onChange={e => updateModifier(i, { targetId: e.target.value })}
 className="flex-[2] bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/80 font-quantico font-bold outline-none appearance-none cursor-pointer"
 >
 {m.target === 'stat' ? (
 statDefs.map((s: any) => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)
 ) : (
 barDefs.map((b: any) => <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>)
 )}
 </select>
 </div>

 <div className="flex gap-3 items-center">
 <select 
 value={m.mode} 
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
 className="w-full bg-glacier-DEFAULT/10 border-2 border-silver-DEFAULT/40 rounded-xl px-2 py-2 text-xs text-glacier-bright text-center font-mono outline-none focus:border-glacier-bright"
 />
 ) : (
 <input 
 type="number" 
 value={m.value} 
 onChange={e => updateModifier(i, { value: parseInt(e.target.value) || 0 })}
 className="w-full bg-glacier-DEFAULT/10 border-2 border-silver-DEFAULT/40 rounded-xl px-2 py-2 text-xs text-glacier-bright text-center font-mono outline-none focus:border-glacier-bright"
 />
 )}
 </div>
 </div>

 <button onClick={() => removeModifier(i)} className="absolute -top-2 -right-2 p-2 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 opacity-30 group-hover:opacity-100 transition-all hover:scale-110">
 <X size={14} />
 </button>
 </div>
 ))}
 {modifiers.length === 0 && (
 <div className="py-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/[0.02]">
 <span className="text-xs font-quantico text-white/50 uppercase tracking-[0.4em]">{t('context.noModifiers', "Aucun modificateur ajouté")}</span>
 </div>
 )}
 </div>
 </div>
 
 {/* Compétences Section */}
 <div className="space-y-4 mt-8">
 <div className="flex justify-between items-center border-b border-silver-DEFAULT/30 pb-3">
 <h3 className="text-xs font-quantico font-black text-glacier-bright uppercase tracking-[0.3em] flex items-center gap-2">
 <Sparkles size={16} className="text-glacier-bright" /> {t('context.skills', "Compétences liées")}
 </h3>
 <select 
 className="bg-black/60 border border-silver-DEFAULT/20 rounded-lg px-2 py-1 text-xs text-white outline-none cursor-pointer max-w-[150px]"
 value=""
 onChange={(e) => {
 const val = e.target.value;
 if (val) {
 const skill = skills.find(s => s.id === val);
 if (skill && !selectedSkills.find(s => s.id === skill.id)) {
 setSelectedSkills([...selectedSkills, skill]);
 }
 }
 }}
 >
 <option value="" disabled>{t('common.add', "Ajouter...")}</option>
 {skills.filter(s => !selectedSkills.find(sel => sel.id === s.id)).map(s => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>
 
 <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
 {selectedSkills.map(skill => (
 <div key={skill.id} className="flex justify-between items-center bg-white/[0.02] border border-white/10 rounded-xl p-3">
 <span className="text-xs font-quantico text-silver-bright">{skill.name}</span>
 <button 
 onClick={() => setSelectedSkills(selectedSkills.filter(s => s.id !== skill.id))}
 className="text-red-500/40 hover:text-red-500 transition-colors"
 >
 <X size={14} />
 </button>
 </div>
 ))}
 {selectedSkills.length === 0 && (
 <div className="py-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/[0.02]">
 <span className="text-xs font-quantico text-white/50 uppercase tracking-[0.4em]">{t('context.noSkills', "Aucune compétence liée")}</span>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 
 {/* Spacer for scroll visibility */}
 <div className="h-10" />
 </div>
 
 {/* Footer Fixed Noble & Visible */}
 <footer className="shrink-0 p-4 sm:p-8 lg:p-10 border-t border-silver-DEFAULT/30 bg-black/60 backdrop-blur-3xl z-30 relative shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
 {/* Decorative line below content */}
 <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-glacier-bright/20 to-transparent" />
 
 <div className="flex gap-4">
 <button 
 onClick={handleClose}
 className="flex-1 py-4 rounded-2xl text-white/70 hover:text-white text-xs font-quantico font-black uppercase tracking-[0.3em] transition-all border border-white/20 hover:border-white/40"
 >
 {t('common.cancel', "Annuler")}
 </button>
 <button 
 onClick={handleSubmit} 
 disabled={!name.trim()}
 className={`flex-[2] py-5 text-[11px] font-quantico font-black tracking-[0.4em] rounded-2xl transition-all flex justify-center items-center gap-4 relative group overflow-hidden border-2 ${
 !name.trim()
 ? 'bg-black/20 text-white/40 border-white/15 cursor-not-allowed'
 : 'bg-glacier-DEFAULT text-black border-silver-DEFAULT hover:bg-glacier-bright hover:shadow-[0_0_40px_rgba(79,164,184,0.4)]'
 }`}
 >
 {name.trim() && <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />}
 <Save size={20} className="relative z-10" />
 <span className="relative z-10">
 {itemCreationType === 'forge' ? t('common.save', 'Enregistrer') : t('context.addToInventory', "Ajouter à l'inventaire")}
 </span>
 </button>
 </div>
 </footer>
 </div>
 </div>
 );
}
