/**
 * Team symbols — the ticketing system's short club codes offered in the
 * onboarding wizard. This list is the single source of truth: the onboarding
 * DTO validates against it and the wizard dropdown fetches it from
 * `GET /api/auth/team-symbols`. To add a club, add a row here.
 */
export interface TeamSymbol {
  code: string;
  name: string;
  nameEn: string;
}

export const TEAM_SYMBOLS: readonly TeamSymbol[] = [
  { code: "HFS", name: "הפועל באר שבע", nameEn: "Hapoel Be'er Sheva" },
];

export const TEAM_SYMBOL_CODES: string[] = TEAM_SYMBOLS.map((s) => s.code);
