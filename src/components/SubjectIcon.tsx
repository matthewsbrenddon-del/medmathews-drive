import {
  AlertTriangle,
  Activity,
  Baby,
  Bone,
  Bug,
  Dna,
  FlaskConical,
  Heart,
  HeartPulse,
  Microscope,
  Pill,
  Scissors,
  Shapes,
  ShieldCheck,
  Stethoscope,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  AlertTriangle,
  Activity,
  Baby,
  Bone,
  Bug,
  Dna,
  FlaskConical,
  Heart,
  HeartPulse,
  Microscope,
  Pill,
  Scissors,
  Shapes,
  ShieldCheck,
  Stethoscope,
  BookOpen,
};

export function SubjectIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? BookOpen;
  return <Icon size={size} className={className} />;
}
