type IconProps = {
  className?: string;
};

export const HeartOutlineIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="M12.62 20.25a1 1 0 0 1-1.24 0C6.82 16.79 4 14.26 4 10.94 4 8.53 5.9 7 8.06 7c1.45 0 2.76.69 3.54 1.87C12.39 7.69 13.7 7 15.15 7 17.31 7 19.2 8.53 19.2 10.94c0 3.32-2.81 5.85-7.38 9.31Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

export const HeartSolidIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12.5 20.2a1 1 0 0 1-1 0C7.03 17.47 4 14.87 4 10.96 4 8.56 5.93 7 8.13 7c1.51 0 2.86.73 3.67 1.96C12.61 7.73 13.96 7 15.47 7 17.67 7 19.6 8.56 19.6 10.96c0 3.91-3.03 6.51-7.1 9.24Z" />
  </svg>
);

export const FollowPlusIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="M9.5 12.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M3.75 18.5c.85-2.69 3.03-4.25 5.75-4.25s4.9 1.56 5.75 4.25"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
    <path d="M17.25 8.25h4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M19.5 6v4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

export const FollowCheckIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="M9.5 12.25a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M3.75 18.5c.85-2.69 3.03-4.25 5.75-4.25s4.9 1.56 5.75 4.25"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
    <path d="m16.8 10.95 1.65 1.7 3.3-3.65" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const SendRoundedIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="M20.25 4.5 11 13.7"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
    <path
      d="m20.25 4.5-5.52 15.03a.55.55 0 0 1-1.01.05l-2.6-5.1-5.1-2.6a.55.55 0 0 1 .05-1.01L20.25 4.5Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

export const CommentBubbleIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path
      d="M6.75 17.75 4.5 20v-4.1A6.75 6.75 0 0 1 11.25 9h4.5a4.75 4.75 0 1 1 0 9.5h-9Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

export const ArrowUpIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M12 18V6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="m7.5 10.5 4.5-4.5 4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const ArrowDownIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M12 6v12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="m16.5 13.5-4.5 4.5-4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const ArrowLeftIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M18 12H6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="m10.5 7.5-4.5 4.5 4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const CloseIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="m7 7 10 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="m17 7-10 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

export const ChevronLeftIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="m14.5 6.5-5 5.5 5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const ChevronRightIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="m9.5 6.5 5 5.5-5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const MailIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <rect height="13" rx="3" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5.5" />
    <path d="m5.5 8.5 6.5 5 6.5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const WalletIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-9A2.5 2.5 0 0 1 5 16.5v-9Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M15.5 12h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <circle cx="15.25" cy="12" fill="currentColor" r="1.1" />
  </svg>
);

export const AppleIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M15.9 12.37c.02 2.27 1.99 3.02 2.01 3.03-.02.05-.31 1.08-1.03 2.13-.62.91-1.27 1.81-2.29 1.83-1 .02-1.32-.59-2.47-.59-1.16 0-1.51.57-2.46.61-1 .04-1.77-.98-2.4-1.88-1.3-1.87-2.3-5.28-.96-7.61.67-1.16 1.87-1.9 3.18-1.92.99-.02 1.92.66 2.47.66.54 0 1.67-.82 2.82-.7.48.02 1.83.19 2.69 1.45-.07.04-1.6.94-1.58 3Z" />
    <path d="M14.66 5.4c.52-.62.87-1.48.78-2.34-.74.03-1.63.49-2.16 1.1-.47.54-.89 1.41-.77 2.24.83.06 1.63-.42 2.15-1Z" />
  </svg>
);

export const GoogleIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M21.75 12.25c0-.68-.06-1.17-.19-1.69H12v3.19h5.61c-.11.79-.73 1.98-2.09 2.78l-.02.11 3.03 2.35.21.02c1.93-1.78 3.01-4.4 3.01-7.76Z" fill="#4285F4" />
    <path d="M12 22c2.75 0 5.06-.9 6.74-2.44l-3.22-2.48c-.86.6-2.01 1.02-3.52 1.02-2.7 0-4.99-1.78-5.81-4.25l-.11.01-3.15 2.44-.04.11C4.57 19.78 8.02 22 12 22Z" fill="#34A853" />
    <path d="M6.19 13.85A5.98 5.98 0 0 1 5.86 12c0-.64.12-1.25.32-1.85l-.01-.12-3.18-2.48-.1.05A9.93 9.93 0 0 0 2 12c0 1.59.38 3.1 1.05 4.4l3.14-2.55Z" fill="#FBBC05" />
    <path d="M12 5.9c1.9 0 3.18.82 3.91 1.5l2.85-2.78C17.04 3.04 14.75 2 12 2 8.02 2 4.57 4.22 2.89 7.6l3.29 2.54C7.01 7.68 9.3 5.9 12 5.9Z" fill="#EA4335" />
  </svg>
);

export const SearchIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

export const TrendUpIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M4.5 15.5 9 11l3 3 7.5-7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M15.5 6.5H19v3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const ClockIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 8v4.2l2.8 1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const DotIcon = ({ className = "h-2 w-2" }: IconProps) => (
  <svg className={className} viewBox="0 0 8 8">
    <circle cx="4" cy="4" fill="currentColor" r="4" />
  </svg>
);

export const SwitchAccountIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M4 12h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="m11 5 7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M20 5v14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

export const OverviewIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const CreateIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 0 1 3.536 3.536L7.5 20.036H4v-3.572L16.732 3.732Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const LibraryIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const SponsorIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25h-4.5A2.25 2.25 0 0 0 7.5 6v2.25m9 0H7.5m9 0h2.25A2.25 2.25 0 0 1 21 10.5v6.75a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 17.25V10.5a2.25 2.25 0 0 1 2.25-2.25H7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M12 14.25v-2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

export const CampaignIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const AnalyticsIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const EarningsIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const SettingsIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const BellIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const UploadIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const CheckCircleIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const SignatureIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M3 20.25h18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
  </svg>
);

export const LinkIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.556a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 1 1 6.364 6.364l-1.757 1.757" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const PlusIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M12 4.5v15m7.5-7.5h-15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const ImageIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const VideoIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M15.75 10.5l4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const MixedMediaIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M13.5 6A2.25 2.25 0 0 1 15.75 3.75H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18V6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const EyeIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const ShieldCheckIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const GlobeIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.6 9h16.8M3.6 15h16.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9Z" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const MenuIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const MoreIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const CopyIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const WarningIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const FileCheckIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9.375-9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    <path d="M9.75 15l2.25 2.25L15.75 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

export const SparklesIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg className={className} fill="none" viewBox="0 0 24 24">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);
