import { Shield } from "lucide-react";
import { Badge } from "@/components/ui";

export function AdminOnlyBadge({ className }: { className?: string }) {
  return (
    <span title="Visivel apenas para administradores">
      <Badge color="#ef4444" className={className}>
        <Shield size={11} className="mr-0.5 inline" />
        Admin
      </Badge>
    </span>
  );
}
