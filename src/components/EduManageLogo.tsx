import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Props = {
  /** Pass null to render without a link */
  to?: string | null;
  className?: string;
  /** Image height in Tailwind classes, e.g. h-9 / h-11 */
  imgClassName?: string;
};

/** Official EduManage wordmark (cap + EduManage) for public pages */
export function EduManageLogo({
  to = "/landing",
  className,
  imgClassName = "h-9",
}: Props) {
  const img = (
    <img
      src="/edumanage-logo.png"
      alt="EduManage"
      className={cn("w-auto object-contain", imgClassName)}
      draggable={false}
    />
  );

  if (to == null) {
    return <div className={cn("inline-flex items-center", className)}>{img}</div>;
  }

  return (
    <Link to={to} className={cn("inline-flex items-center", className)}>
      {img}
    </Link>
  );
}
