/* أيقونات التنقّل الجديدة — من مكتبة Lucide بدل SVG يدوي لكل أيقونة على
   حدة، عشان نضمن اتساق بصري ومكتبة موحّدة (>1500 أيقونة جاهزة) بدل صيانة
   ملفات SVG واحد واحد. أبقينا BeanIcon مخصص (Lucide ما فيه بديل يشبه حبة
   قهوة فعلاً — Leaf بعيد عن الهوية البصرية). */
import type { LucideIcon as LucideIconType } from 'lucide-react';
import {
  LayoutGrid,
  Activity,
  Trophy,
  Coffee,
  Store,
  Truck,
  ShoppingBag,
  Receipt,
  Users,
  ShieldCheck,
  Bell,
  Coins,
  MousePointerClick,
  Network,
  Target,
  Link as LinkIconLucide,
  Scale,
  Wallet,
  Tag,
} from 'lucide-react';

type Props = { className?: string };
const base = 'h-[18px] w-[18px]';

const wrap = (LucideIcon: LucideIconType) =>
  function Wrapped({ className = base }: Props) {
    return <LucideIcon className={className} strokeWidth={1.7} />;
  };

export const OverviewIcon = wrap(LayoutGrid);
export const PulseIcon = wrap(Activity);
export const TrophyIcon = wrap(Trophy);
export const CupIcon = wrap(Coffee);
export const StorefrontIcon = wrap(Store);
export const TruckIcon = wrap(Truck);
export const BagIcon = wrap(ShoppingBag);
export const ReceiptIcon = wrap(Receipt);
export const UsersIcon = wrap(Users);
export const ShieldIcon = wrap(ShieldCheck);
export const BellIcon = wrap(Bell);
export const CoinIcon = wrap(Coins);
export const CursorClickIcon = wrap(MousePointerClick);
export const NetworkIcon = wrap(Network);
export const TargetIcon = wrap(Target);
export const LinkIcon = wrap(LinkIconLucide);
export const ScaleIcon = wrap(Scale);
export const WalletIcon = wrap(Wallet);
export const TagIcon = wrap(Tag);
