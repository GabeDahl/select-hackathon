import {
  CompassIcon,
  DatabaseIcon,
  ScanSearchIcon,
} from "lucide-react";

export const appNavigation = [
  {
    href: "/",
    label: "Explore",
    icon: CompassIcon,
  },
  {
    href: "/analysis",
    label: "Analysis",
    icon: ScanSearchIcon,
  },
  {
    href: "/schema",
    label: "Evidence",
    icon: DatabaseIcon,
  },
] as const;
