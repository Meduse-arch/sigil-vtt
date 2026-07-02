export interface ItemModifier {
  target: 'stat' | 'bar';
  targetId: string;
  targetProperty?: 'value' | 'max'; // Pour les jauges (bar)
  mode: 'flat' | 'percent' | 'dice';
  value: number; // Valeur fixe ou pourcentage
  formula?: string; // Formule de dés (ex: '1d6+2')
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url?: string;
  modifiers: ItemModifier[];
  effects: any[];
  tags?: string[];
  skills?: any[];
}

export const itemsService = {
  getItems: async (sessionId: string): Promise<Item[]> => {
    if (!window.electronAPI) return [];
    return window.electronAPI.getItems(sessionId);
  },

  addItem: async (sessionId: string, item: Item): Promise<boolean> => {
    if (!window.electronAPI) return false;
    return window.electronAPI.addItem(sessionId, item);
  },

  removeItem: async (sessionId: string, id: string): Promise<boolean> => {
    if (!window.electronAPI) return false;
    return window.electronAPI.removeItem(sessionId, id);
  }
};
