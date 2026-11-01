import type { Church } from "@/lib/types";

export function ChurchChip({ church }: { church: Church }) {
  return (
    <span className="church-chip">
      <span className="swatch" style={{ background: church.color }} />
      {church.name}
    </span>
  );
}
