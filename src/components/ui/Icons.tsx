/**
 * Bibliothèque d'icônes centralisée
 * 
 * Toutes les icônes de l'application sont exportées depuis ce fichier unique.
 * Pour changer de bibliothèque d'icônes, il suffit de modifier les imports ici.
 * Les composants importent depuis : `import { Icons } from '@/components/ui/Icons'`
 */
import {
 AlertTriangle,
 Activity,
 ArrowDownToLine,
 ArrowLeft,
 Backpack,
 BarChart2,
 BookOpen,
 Check,
 ChevronDown,
  ChevronUp,
 ChevronLeft,
 ChevronRight,
 Database,
 Dices,
 ExternalLink,
 Eye,
 EyeOff,
 FlaskConical,
 Gem,
 Ghost,
 Gift,
 Globe,
 Grid,
 Hammer,
 Heart,
 History,
 Image as ImageIcon,
 ImageOff,
 Info,
 Key,
 Layers,
 Layout,
 Library,
 Link,
 Loader2,
 Lock,
 LogIn,
 LogOut,
 Map as MapIcon,
 MapPin,
 Minus,
 MonitorPlay,
 MousePointer2,
 Music,
 Network,
 Mail,
 Package,
 Palette,
 Pause,
 Pencil,
 PenTool,
 Play,
 Plus,
 Power,
 RadioReceiver,
 RefreshCcw,
 Repeat,
 Ruler,
 Save,
 Scroll,
 Search,
 Settings,
 Settings2,
 Share2,
 Shield,
 ShieldAlert,
 Shuffle,
 Skull,
 Sliders,
 Sparkles,
 Square,
 Star,
 Sword,
 Swords,
 Tag as TagIcon,
 Target,
 Trash2,
 Trophy,
 Unlink,
 Upload,
 User,
 UserCog,
 Users,
 Volume2,
 VolumeX,
 WifiOff,
 X,
 Zap,
 ZapOff,
 ScrollText,
} from 'lucide-react';

/**
 * Objet centralisé contenant toutes les icônes de l'application.
 * 
 * Usage dans les composants :
 * ```tsx
 * import { Icons } from '../../components/ui/Icons';
 * 
 * <Icons.Search className="w-5 h-5" />
 * <Icons.Plus className="w-4 h-4 text-glacier-bright" />
 * ```
 */
export const Icons = {
  AlertTriangle,
  Database,
  Network,
  ShieldAlert,
 // --- Navigation & Actions générales ---
 Search,
 Plus,
 Minus,
 X,
 Check,
 ChevronDown,
  ChevronUp,
 ChevronLeft,
 ChevronRight,
 ExternalLink,
 ArrowDownToLine,
 ArrowLeft,
 RefreshCcw,

  Mail,
 // --- Authentification & Utilisateurs ---
 User,
 Users,
 UserCog,
 Lock,
 LogIn,
 LogOut,
 Key,

 // --- Chargement & États ---
 Loader2,
 WifiOff,
 Eye,
 EyeOff,

 // --- Session & Jeu ---
 Play,
 Pause,
 Square,
 Dices,
 Swords,
 Sword,
 Shield,
 Heart,
 Zap,
 ZapOff,
 Activity,
 Ghost,
 Skull,
 Target,
 MapPin,
 Power,

 // --- Inventaire & Objets ---
 Package,
 Hammer,
 Gem,
 FlaskConical,
 Sparkles,
 Star,
 PenTool,
 Backpack,

 // --- Interface & Layout ---
 Library,
 Layers,
 Layout,
 Grid,
 Settings,
 Settings2,
 Sliders,
 Info,
 Pencil,

 // --- Fichiers & Médias ---
 Upload,
 Save,
 Trash2,
 ImageIcon,
 ImageOff,
 MapIcon,
 Music,
 Volume2,
 VolumeX,

 // --- Quêtes & Histoire ---
 Scroll,
 ScrollText,
 BookOpen,
 Trophy,
 Gift,
 History,

 // --- Réseau & Connexions ---
 Link,
 Unlink,
 Share2,
 RadioReceiver,
 MonitorPlay,

 // --- Outils spécifiques ---
 MousePointer2,
 Ruler,
 Repeat,
 Shuffle,
 BarChart2,
 Palette,
 TagIcon,
 Globe,
} as const;

// Export du type pour le typage fort
export type IconName = keyof typeof Icons;
