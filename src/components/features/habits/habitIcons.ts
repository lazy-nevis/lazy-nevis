import {
  Apple,
  Bed,
  Bike,
  Book,
  Brain,
  Coffee,
  Droplet,
  Dumbbell,
  Footprints,
  Heart,
  Leaf,
  Music,
  Pencil,
  Pill,
  Smile,
  Sun,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";

/** Habit icon ids stored in the DB, mapped to their lucide glyphs. */
export const HABIT_ICONS: Record<string, LucideIcon> = {
  droplet: Droplet,
  dumbbell: Dumbbell,
  book: Book,
  footprints: Footprints,
  bed: Bed,
  apple: Apple,
  brain: Brain,
  pill: Pill,
  heart: Heart,
  timer: Timer,
  pencil: Pencil,
  music: Music,
  sun: Sun,
  leaf: Leaf,
  bike: Bike,
  target: Target,
  coffee: Coffee,
  smile: Smile,
};

export const HABIT_ICON_IDS = Object.keys(HABIT_ICONS);

export function habitIcon(id: string | null | undefined): LucideIcon {
  return (id && HABIT_ICONS[id]) || Target;
}
