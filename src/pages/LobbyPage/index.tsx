import { useEffect, useRef, useState, useCallback } from 'react';
import { usePeer } from '../../hooks/usePeer';
import { SecurityLevel, useAuthStore } from '../../store/auth';
import { useSessionStore } from '../../store/session';
import { usePeersStore } from '../../store/peers';
import { useCharactersStore } from '../../store/characters';
import { useItemsStore } from '../../store/items';
import { useQuestsStore } from '../../store/quests';
import { useMapStore } from '../../store/map';
import { useDiceStore } from '../../store/dice';
import { peerService, PeerMessage } from '../../services/peer.service';
import {
 addSessionPlayer,
 clearSessionPlayers,
 getSessionPlayers,
 removeSessionPlayer,
} from '../../services/session.service';
import { useTranslation } from 'react-i18next';
import { Icons } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import logo from '../../assets/logo.svg';
import { SignetLogo } from '../../components/ui/SignetLogo';
import { SystemRouter } from '../../systems/core/SystemRouter';

import { mapSyncService } from '../../services/map-sync.service';
import { dbStorage } from '../../services/db.storage';
import { BrowserImageCompressor } from '../../services/browser-image-compressor';
import { activityLogService } from '../../services/activity-log.service';
import { useSession } from '../../hooks/useSession';

interface LobbyPageProps {
 sessionId: string;
 onLeave: () => void;
}

type ConnectionStatus = 'initializing' | 'connecting' | 'connected' | 'relay' | 'error' | 'disconnected';

export function LobbyPage({ sessionId, onLeave }: LobbyPageProps) {
 const { init, broadcast, onData, destroy, peerId } = usePeer();
 const [status, setStatus] = useState<ConnectionStatus>('initializing');
 const { t } = useTranslation();
 const [errorMessage, setErrorMessage] = useState<string | null>(null);
 const [players, setPlayers] = useState<{ peer_id: string; pseudo: string; role?: number }[]>([]);
 
 useEffect(() => {
 if (sessionId) {
 const channel = new BroadcastChannel(`signet_sync_${sessionId}`);
 channel.postMessage({ type: 'PLAYER_LIST', payload: players });
 channel.close();
 }
 }, [players, sessionId]);

 const [copied, setCopied] = useState(false);
 const [isGameStarted, setIsGameStarted] = useState(false);
 const [localMetadata, setLocalMetadata] = useState<{name?: string, id?: string, imageUrl?: string, system?: string, hostPeerId?: string, settings?: any} | null>(null);
 const [lobbyBg, setLobbyBg] = useState<string | null>(null);

 const currentUser = useAuthStore(state => state.user);
 const { sessions, addSession: persistSession } = useSession();
 
 const isPreparedRef = useRef(false);
 const sessionDataFromStore = sessions.find(s => s.id === sessionId || s.hostPeerId === sessionId);
 
 // Si c'est un code SIGNET-xxx, on est forcément joueur. 
 // Sinon on regarde en base : si isSummoned est vrai, on est forcément joueur.
 const isHost = !sessionId.startsWith('SIGNET-') && (!sessionDataFromStore || !sessionDataFromStore.isSummoned);
 const isMJ = !!currentUser && currentUser.role >= SecurityLevel.MJ;

 const sessionData = isHost ? sessionDataFromStore : (localMetadata || sessionDataFromStore);
 const sessionImage = sessionData?.imageUrl;

 // Sync refs pour les callbacks asynchrones
 const isMJRef = useRef(isMJ);
 const isHostRef = useRef(isHost);
 const sessionIdRef = useRef(sessionId);
 const broadcastRef = useRef(broadcast);
 const initRef = useRef(init);
 const statusRef = useRef(status);
 const onLeaveRef = useRef(onLeave);

 useEffect(() => { isMJRef.current = isMJ; }, [isMJ]);
 useEffect(() => { isHostRef.current = isHost; }, [isHost]);
 useEffect(() => { broadcastRef.current = broadcast; }, [broadcast]);
 useEffect(() => { initRef.current = init; }, [init]);
 useEffect(() => { statusRef.current = status; }, [status]);
 useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

 // Initialisation store persos
 useEffect(() => {
 if (sessionId) {
 localStorage.setItem('last_active_session', sessionId);
 useCharactersStore.getState().initialize(sessionId);
 useMapStore.getState().initialize(sessionId);
 useDiceStore.getState().initialize(sessionId);
 // Charge l'historique des Annales de la session
 activityLogService.initialize(sessionId);
 }
 }, [sessionId]);

 const refreshPlayers = useCallback(async () => {
 try {
 const list = await getSessionPlayers(sessionIdRef.current);
 setPlayers(list);
 if (isHostRef.current) {
 broadcastRef.current({ type: 'PLAYER_LIST', payload: list });
 }
 } catch (e) {
 console.error('Failed to refresh players:', e);
 }
 }, []);

 useEffect(() => {
 const handleMessage = async (data: PeerMessage, fromPeerId: string) => {
 console.log(`[LobbyPage] Message reçu: ${data.type} de ${fromPeerId}`);
 
 if (data.type === 'SESSION_START') {
 setIsGameStarted(true);
 } else if (data.type === 'SESSION_PAUSE') {
 setIsGameStarted(false);
 }
 else if (data.type === 'CONN_READY' && !isHostRef.current) {
 if (statusRef.current === 'connected') return;
 const myActualId = peerId || usePeersStore.getState().peerId;
 const currentUserState = useAuthStore.getState().user;
 
 const joinMsg = {
 type: 'PLAYER_JOIN',
 payload: {
 peer_id: myActualId,
 userId: currentUserState?.id,
 pseudo: currentUserState?.pseudo || t('lobby.defaultPlayer'),
 role: currentUserState?.role || 0
 }
 };
 broadcastRef.current(joinMsg);
 setStatus('connected');
 }
 else if (data.type === 'PLAYER_JOIN' && isHostRef.current) {
 const newPeerId = data.payload.peer_id || fromPeerId;
 const { pseudo, userId, role } = data.payload;
 
 if (userId) {
   usePeersStore.getState().setPeerUser(newPeerId, userId);
 }
 
 // Nettoyer d'abord
 await removeSessionPlayer(sessionIdRef.current, newPeerId);
 // Puis ajouter
 await addSessionPlayer(sessionIdRef.current, newPeerId, pseudo, role);
 
 const updatedList = await getSessionPlayers(sessionIdRef.current);
 setPlayers(updatedList);
 broadcastRef.current({ type: 'PLAYER_LIST', payload: updatedList });

 // Trigger map sync for the new player immediately
 const initialSceneId = `initial-scene-${sessionIdRef.current}`;
 const currentMapId = initialSceneId;
 if (sessionData?.id) {
 mapSyncService.syncCurrentMapToPeer(currentMapId, newPeerId);
 }

 let sessionMaps = [];
 if (window.electronAPI) sessionMaps = await window.electronAPI.getMaps(sessionIdRef.current);

 broadcastRef.current({
 type: 'SESSION_METADATA',
 payload: {
 id: sessionData?.id,
 name: sessionData?.name,
 system: sessionData?.system,
 imageUrl: sessionData?.imageUrl,
 hostPeerId: sessionData?.hostPeerId,
 settings: sessionData?.settings,
 maps: sessionMaps,
 activeMapId: currentMapId
 }
 });

 if (isGameStarted) broadcastRef.current({ type: 'SESSION_START', payload: {} });
 
 // Pousser l'état du combat au joueur qui vient de rejoindre
 const combatState = (await import('../../store/combat')).useCombatStore.getState();
 if (combatState.isActive) {
 broadcastRef.current({ type: 'COMBAT_STATE_UPDATE', payload: combatState });
 }
 }
 else if (data.type === 'PLAYER_LEAVE' && isHostRef.current) {
   const leavingPeerId = data.payload?.peerId || fromPeerId;
   usePeersStore.getState().removePeerUser(leavingPeerId);
 }
 else if (data.type === 'SESSION_METADATA' && !isHostRef.current) {
 console.log(`[LobbyPage] Métadonnées reçues:`, data.payload);
 setLocalMetadata(data.payload);
 const realId = data.payload.id;
 if (realId && realId !== sessionIdRef.current) {
 try {
 useCharactersStore.getState().initialize(realId);
 useItemsStore.getState().initialize(realId);
 useQuestsStore.getState().initialize(realId);
 useMapStore.getState().initialize(realId);
 useDiceStore.getState().initialize(realId);
 } catch (err) { console.error('Switch UUID fail', err); }
 }
 const updatedSession = { ...data.payload, lastPlayed: Date.now(), isSummoned: true };
 persistSession(updatedSession);
 }
 else if (data.type === 'PLAYER_LIST') {
 setPlayers(data.payload);
 if (statusRef.current !== 'connected') setStatus('connected');
 } 
 else if (data.type === 'SESSION_CLOSED') {
 onLeave();
 }
 else if (data.type === 'PLAYER_LEAVE') {
 if (isMJRef.current) {
 await removeSessionPlayer(sessionIdRef.current, data.payload.peerId);
 await refreshPlayers();
 } else {
 const sData = useSessionStore.getState().sessions.find(s => s.id === sessionIdRef.current);
 const hostId = sessionIdRef.current.startsWith('SIGNET-') ? sessionIdRef.current : sData?.hostPeerId;
 if (data.payload.peerId === hostId) onLeave();
 }
 }
 };

 const unsub = onData(handleMessage);
 return () => unsub();
 }, [onData, refreshPlayers, sessionData, isGameStarted, persistSession, onLeave, peerId]);

 useEffect(() => {
 let cancelled = false;
 let timer: any;

 const setupPeer = async () => {
 try {
 const sData = useSessionStore.getState().sessions.find(s => s.id === sessionIdRef.current);
 const hostPeerId = isHostRef.current 
 ? sData?.hostPeerId 
 : (sessionIdRef.current.startsWith('SIGNET-') ? sessionIdRef.current : sData?.hostPeerId);

 if (!hostPeerId) throw new Error("ID de session manquant");

 if (isHostRef.current) {
 if (!cancelled) setStatus('initializing');
 const myId = await initRef.current(true, hostPeerId);
 if (cancelled) return;
 await clearSessionPlayers(sessionIdRef.current);
 await addSessionPlayer(sessionIdRef.current, myId, currentUser?.pseudo || 'MJ', currentUser?.role);
 await refreshPlayers();
 if (!cancelled) setStatus('connected');
 } else {
 if (!cancelled) setStatus('initializing');
 await initRef.current(false, hostPeerId);
 }
 } catch (e: any) {
 if (!cancelled) { setStatus('error'); setErrorMessage(e.message); }
 }
 };

 timer = setTimeout(() => {
 if (!cancelled) setupPeer();
 }, 50);

 return () => { 
 cancelled = true; 
 clearTimeout(timer);
 };
 }, [sessionId, currentUser, refreshPlayers]);

 useEffect(() => {
 const bc = broadcastRef.current;
 const host = isHostRef.current;
 return () => { 
 const currentPeerId = usePeersStore.getState().peerId;
 if (currentPeerId) {
 if (host) bc({ type: 'SESSION_CLOSED', payload: {} });
 else bc({ type: 'PLAYER_LEAVE', payload: { peerId: currentPeerId } });
 }
 destroy(); 
 };
 }, [destroy]);

 // Pre-loading des maps dans le Hub
 const bgSetRef = useRef(false);
 useEffect(() => {
 if (status !== 'connected' || !sessionId) return;

 const unsubManifest = mapSyncService.onManifestReceived(async (mapId, manifest, missingChunks, hostPeerId) => {
 console.log(`[Lobby] Manifest reçu pour ${mapId}, ${missingChunks.length} chunks manquants.`);
 
 if (missingChunks.length > 0) {
 const chunkIds = missingChunks.map(c => c.id);
 mapSyncService.requestChunks(mapId, chunkIds, hostPeerId);
 } else {
 const firstChunk = await dbStorage.getChunk(manifest.chunks[0].id);
 if (firstChunk?.data && !bgSetRef.current) {
 bgSetRef.current = true;
 const blob = new Blob([firstChunk.data], { type: 'image/webp' });
 setLobbyBg(URL.createObjectURL(blob));
 }
 }
 });

 const unsubChunk = mapSyncService.onChunkReady((mapId, chunk, data) => {
 if (!bgSetRef.current && chunk.x === 0 && chunk.y === 0) {
 console.log(`[Lobby] Premier chunk reçu (${chunk.id}), mise à jour du fond.`);
 bgSetRef.current = true;
 const blob = new Blob([data], { type: 'image/webp' });
 setLobbyBg(URL.createObjectURL(blob));
 }
 });

 // MJ : Le broadcast est maintenant géré réactivement par BoardCanvas.tsx 
 // qui est monté en arrière-plan dès l'entrée dans le lobby.

 return () => {
 unsubManifest();
 unsubChunk();
 };
 }, [status, sessionId, isHost, sessionData?.imageUrl]);

 const handleLaunchSession = () => {
 setIsGameStarted(true);
 broadcast({ type: 'SESSION_START', payload: {} });
 if (isHost) {
 broadcast({ type: 'CHARACTER_LIST', payload: useCharactersStore.getState().characters });
 }
 };

 const copyId = () => {
 const idToCopy = isHost ? peerId : sessionData?.hostPeerId;
 if (idToCopy) {
 navigator.clipboard.writeText(idToCopy);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 }
 };

 const getRoleLabelLocal = (role?: number) => {
 const level = role ?? 0;
 if (level === SecurityLevel.ADMIN) return t('lobby.roleAdmin');
 if (level === SecurityLevel.MJ) return t('lobby.roleMJ');
 return t('lobby.rolePlayer');
 };

 return (
 <div className="flex flex-col h-screen bg-[#0D0D0F] text-white overflow-hidden relative">
 {(sessionData || isHost) && (
 <div className={`absolute inset-0 transition-all duration-1000 ${isGameStarted ? 'z-50 opacity-100' : 'z-0 opacity-30'}`}>
 <SystemRouter 
 system={sessionData?.system || 'Seal'} 
 isMJ={isMJ} 
 isHost={isHost}
 onPause={() => {
 setIsGameStarted(false);
 broadcast({ type: 'SESSION_PAUSE', payload: {} });
 }}
 onLeave={onLeave}
 sessionId={sessionData?.id || sessionId}
 imageUrl={sessionImage}
 players={players}
 lobbyMode={!isGameStarted}
 />
 </div>
 )}

 {!isGameStarted && (
 <div className="absolute inset-0 z-[1] pointer-events-none">
 <div className="absolute inset-0 bg-vignette pointer-events-none" />
 </div>
 )}

 {!isGameStarted && (
 <>
 <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-silver-DEFAULT/20 bg-[#0D0D0F]/60 backdrop-blur-md shrink-0">
 <div className="flex items-center gap-4">
 <SignetLogo mode="hover" imgClassName="w-8 h-8" />
 <div>
 <h1 className="text-lg font-black text-glacier-bright tracking-widest uppercase">{sessionData?.name || 'Lobby'}</h1>
 <div className="flex items-center gap-2 text-[8px] font-quantico">
 <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
 <span className="text-glacier-muted uppercase tracking-widest">{status}</span>
 </div>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {isHost && (
 <Button
 variant="secondary"
 size="sm"
 leftIcon={copied ? <Icons.Check className="w-3 h-3" /> : <Icons.Share2 className="w-3 h-3" />}
 onClick={copyId}
 >
 {copied ? t('lobby.copied') : t('lobby.share')}
 </Button>
 )}
 <Button
 variant="danger"
 size="sm"
 onClick={onLeave}
 >
 {t('lobby.leave')}
 </Button>
 </div>
 </header>

 <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-12">
 {status === 'error' ? (
 <div className="text-center space-y-4">
 <Icons.WifiOff size={48} className="mx-auto text-red-500 opacity-50" />
 <h2 className="text-xl font-bold">{t('lobby.linkBroken')}</h2>
 <p className="text-sm text-white/60 italic">{errorMessage}</p>
 <Button variant="tertiary" size="sm" onClick={() => window.location.reload()}>
 {t('lobby.retryButton')}
 </Button>
 </div>
 ) : (status !== 'connected' && status !== 'relay') ? (
 <div className="text-center space-y-4 animate-pulse">
 <Icons.Loader2 size={48} className="mx-auto text-silver-bright animate-spin" />
 <h2 className="text-sm font-quantico tracking-[0.3em] text-silver-bright uppercase">{t('lobby.connecting')}</h2>
 </div>
 ) : (
 <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
 <div className="space-y-6">
 <div className="space-y-2">
 <span className="text-[10px] font-black text-glacier-muted tracking-[0.3em] uppercase">{t('lobby.waitingChronicles')}</span>
 <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none">{sessionData?.name}</h2>
 <p className="text-glacier-muted italic font-inter">{t('lobby.systemStory', { system: sessionData?.system })}</p>
 </div>
 {isHost && (
 <Button
 variant="primary"
 size="lg"
 fullWidth
 hasSheen
 leftIcon={<Icons.Play size={20} fill="currentColor" />}
 onClick={handleLaunchSession}
 >
 {t('lobby.launchSession')}
 </Button>
 )}
 </div>
 <div className="bg-black/40 border border-silver-DEFAULT/20 rounded-[2.5rem] p-8 backdrop-blur-xl relative overflow-hidden">
 <div className="absolute inset-0 bg-grimoire-texture opacity-[0.03] pointer-events-none" />
 <h3 className="text-[10px] font-black text-glacier-muted uppercase tracking-[0.3em] mb-6 flex items-center gap-2 relative z-10"><Icons.Users size={14}/> {t('lobby.playerCircle')}</h3>
 <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar relative z-10 pr-2">
 {players.map(p => (
 <div key={p.peer_id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 group hover:border-silver-DEFAULT/30 transition-all">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-full bg-glacier-DEFAULT/10 border border-silver-DEFAULT/20 flex items-center justify-center text-xs font-black text-glacier-bright font-quantico shadow-inner">{p.pseudo.charAt(0)}</div>
 <div className="flex flex-col">
 <span className="text-sm font-bold text-white/90 tracking-wide">{p.pseudo}</span>
 <span className="text-[8px] text-glacier-muted/60 uppercase font-black tracking-widest">{getRoleLabelLocal(p.role)}</span>
 </div>
 </div>
 {p.pseudo === 'MJ' && <Icons.Zap size={12} className="text-glacier-bright animate-pulse" />}
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </main>
 </>
 )}
 </div>
 );
}
