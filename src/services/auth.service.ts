import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function loginUser(pseudo: string, mot_de_passe: string) {
  // Recherche l'utilisateur par pseudo
  const { data, error } = await supabase
    .from('comptes')
    .select('*')
    .eq('pseudo', pseudo)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error("Cet utilisateur n'existe pas.");
    }
    throw new Error(error.message);
  }

  // Vérification du mot de passe haché
  const isValid = await bcrypt.compare(mot_de_passe, data.mot_de_passe);
  if (!isValid) {
    throw new Error("Mot de passe incorrect.");
  }

  return { id: data.id, pseudo: data.pseudo, role: data.role };
}

export async function signupUser(pseudo: string, mot_de_passe: string, email?: string) {
  // Vérifie si le pseudo existe déjà
  const { data: existingUser } = await supabase
    .from('comptes')
    .select('id')
    .eq('pseudo', pseudo)
    .single();

  if (existingUser) {
    throw new Error("Ce pseudo est déjà utilisé.");
  }

  // Hachage du mot de passe
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(mot_de_passe, salt);

  const newAccount: any = { pseudo, mot_de_passe: hashedPassword, role: 'joueur' };
  if (email) newAccount.email = email;

  // Crée le nouvel utilisateur
  const { data, error } = await supabase
    .from('comptes')
    .insert([newAccount])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { id: data.id, pseudo: data.pseudo, role: data.role };
}