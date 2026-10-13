import { scoreTier } from "@club/shared";
import { Badge } from "./Badge";

/** Engagement score chip — tiers follow the design token thresholds. */
export function ScoreBadge({ score }: { score: number }) {
  const tier = scoreTier(score);
  const variant =
    tier === "high" ? "success" : tier === "medium" ? "warning" : "danger";
  return <Badge variant={variant}>{score}</Badge>;
}
