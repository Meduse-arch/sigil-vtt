import React, { useState, useEffect, useMemo } from 'react';
import { useDiceStore } from '../../store/dice';
import { useCharactersStore } from '../../store/characters';
import { useAuthStore, SecurityLevel } from '../../store/auth';
import { useSessionStore } from '../../store/session';
import { usePeer } from '../../hooks/usePeer';
import { lancerDes, DiceResult } from '../../services/des.service';
import { addSessionLog, getSessionLogs, SessionLog } from '../../services/db.service';
import { activityLogService } from '../../services/activity-log.service';
import { History, Share2, Plus, Minus, Trash2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_STATS, DEFAULT_SKILLS } from '../../systems/seal/constants';

const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];

export function LancerDes({ sessionId }: { sessionId: string }) {
 const user = useAuthStore(state => state.user);
 const { characters } = useCharactersStore();
 const character = characters.find(c => !!user?.id && c.user_id === user.id);
 const { 
 diceResult, 
 setDiceResult, 
 diceSharingEnabled, 
 setDiceSharingEnabled,
 nbDice,
 setNbDice,
 modifier,
 setModifier
 } = useDiceStore();
 const session = useSessionStore(state => state.sessions.find(s => s.id === sessionId));
 const { broadcast, sendTo } = usePeer();

 const isMJ = !!user && user.role >= SecurityLevel.MJ;

 const [facesDeInput, setFacesDeInput] = useState(20);
 const [logs, setLogs] = useState<SessionLog[]>([]);

 useEffect(() => {
 const loadLogs = async () => {
 const dbLogs = await getSessionLogs(sessionId);
 setLogs(dbLogs.filter(l => l.type === 'des'));
 };
 loadLogs();
 }, [sessionId]);

 const executerLancer = async (labelPerso: string, facesForcees?: number, nbForce?: number) => {
 const nb = Math.max(1, nbForce || nbDice);
 const faces = Math.max(2, facesForcees || facesDeInput);
 const mod = modifier;
 const res = lancerDes(nb, faces, mod);

 const labelPart = labelPerso ? `(${labelPerso}=${faces})` : faces;
 const diceString = `${nb}d${labelPart}${mod !== 0 ? (mod > 0 ? '+' : '') + mod : ''}`;
 
 const result: DiceResult = {
 rolls: res.rolls,
 total: res.total,
 bonus: mod,
 diceString,
 label: labelPerso || 'Jet Manuel',
 color: '#d4af37',
 secret: !diceSharingEnabled,
 timestamp: Date.now(),
 sender_id: user?.id,
 sender_name: character?.name || user?.pseudo || 'Inconnu'
 };

 setDiceResult([result]);

 // Save to DB (Logs)
 const logEntry: SessionLog = {
 id: crypto.randomUUID(),
 type: 'des',
 action: `Lance ${result.label} (${diceString})`,
 details: { rolls: res.rolls, total: res.total, diceString },
 timestamp: Date.now(),
 character_id: character?.id,
 character_name: character?.name || user?.pseudo
 };

 if (window.electronAPI) {
 await addSessionLog(sessionId, logEntry);
 setLogs(prev => [logEntry, ...prev].slice(0, 50));
 }

 // Broadcast via P2P
 if (diceSharingEnabled) {
 broadcast({ type: 'DICE_ROLL', payload: result });
 } else {
 // Envoi du jet secret au MJ pour les annales (si on n'est pas déjà le MJ)
 if (!isMJ && session?.hostPeerId) {
 sendTo(session.hostPeerId, { type: 'SECRET_DICE_ROLL', payload: result });
 }
 }

 // Log local toujours (même en secret, le MJ voit tout dans ses Annales)
 activityLogService.addLog({
 type: 'des',
 action: `Lance ${result.label || result.diceString}`,
 details: {
 rolls: res.rolls,
 total: res.total,
 diceString,
 formula: diceString,
 secret: !diceSharingEnabled,
 },
 character_id: user?.id,
 character_name: result.sender_name,
 });
 };

 const statDefs = session?.settings?.stats || DEFAULT_STATS;

 return (
 <div className="flex flex-col gap-6 h-full overflow-hidden">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
 
 {/* Conteneur de Gauche : Lancer */}
 <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
 
 {/* Dés Rapides */}
 <section className="liquid-glass-panel p-4 flex flex-col gap-3">
 <h3 className="text-xs font-quantico font-black text-silver-bright/60 tracking-widest uppercase border-b border-white/5 pb-2">Sceaux de Destin</h3>
 <div className="flex flex-wrap gap-2">
 {DIE_TYPES.map(faces => (
 <button
 key={faces}
 onClick={() => executerLancer('', faces)}
 className="w-12 h-12 rounded-xl bg-black/40 border border-silver-DEFAULT/30 flex items-center justify-center font-quantico font-black text-glacier-bright hover:scale-110 hover:border-glacier-bright transition-all shadow-lg"
 >
 D{faces}
 </button>
 ))}
 </div>
 </section>

 {/* Manuel */}
 <section className="liquid-glass-panel p-4 flex flex-col gap-4">
 <h3 className="text-xs font-quantico font-black text-silver-bright/60 tracking-widest uppercase border-b border-white/5 pb-2">Invocation Manuelle</h3>
 <div className="flex items-center gap-4 justify-between">
 <div className="flex flex-col items-center gap-1">
 <span className="text-xs font-quantico text-white/60 uppercase">Qté</span>
 <input 
 type="number" 
 value={nbDice} 
 onChange={e => setNbDice(parseInt(e.target.value) || 1)}
 className="w-12 bg-black/40 border border-white/10 rounded-lg p-2 text-center text-glacier-bright font-mono focus:outline-none focus:border-silver-DEFAULT/40"
 />
 </div>
 <span className="text-xl font-quantico text-silver-bright/40 mt-4">D</span>
 <div className="flex flex-col items-center gap-1">
 <span className="text-xs font-quantico text-white/60 uppercase">Faces</span>
 <input 
 type="number" 
 value={facesDeInput} 
 onChange={e => setFacesDeInput(parseInt(e.target.value) || 20)}
 className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-center text-glacier-bright font-mono focus:outline-none focus:border-silver-DEFAULT/40"
 />
 </div>
 <div className="flex flex-col items-center gap-1">
 <span className="text-xs font-quantico text-white/60 uppercase">Mod.</span>
 <input 
 type="number" 
 value={modifier} 
 onChange={e => setModifier(parseInt(e.target.value) || 0)}
 className="w-14 bg-black/40 border border-white/10 rounded-lg p-2 text-center text-glacier-bright font-mono focus:outline-none focus:border-silver-DEFAULT/40"
 />
 </div>
 </div>
 
 <button 
 onClick={() => executerLancer('')}
 className="w-full py-3 rounded-xl bg-glacier-DEFAULT/10 border border-silver-DEFAULT/30 text-glacier-bright font-quantico font-black uppercase tracking-widest hover:bg-glacier-DEFAULT/20 transition-all shadow-inner"
 >
 Interroger l'Oracle
 </button>
 </section>

 {/* SEAL Attributes */}
 {statDefs.length > 0 && (
 <section className="liquid-glass-panel p-4 flex flex-col gap-3">
 <h3 className="text-xs font-quantico font-black text-silver-bright/60 tracking-widest uppercase border-b border-white/5 pb-2">Jets d'Attributs</h3>
 <div className="grid grid-cols-2 gap-2">
 {statDefs.map((stat: any) => {
 const val = character?.stats?.[stat.id] || 20;
 return (
 <button
 key={stat.id}
 onClick={() => executerLancer(stat.name, val)}
 className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center hover:border-silver-DEFAULT/40 transition-all group"
 >
 <span className="text-xs font-quantico text-white/60 uppercase truncate w-full text-center group-hover:text-glacier-bright">{stat.name}</span>
 <div className="flex items-center gap-1">
 <span className="text-sm font-quantico font-black text-glacier-bright">{nbDice}D{val}</span>
 {modifier !== 0 && (
 <span className={`text-xs font-black ${modifier > 0 ? 'text-glacier-bright' : 'text-red-500'}`}>
 {modifier > 0 ? `+${modifier}` : modifier}
 </span>
 )}
 </div>
 </button>
 );
 })}
 </div>
 </section>
 )}
 </div>

 {/* Conteneur de Droite : Historique (Annales) */}
 <section className="liquid-glass-panel flex flex-col min-h-0 overflow-hidden">
 <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
 <h3 className="text-xs font-quantico font-black text-silver-bright/60 tracking-widest uppercase">Annales du Destin</h3>
 <button 
 onClick={() => setDiceSharingEnabled(!diceSharingEnabled)}
 className={`p-1.5 rounded-full border transition-all ${diceSharingEnabled ? 'border-silver-DEFAULT/40 text-glacier-bright bg-glacier-DEFAULT/10' : 'border-white/10 text-white/60 hover:text-white/60'}`}
 title={diceSharingEnabled ? "Jet Public" : "Jet Secret"}
 >
 <Share2 size={12} />
 </button>
 </div>
 
 <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
 {logs.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full opacity-40 gap-2">
 <History size={32} />
 <span className="text-xs font-quantico uppercase tracking-[0.2em]">Les pages sont vierges...</span>
 </div>
 ) : (
 <AnimatePresence initial={false}>
 {logs.map((log) => (
 <motion.div 
 key={log.id}
 initial={{ opacity: 0, x: 20 }}
 animate={{ opacity: 1, x: 0 }}
 className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-1"
 >
 <div className="flex justify-between items-center">
 <span className="text-xs font-quantico text-silver-bright/60 uppercase">{characters.find(c => c.id === log.character_id)?.name || log.character_name}</span>
 <span className="text-xs font-mono text-white/60">{new Date(log.timestamp).toLocaleTimeString()}</span>
 </div>
 <div className="flex justify-between items-end">
 <div className="flex flex-col">
 <span className="text-xs font-quantico font-black text-white/90 uppercase tracking-wider">{log.action.split('(')[0]}</span>
 <span className="text-[11px] font-mono text-white/50 italic">{(log.details?.rolls || []).join(' + ')}</span>
 </div>
 <span className="text-2xl font-quantico font-black text-glacier-bright leading-none">{log.details?.total}</span>
 </div>
 </motion.div>
 ))}
 </AnimatePresence>
 )}
 </div>
 </section>
 </div>
 </div>
 );
}
