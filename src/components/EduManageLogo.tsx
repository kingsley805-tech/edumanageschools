import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type Props = {
  to?: string | null;
  className?: string;
  imgClassName?: string;
  textClassName?: string;
};

export function EduManageLogo({
  to = "/landing",
  className,
  imgClassName = "h-10",
}: Props) {
  const content = (
    <div className={cn("inline-flex items-center select-none", className)}>
      <img
        src="/assets/edumanageLogo.png"
        alt="EduManage"
        className={cn("h-10 w-auto object-contain", imgClassName)}
        draggable={false}
      />
    </div>
  );

  if (to == null) {
    return content;
  }

  return (
    <Link to={to} className="inline-flex items-center">
      {content}
    </Link>
  );
}
