import {
  BookOpenIcon,
  CompassIcon,
  DatabaseIcon,
  ScanSearchIcon,
  Settings2Icon,
} from "lucide-react";

export const appNavigation = [
  {
    href: "/",
    label: "Explore",
    description: "Navigate the authorization model in your application's language.",
    icon: CompassIcon,
  },
  {
    href: "/analysis",
    label: "Analysis",
    description: "Explain access using domain intent and implementation evidence.",
    icon: ScanSearchIcon,
  },
  {
    href: "/schema",
    label: "Evidence",
    description: "Inspect tables, relationships, policies, and helper functions.",
    icon: DatabaseIcon,
  },
  {
    href: "/context",
    label: "Context",
    description: "Describe what your application means and how access should work.",
    icon: BookOpenIcon,
  },
  {
    href: "/connections",
    label: "Connections",
    description: "Configure the database and AI provider used for analysis.",
    icon: Settings2Icon,
  },
] as const;
