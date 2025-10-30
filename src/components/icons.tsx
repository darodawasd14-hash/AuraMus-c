import { cn } from "@/lib/utils";
import { Music, ListMusic, User, Volume2, Send, Users, Search, MessageSquare, X, Plus, Home, LogOut, ChevronDown, VolumeX, Maximize2, UserPlus, UserMinus, EyeOff, Loader2, MessageCircle, Smartphone, Edit, Check } from 'lucide-react';

export { Music, ListMusic, User, Volume2, Send, Users, Search, MessageSquare, X, Plus, Home, LogOut, ChevronDown, VolumeX, Maximize2, UserPlus, UserMinus, EyeOff, Loader2, MessageCircle, Smartphone, Edit, Check };

export function AuraLogo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-8 h-8", className)}
      {...props}
    >
      <defs>
          <linearGradient id="gradient-logo-app" x1="4" y1="12" x2="20" y2="12" gradientUnits="userSpaceOnUse">
              <stop stopColor="hsl(var(--primary))"/>
              <stop offset="1" stopColor="hsl(var(--accent))"/>
          </linearGradient>
      </defs>
      <path d="M4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12ZM12 6.5C14.7614 6.5 17 8.73858 17 11.5C17 14.2614 14.7614 16.5 12 16.5C9.23858 16.5 7 14.2614 7 11.5C7 8.73858 9.23858 6.5 12 6.5ZM12 9C13.6569 9 15 10.3431 15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9Z" fill="url(#gradient-logo-app)"/>
    </svg>
  );
}

export function PlayIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z"/></svg>
  );
}

export function PauseIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="currentColor" viewBox="0 0 20 20"><path d="M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5Zm7 0a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5Z"/></svg>
  );
}

export function SkipBack(props: React.SVGProps<SVGSVGElement>) {
  return (
     <svg {...props} fill="currentColor" viewBox="0 0 20 20"><path d="M4 5a.75.75 0 0 0-.75.75v8.5a.75.75 0 0 0 1.5 0V5.75A.75.75 0 0 0 4 5Zm3.24-1.214a.75.75 0 0 0-1.03-.064L2.257 6.168a.75.75 0 0 0 0 1.258l3.954 2.446a.75.75 0 0 0 1.03-.064V4.996c0-.49-.448-.86-.947-.71Z" clipRule="evenodd"/><path d="M16.3 2.841A1.5 1.5 0 0 0 14 4.11v11.78a1.5 1.5 0 0 0 2.3 1.269l-9.344-5.89a1.5 1.5 0 0 1 0-2.538l9.344-5.89Z"/></svg>
  );
}

export function SkipForward(props: React.SVGProps<SVGSVGElement>) {
  return (
     <svg {...props} fill="currentColor" viewBox="0 0 20 20"><path d="M16 5a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-1.5 0V5.75A.75.75 0 0 1 16 5Zm-3.24-1.214a.75.75 0 0 1 1.03-.064l3.952 2.436a.75.75 0 0 1 0 1.258l-3.953 2.446a.75.75 0 0 1-1.03-.064V4.996c0-.49.448-.86.947-.71Z" clipRule="evenodd"/><path d="M3.7 2.841A1.5 1.5 0 0 1 6 4.11v11.78a1.5 1.5 0 0 1-2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L3.7 2.84Z"/></svg>
  );
}

    