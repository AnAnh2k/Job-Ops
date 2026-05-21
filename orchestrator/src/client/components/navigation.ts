import {
  Columns3,
  Eye,
  FilePenLine,
  Home,
  Inbox,
  LayoutDashboard,
  Link2,
  Settings,
  Shield,
} from "lucide-react";

export type NavLink = {
  to: string;
  label: string;
  icon: typeof Home;
  activePaths?: string[];
};

export const NAV_LINKS: NavLink[] = [
  { to: "/overview", label: "Tổng quan", icon: Home },
  {
    to: "/jobs/ready",
    label: "Công việc",
    icon: LayoutDashboard,
    activePaths: [
      "/jobs/ready",
      "/jobs/discovered",
      "/jobs/applied",
      "/jobs/all",
    ],
  },
  {
    to: "/applications/in-progress",
    label: "Đang ứng tuyển",
    icon: Columns3,
    activePaths: ["/applications/in-progress"],
  },
  {
    to: "/design-resume",
    label: "Thiết kế CV",
    icon: FilePenLine,
    activePaths: ["/design-resume"],
  },
  { to: "/tracking-inbox", label: "Hộp thư theo dõi", icon: Inbox },
  {
    to: "/tracer-links",
    label: "Liên kết theo dõi",
    icon: Link2,
    activePaths: ["/tracer-links"],
  },
  { to: "/visa-sponsors", label: "Nhà bảo lãnh Visa", icon: Shield },
  { to: "/watchlist", label: "Danh sách theo dõi", icon: Eye },
  { to: "/settings", label: "Cài đặt", icon: Settings },
];

export const isNavActive = (
  pathname: string,
  to: string,
  activePaths?: string[],
) => {
  if (pathname === to) return true;
  if (!activePaths) return false;
  return activePaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
};
