import { create } from 'zustand';

interface PeersState {
  peerId: string | null;
  isHost: boolean;
  connections: string[]; // BUG 4 FIX : désormais synchronisé via peerService.onConnectionChange()
  peerUserMap: Record<string, string>; // mapping peerId → userId
  setPeerId: (id: string | null) => void;
  setIsHost: (host: boolean) => void;
  setConnections: (conns: string[]) => void;
  setPeerUser: (peerId: string, userId: string) => void;
  removePeerUser: (peerId: string) => void;
}

export const usePeersStore = create<PeersState>((set) => ({
  peerId: null,
  isHost: false,
  connections: [],
  peerUserMap: {},
  setPeerId: (id) => set({ peerId: id }),
  setIsHost: (host) => set({ isHost: host }),
  setConnections: (conns) => set({ connections: conns }),
  setPeerUser: (peerId, userId) => set((state) => ({
    peerUserMap: { ...state.peerUserMap, [peerId]: userId }
  })),
  removePeerUser: (peerId) => set((state) => {
    const next = { ...state.peerUserMap };
    delete next[peerId];
    return { peerUserMap: next };
  }),
}));