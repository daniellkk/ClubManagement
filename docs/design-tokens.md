# Design Tokens — הפועל באר שבע Fan Club CRM

> Source: design spec batches provided as screenshots (Figma Make).
> Status: IN PROGRESS — appended as batches arrive. Tailwind classes referenced are standard Tailwind palette.
> UI is Hebrew, RTL. Dark sidebar (right side), light content area.

## Primary & Brand Colors

| Role               | Value                |
| ------------------ | -------------------- |
| Primary (red)      | `#dc2626` (red-600)  |
| Primary hover      | `#b91c1c` / red-700  |
| Sidebar background | `#1a1a1a`            |
| Sidebar hover      | `#374151` (gray-700) |
| Sidebar active item| `#dc2626`            |

## Page & Surface Colors

| Role             | Value                 |
| ---------------- | --------------------- |
| Page background  | `#f8f9fa`             |
| Card / panel     | `#ffffff`             |
| Table header row | gray-50               |
| Filter bar       | gray-50/60            |
| Input background | `#ffffff`             |
| Border / divider | gray-200 / gray-100   |

## Text Colors

| Role                   | Class            | Hex       |
| ---------------------- | ---------------- | --------- |
| Headings / primary     | text-gray-900    | `#111827` |
| Body text              | text-gray-700    | `#374151` |
| Secondary text         | text-gray-600    | `#4b5563` |
| Labels / muted         | text-gray-500    | `#6b7280` |
| Captions / placeholder | text-gray-400    | `#9ca3af` |
| On dark/red surfaces   | text-white       | `#ffffff` |
| Negative metric        | text-red-600     | `#dc2626` |
| Positive metric        | text-green-700   | `#15803d` |

## Buttons

| Type              | Background | Text     | Border   |
| ----------------- | ---------- | -------- | -------- |
| Primary action    | `#dc2626`  | white    | —        |
| Dark action       | gray-900   | white    | —        |
| Secondary / ghost | white      | gray-700 | gray-300 |
| Danger hover      | red-700    | white    | —        |

## Table & Badge Colors

| Status          | Background | Text       |
| --------------- | ---------- | ---------- |
| High / active   | green-100  | green-700  |
| Medium          | amber-100  | amber-700  |
| Low / urgent    | red-100    | red-700    |
| League badge    | blue-50    | blue-700   |
| Cup badge       | purple-50  | purple-700 |
| Subscriber type | blue-100   | blue-800   |

## KPI Card Icon Backgrounds (per screen)

| Icon color | Background  |
| ---------- | ----------- |
| Red        | bg-red-50   |
| Blue       | bg-blue-50  |
| Green      | bg-green-50 |
| Purple     | bg-purple-50|
| Amber      | bg-amber-50 |
| Gray       | bg-gray-100 |

## Occupancy / Progress Bars

| Threshold | Color        |
| --------- | ------------ |
| ≥ 80%     | bg-green-500 |
| 60–79%    | bg-amber-400 |
| < 60%     | bg-red-500   |

## Notes / open items

- Positive metric uses green-700 text (dashboards show +% deltas in green with up-trend icon).
- Score/status chips: green = high, amber = medium, red = low/urgent — matches fan engagement score tiers.
- Competition badges: League (blue), Cup (purple) → games carry a competition type.
- Brand color should be implemented as per-tenant CSS variables/theme tokens (Hapoel red now, other clubs later) — do not hardcode red-600 in components.
- Awaiting further batches: typography/spacing, remaining screens (מנויים, משחקי בית, campaigns), component specs.
