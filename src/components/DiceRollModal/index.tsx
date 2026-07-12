import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

import { Icons } from '../ui/Icons';
import { createPortal } from 'react-dom';
import { useDiceStore } from '../../store/dice';
import { usePeer } from '../../hooks/usePeer';
import { RunicDecoder } from '../RunicDecoder';
import { ModalContainer } from '../ModalContainer';
import { AnimatePresence } from 'framer-motion';

const RUNES = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚻ", "ᚼ", "ᛁ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛊ", "ᛏ", "ᛒ", "ᛖ", "ᛗ", "ᛚ", "ᛜ", "ᛞ", "ᛟ"];

const getDestiny = (roll: number, faces: number, isTotal: boolean = false, nb: number = 1) => {
 if (!isTotal || nb === 1) {
 if (roll === 1) return { char: 'ᛃ', label: 'Ruine Absolue' };
 if (roll >= faces) return { char: 'ᛜ', label: 'Réussite Légendaire' };
 }
 
 const maxPossible = faces * nb;
 const pct = maxPossible > 0 ? Math.round((roll / maxPossible) * 100) : 50;
 
 if (pct > 80) return { char: 'ᛟ', label: 'Triomphe' };
 if (pct > 60) return { char: 'ᚨ', label: 'Faveur' };
 if (pct > 40) return { char: 'ᛁ', label: 'Équilibre' };
 if (pct > 20) return { char: 'ᚱ', label: 'Résistance' };
 return { char: 'ᚦ', label: 'Adversité' };
};

const DiceShape = ({ faces, className }: { faces: number, className?: string }) => {
 const stroke = "#d4af37";
 const props = { fill: "none", stroke, strokeWidth: "1.2", className };
 switch (faces) {
 case 4: return <svg viewBox="0 0 100 100" {...props}><path d="M50 15 L85 80 L15 80 Z" /></svg>;
 case 6: return <svg viewBox="0 0 100 100" {...props}><rect x="20" y="20" width="60" height="60" /></svg>;
 case 8: return <svg viewBox="0 0 100 100" {...props}><path d="M50 10 L85 50 L50 90 L15 50 Z" /></svg>;
 case 10: return <svg viewBox="0 0 100 100" {...props}><path d="M50 10 L85 40 L72 85 L28 85 L15 40 Z" /></svg>;
 case 12: return <svg viewBox="0 0 100 100" {...props}><path d="M50 10 L80 25 L90 55 L70 85 L30 85 L10 55 L20 25 Z" /></svg>;
 case 20: return <svg viewBox="0 0 100 100" {...props}><path d="M50 10 L85 28 L85 72 L50 90 L15 72 L15 28 Z" /></svg>;
 default: return <svg viewBox="0 0 100 100" {...props}><circle cx="50" cy="50" r="40" /></svg>;
 }
};

const STAT_ABBR: Record<string, string> = { 'Force': 'FOR', 'Agilité': 'AGI', 'Constitution': 'CON', 'Intelligence': 'INT', 'Sagesse': 'SAG', 'Perception': 'PER', 'Charisme': 'CHA' };
const getAbbreviatedLabel = (label: string) => STAT_ABBR[label] ?? label.substring(0, 3).toUpperCase();

export const DiceRollModal: React.FC = () => {
 const { diceResult, setDiceResult } = useDiceStore();
 const [phase, setPhase] = useState<'rolling' | 'rune' | 'reveal'>('rolling');
 const [displayRune, setDisplayRune] = useState('');
 const { onData } = usePeer();

 // Écouter les jets des autres joueurs
 useEffect(() => {
 const unsub = onData((data) => {
 if (data.type === 'DICE_ROLL') {
 setDiceResult([data.payload]);
 }
 });
 return () => unsub();
 }, [onData, setDiceResult]);

 const rollInfo = useMemo(() => {
 if (!diceResult || diceResult.length === 0) return null;
 
 let totalRoll = 0;
 let totalMaxPossible = 0;
 let totalNb = 0;

 diceResult.forEach((res) => {
 if (res.groups && res.groups.length > 0) {
 res.groups.forEach(group => {
 totalRoll += group.rolls.reduce((a, b) => a + b, 0);
 totalMaxPossible += group.nb * group.faces;
 totalNb += group.nb;
 });
 } else {
 // Fallback pour les anciens jets ou jets simples
 const match = res.diceString.match(/(\d+)d\(?([^=)]+)=?(\d+)?\)?/);
 const nb = match ? parseInt(match[1]) : 1;
 let faces = 20;
 if (match) {
 const val = match[3] || match[2];
 faces = parseInt(val) || 20;
 }
 totalRoll += res.rolls.reduce((a: number, b: number) => a + b, 0);
 totalMaxPossible += nb * faces;
 totalNb += res.rolls.length;
 }
 });

 return getDestiny(totalRoll, totalMaxPossible, true, totalNb);
 }, [diceResult]);

 useEffect(() => {
 if (!diceResult) { 
 setPhase('rolling'); 
 return; 
 }
 
 setPhase('rolling');
 
 const interval = setInterval(() => { setDisplayRune(RUNES[Math.floor(Math.random() * RUNES.length)]); }, 40);
 const runeTimeout = setTimeout(() => {
 clearInterval(interval);
 if (rollInfo) setDisplayRune(rollInfo.char);
 setPhase('rune');
 }, 500);
 const revealTimeout = setTimeout(() => { setPhase('reveal'); }, 800);
 return () => { clearInterval(interval); clearTimeout(runeTimeout); clearTimeout(revealTimeout); };
 }, [diceResult, rollInfo]);

 const totalGlobal = diceResult ? Math.round(diceResult.reduce((sum: number, r) => sum + r.total, 0)) : 0;

 return createPortal(
 <div className={`fixed inset-0 z-[10000] ${!diceResult ? 'pointer-events-none' : ''}`}>
 <AnimatePresence>
 {diceResult && rollInfo && (
 <ModalContainer onClose={() => setDiceResult(null)} title="Appel du Destin">
 <div className="flex flex-col items-center gap-3 py-4">
 {phase !== 'reveal' ? (
 <span className={`font-quantico leading-none transition-all duration-300 ${
 phase === 'rune' 
 ? 'text-6xl text-glacier-bright ' 
 : 'text-5xl text-silver-bright opacity-40'
 }`}>{displayRune}</span>
 ) : (
 <div className="flex flex-col items-center gap-1 animate-in fade-in duration-300">
 <span className="text-2xl font-quantico text-glacier-bright opacity-70 animate-pulse drop-shadow-[0_0_10px_rgba(79,164,184,0.6)]">{rollInfo.char}</span>
 <div className="relative flex items-center justify-center">
 {diceResult.length === 1 && (() => {
 const match = diceResult[0].diceString.match(/(\d+)d\(?([^=)]+)=?(\d+)?\)?/)
 const val = match ? (match[3] || match[2]) : '20'
 return <DiceShape faces={parseInt(val) || 20} className="absolute w-24 h-24 opacity-[0.06]" />
 })()}
 <span className="relative text-7xl font-quantico font-black text-glacier-bright leading-none z-10">{totalGlobal}</span>
 </div>
 {diceResult.length === 1 && (
 <div className="mt-2">
 <RunicDecoder text={diceResult[0].label} />
 </div>
 )}
 </div>
 )}
 </div>

 {phase === 'reveal' && (
 <div className="animate-in fade-in duration-500 w-full flex flex-col gap-6 mt-4">
 <div className="flex flex-row flex-wrap justify-center gap-4 w-full px-4">
 {diceResult.map((res, i: number) => {
 if (res.groups && res.groups.length > 0) {
 return res.groups.map((group, groupIdx) => 
 group.rolls.map((val, rollIdx) => {
 const label = group.label ? getAbbreviatedLabel(group.label) : `D${group.faces}`;
 return (
 <div key={`${i}-${groupIdx}-${rollIdx}`} className="flex flex-col items-center gap-1 min-w-[30px]">
 <DiceShape faces={group.faces} className="w-5 h-5 opacity-40" />
 <span className="font-quantico text-xs text-silver-bright opacity-40 uppercase text-center">{label}</span>
 <span className="font-quantico font-black text-sm text-glacier-bright">{Math.round(val)}</span>
 </div>
 );
 })
 );
 }
 
 // Fallback pour compatibilité
 const match = res.diceString.match(/(\d+)d\(?([^=)]+)=?(\d+)?\)?/);
 const rawLabel = match && match[2] && isNaN(parseInt(match[2])) ? match[2] : null;
 const label = rawLabel ? getAbbreviatedLabel(rawLabel) : `D${match ? (match[3] || match[2]) : 20}`;
 const faces = match ? (parseInt(match[3] || match[2]) || 20) : 20;
 return res.rolls.map((val: number, j: number) => (
 <div key={`${i}-${j}`} className="flex flex-col items-center gap-1 min-w-[30px]">
 <DiceShape faces={faces} className="w-5 h-5 opacity-40" />
 <span className="font-quantico text-xs text-silver-bright opacity-40 uppercase text-center">{label}</span>
 <span className="font-quantico font-black text-sm text-glacier-bright">{Math.round(val)}</span>
 </div>
 ));
 })}
 </div>
 <div className="flex flex-wrap justify-center gap-2 opacity-60 w-full pt-4 border-t border-silver-DEFAULT/10">
 {diceResult.map((res, i: number) => (
 <div key={i} className="text-[11px] font-mono border border-silver-DEFAULT/20 px-2 py-0.5 text-glacier-bright bg-glacier-DEFAULT/5 text-center uppercase">
 {res.diceString} = {Math.round(res.total)}
 </div>
 ))}
 </div>
 </div>
 )}
 </ModalContainer>
 )}
 </AnimatePresence>
 </div>,
 document.body
 );
};

export default DiceRollModal;
