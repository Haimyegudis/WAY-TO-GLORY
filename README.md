# הדרך לתהילה — Road to Glory

סימולטור קריירה של כדורגלן אחד: מהאקדמיה ועד המשחק האחרון. כל החלטה שלך, וכל
החלטה משנה משהו — כושר, מורל, אמון המאמן, היחס של האוהדים, ההנהלה וחדר ההלבשה.

A single-player football career simulator. You never control the team: you manage
one player's career, and the world reacts.

## הרצה מקומית

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # לשחק מהטלפון באותה רשת
```

## בדיקות ובנייה

```bash
npm test               # 34 בדיקות מנוע
npm run soak           # קריירה שלמה ללא ממשק, להצצה על האיזון
npm run build          # בניית ה-PWA ל-packages/app/dist
```

## מבנה

```
packages/
  engine/   מנוע טהור ב-TypeScript. אין DOM, אין React. דטרמיניסטי לפי seed.
  data/     ייבוא ליגות ומועדונים, סמלים, שמות בעברית, אירועים
  app/      React + Vite + PWA, עברית/אנגלית עם RTL מלא
```

## נתונים

- **ליגות ומועדונים**: מיובאים מ-[openfootball](https://github.com/openfootball) לעונת 2025/26,
  436 מועדונים ב-24 ליגות. הליגות הישראליות והדרגים החסרים נכתבו ידנית.
- **סמלים ושמות בעברית**: נמשכים פעם אחת מוויקיפדיה בסקריפט build ונשמרים מקומית,
  כדי שהמשחק יעבוד אופליין.
- **סמלים**: מקור אמיתי אחד - TheSportsDB, שמזהה כל קבוצה לפי ענף ומדינה, ולכן לא
  מגיעים סמלים של קבוצת כדורסל או תמונות אצטדיון. מי שאין לו שם, נופל לוויקיפדיה
  וגם שם נלקח רק קובץ ששמו הוא סמל/לוגו, אף פעם לא תמונת הכתבה. כל קובץ נבדק שהוא
  ריבועי בערך, אחרת הוא נדחה.
- **שחקנים**: שחקנים אמיתיים מהמאגר לכל מועדון שנמצא, בתוספת רשימת הכוכבים
  הידנית (שמחזיקה ציונים אמיתיים) שגוברת עליה; שאר הסגל מיוצר פרוצדורלית.

```bash
npm run -w @fc/data fetch     # מוריד את קבצי openfootball
npx tsx packages/data/src/fetch-crests.ts --all   # סמלים מ-TheSportsDB (+ צבע הקבוצה)
npx tsx packages/data/src/fetch-squads.ts         # שחקנים אמיתיים לכל מועדון
npx tsx packages/data/src/fetch-club-assets.ts    # שמות בעברית מוויקיפדיה
npx tsx packages/data/src/build-pack.ts           # בונה את pack.json
npx tsx packages/data/src/copy-assets.ts          # מעתיק סמלים ל-app/public
npx tsx packages/data/src/verify-crests.ts        # מוודא שכל סמל שייך באמת לקבוצה
npx tsx packages/data/src/crest-sheet.ts          # עמוד בדיקה: /crests.html
```

אם האינדקס והקבצים יצאו מסנכרון (למשל שתי הורדות רצו במקביל):
`npx tsx packages/data/src/repair-assets.ts` בונה את האינדקס מחדש מהקבצים שעל הדיסק.

### תמונות רקע

שלוש תמונות נטענות מ-`packages/app/public/bg/`:

| קובץ | שימוש |
|---|---|
| `hero.jpg` | מסך הפתיחה |
| `stadium.jpg` | רקע כללי לכל המסכים |
| `positions.jpg` | המגרש בבחירת עמדה |

אם קובץ חסר, המסך מצייר גרסה משלו ולא נשבר.

## פריסה

### Vercel

`vercel.json` כבר מוגדר: `npm run build` ופלט מ-`packages/app/dist`.

```bash
npx vercel --prod
```

### Supabase (רשות)

שמירה בענן וטבלת שיאים. בלי המשתנים האלה המשחק עובד רגיל, מקומית בלבד.

1. צור פרויקט ב-Supabase.
2. הרץ את `supabase/schema.sql` ב-SQL Editor.
3. הוסף משתני סביבה (ב-Vercel וב-`.env.local` מקומי):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## הערה משפטית

סמלי מועדונים ושמות שחקנים הם סימני מסחר של בעליהם ומשמשים כאן בבנייה פרטית
ולא מסחרית. המנוע מכיר רק `clubId`; כל השמות והסמלים יושבים ב-data pack נפרד,
כך שהחלפה לגרסה גנרית היא החלפת קובץ אחד.
