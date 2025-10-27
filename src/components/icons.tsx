import { cn } from "@/lib/utils";

export function AuraLogo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
      {...props}
    >
      <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
      <path d="M12 18c-3.314 0-6-2.686-6-6s2.686-6 6-6" opacity="0.5" />
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );
}
