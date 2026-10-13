# Screens Spec — הפועל באר שבע Fan Club CRM

> Source: design spec batches (screenshots of the Figma Make file's own spec pages).
> File names refer to the Figma Make React output — used as a mapping reference, our own structure may differ.
> Status: IN PROGRESS — appended as batches arrive.

## Navigation (dark sidebar, right side)

דשבורד · אוהדים · מנויים · משחקי בית · משחקי חוץ

---

## 1. דשבורד ראשי — Main Dashboard (`App.tsx`)

| Component        | Displays |
| ---------------- | -------- |
| Header           | Title "דשבורד ראשי", subtitle |
| KPI Cards × 5    | סה״כ אוהדים, מנויים פעילים, לא חידשו, פעילים באפליקציה, קמפיינים פעילים |
| Area Chart       | גידול מספר אוהדים — monthly fan growth trend |
| Pie Chart        | התפלגות מנויים — active vs. churned vs. non-subscribers |
| Campaign Cards × 4 | קמפיינים אחרונים — name, status badge, reach, date |
| Activity Feed    | פעילות אחרונה — timestamped recent system events |

KPI examples seen: 18,500 total fans (+12% vs last month), 8,234 active subscribers (+5.2%), 1,456 didn't renew, 12,340 active in app.

## 2. אוהדים — Fan Management (`FansManagement.tsx`)

| Component        | Displays |
| ---------------- | -------- |
| Header           | Title, action buttons (הוסף אוהד, ייבוא אקסל, ייצוא אקסל, סינון מתקדם, search) |
| Search + Filters | Free text search, dropdowns for status/city/type; quick filters: הכל / כל הערים / כל התגיות / כל הציונים; נקה סינון |
| Data Table       | Fan rows: ID (מספר לקוח), name (פרטי+משפחה), age, city, subscription type, fan score, status, last activity, phone, email, actions |
| Row Actions      | View (→ profile), Edit, Send message |
| Pagination       | Page controls, record count |

## 3. פרופיל אוהד — Fan Profile (`FanProfile.tsx`)

| Component         | Displays |
| ----------------- | -------- |
| Header            | Back button, Edit button, fan name + avatar |
| Identity Card     | Name, age, city, email, phone, member since |
| Fan Score         | Numeric score with visual indicator |
| Subscription Info | Type, renewal date, payment status |
| Attendance Stats  | Games attended, home vs. away breakdown |
| App Activity      | Usage metrics, last login |
| Match History     | List of games the fan attended |

## 4. עריכת אוהד — Fan Edit (`FanEdit.tsx`)

| Component             | Displays |
| --------------------- | -------- |
| Header                | Back button, Save/Cancel buttons |
| Personal Details Form | Name, age, city, email, phone fields |
| Subscription Section  | Type selector, renewal toggle |
| Preferences           | Communication channel checkboxes (→ consent/opt-in flags) |
| Save Actions          | Save, Cancel |

## 5. מנויים — Subscriptions Dashboard (`SubscriptionsDashboard.tsx`)

| Component                | Displays |
| ------------------------ | -------- |
| Header                   | Title, subtitle |
| KPI Cards × 5            | מנויים פעילים, מנויי עונה קודמת, לא חידשו, אחוז חידוש (progress bar), פוטנציאל שימור |
| Bar Chart                | השוואת מנויים לפי עונות — 5-season comparison with summary stats |
| Line Chart               | מגמת חידושים — active vs. renewed over 6 months |
| Churned Subscribers Table| ID, name, age, city, type, years, last payment, priority badge, suggested action, row actions |
| Table Controls           | Type + city filters, bulk action button, pagination |

## 6. משחקי בית — Home Games (`HomeGames.tsx`)

| Component       | Displays |
| --------------- | -------- |
| Header          | Title, action buttons |
| KPI Cards × 5   | משחקי בית, ממוצע קהל, אחוז ניצול מנויים, כרטיסים שנמכרו, הכנסות |
| Filters + Table | Competition + attendance dropdowns; date, opponent, competition badge, subscribers, tickets, total, occupancy bar, status badge, row actions |
| Bar Chart       | נוכחות לפי משחק — subscribers vs. tickets per match |
| Line Chart      | מגמת מכירת כרטיסים — ticket sales with season-average reference line |

## 7. משחקי חוץ — Away Games (`AwayGames.tsx`)

| Component             | Displays |
| --------------------- | -------- |
| Header                | Title, action buttons: צור קמפיין למשחק חוץ (primary), ניהול הסעות (dark), ניתוח קהל, ייצוא דוח |
| KPI Cards × 5         | משחקי חוץ, רוכשי כרטיסים, משתתפים בהסעות, אחוז הגעה, הכנסות |
| Bar Chart             | כרטיסים והסעות לפי משחק |
| Line Chart            | מגמת השתתפות — attendees per match vs. average |
| Donut Chart           | פילוח רוכשים — subscribers / non-subscribers / VIP |
| Search + Filters      | Text search, competition + shuttle dropdowns |
| Away Matches Table    | Date, opponent, competition badge, stadium, tickets, shuttle, attended, revenue, occupancy bar, row actions |
| Top Fans Table        | Rank, avatar, name, games, tickets, app usage bar, fan score |
| Potential Fans Cards × 4 | Last game, previous attendance count, fan score, preferred channel, hover CTA |

KPI examples seen (2025/26): הכנסות ₪201K (+14%), אחוז הגעה 88.9% (+3.2%), 1,171 משתתפים בהסעות מתוך 8 משחקים, 2,011 רוכשי כרטיסים (+11%), 8 משחקי חוץ מתוך 17 מתוכננים.

---

## Spec status

All 7 screens received (user confirmed "Finished"). Not provided: typography/spacing tokens (use sensible Hebrew-friendly defaults, e.g. Heebo), campaign-creation & send-message flow details (design TBD — model them in the backend anyway).
