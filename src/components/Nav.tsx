import { Briefcase, MessageCircle, Upload, User } from "lucide-react";

type NavTarget = {
  label: string;
  href: string;
  // External hash links (same-page scroll) use href + onClick to scroll smoothly.
  scrollTo?: string;
  Icon: typeof Briefcase;
};

const TARGETS: NavTarget[] = [
  { label: "Overview", href: "/", Icon: Briefcase },
  { label: "Profile", href: "/#profile", scrollTo: "profile", Icon: User },
  { label: "CV", href: "/#cv-upload", scrollTo: "cv-upload", Icon: Upload },
  { label: "Chat", href: "/chat", Icon: MessageCircle },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        <a href="/" className="font-semibold text-lg text-purple-600 no-underline">Career-Buddy</a>
        <div className="flex items-center gap-1 md:gap-2">
          {TARGETS.map((t) => (
            <NavLink key={t.label} target={t} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavLink({ target }: { target: NavTarget }) {
  const isHash = target.href.includes("#");
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isHash || typeof window === "undefined") return;
    if (window.location.pathname !== "/") return; // let the navigation happen
    const id = target.scrollTo;
    if (!id) return;
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `/#${id}`);
    }
  };
  return (
    <a
      href={target.href}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:text-purple-700 hover:bg-purple-50 no-underline"
    >
      <target.Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{target.label}</span>
    </a>
  );
}
