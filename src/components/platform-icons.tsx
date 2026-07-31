import type { ReactNode, SVGProps } from "react";

export type PlatformIconName =
  | "home"
  | "surveys"
  | "dashboard"
  | "team"
  | "results"
  | "admin"
  | "edit"
  | "users"
  | "hierarchy"
  | "settings"
  | "import"
  | "menu"
  | "chevron-left"
  | "chevron-right"
  | "logout"
  | "profile"
  | "check"
  | "clock"
  | "lock"
  | "search";

type IconProps = SVGProps<SVGSVGElement> & { name: PlatformIconName };

export function PlatformIcon({ name, className = "h-5 w-5", ...props }: IconProps) {
  const paths: Record<PlatformIconName, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-7h5v7" /></>,
    surveys: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /><path d="m15.5 16.5 1.5 1.5 3-3" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="4" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20c.4-4 2.3-6 5.5-6s5.1 2 5.5 6" /><path d="M14 15c3.5-.7 6 .9 6.5 4.5" /></>,
    results: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    admin: <><path d="M12 3 4 7v5c0 5 3.4 8.2 8 9 4.6-.8 8-4 8-9V7l-8-4Z" /><path d="m9 12 2 2 4-4" /></>,
    edit: <><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
    users: <><circle cx="8" cy="8" r="3" /><path d="M2.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M14.5 15.5c3.2-.8 6.3.8 7 4" /></>,
    hierarchy: <><rect x="9" y="3" width="6" height="4" rx="1" /><rect x="3" y="17" width="6" height="4" rx="1" /><rect x="15" y="17" width="6" height="4" rx="1" /><path d="M12 7v5M6 17v-3h12v3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    import: <><path d="M12 3v12" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 15v5h16v-5" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    logout: <><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.5-5 3-7.5 7.5-7.5S19 16 19.5 21" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name]}
    </svg>
  );
}
