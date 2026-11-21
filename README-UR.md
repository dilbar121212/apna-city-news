# اپنا سٹی نیوز — Cloudflare + Google Sheets CMS

یہ پیکج ایک Static News Portal، Cloudflare Pages Functions API، Google Sheets data layer اور Cloudflare Access newsroom authentication فراہم کرتا ہے۔

## فائلیں
- `index.html` — عوامی نیوز ویب سائٹ
- `admin/index.html` — Admin / Editor Dashboard
- `functions/api/public-news.js` — عوامی طور پر صرف Published خبریں
- `functions/api/manage-news.js` — Access JWT کی تصدیق اور محفوظ CMS آپریشنز
- `scripts/google-apps-script.gs` — Google Sheet کے لیے API

## حصہ 1: Google Sheet تیار کریں
1. Google Drive میں نئی Google Sheet بنائیں، نام `Apna City News CMS` رکھیں۔
2. Extensions → Apps Script کھولیں۔
3. `scripts/google-apps-script.gs` کا مکمل کوڈ Code.gs میں پیسٹ کریں۔
4. Apps Script کے Project Settings → Script Properties میں یہ property بنائیں:
   - `NEWS_API_SECRET` = ایک لمبا، منفرد، بے ترتیب راز (کم از کم 32 حروف)۔
5. `setupSheet()` کو ایک بار Run کریں اور اجازتیں منظور کریں۔
6. Deploy → New deployment → Web app:
   - Execute as: Me
   - Who has access: Anyone
7. Deploy کے بعد `/exec` URL کاپی کریں۔ یہ URL صرف Cloudflare Pages environment variable میں لگے گا، ویب صفحے میں نہیں۔
8. Sheet کو پبلک یا Anyone-with-link Editor نہ بنائیں۔ صرف مالک اور مطلوبہ معتبر Google اکاؤنٹس کو رسائی دیں۔

## حصہ 2: Cloudflare Pages
1. اس فولڈر کے تمام مواد کو GitHub repository میں اپ لوڈ کریں، یا Cloudflare Pages Direct Upload استعمال کریں۔
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git۔
3. Framework preset: None؛ Build command خالی؛ Build output directory `.`۔
4. Deploy کریں۔ اپنا `*.pages.dev` URL مل جائے گا۔

## حصہ 3: Cloudflare Pages Environment Variables / Secrets
Pages project → Settings → Variables and Secrets میں یہ values شامل کریں (Production اور Preview دونوں میں ضرورت کے مطابق):

- `GOOGLE_SCRIPT_URL` = Apps Script کا `/exec` URL
- `NEWS_API_SECRET` = وہی secret جو Apps Script Script Properties میں رکھا
- `CF_ACCESS_TEAM_DOMAIN` = مثال `your-team.cloudflareaccess.com` (صرف hostname، https کے بغیر)
- `CF_ACCESS_AUD` = Cloudflare Access applications کے Audience (AUD) tags، comma-separated (Admin page اور manage API کے دونوں tags)
- `ADMIN_EMAILS` = comma-separated admin email addresses
- `EDITOR_EMAILS` = comma-separated editor email addresses

`NEWS_API_SECRET` کو Secret کے طور پر محفوظ کریں، عام text variable کے طور پر نہیں۔

## حصہ 4: Cloudflare Access
1. Zero Trust → Access → Applications → Add an application → Self-hosted۔
2. Application domain: آپ کا `your-site.pages.dev` host۔
3. ایک Self-hosted Access application `/admin/*` path کے لیے اور دوسری `/api/manage-news` path کے لیے بنائیں۔ دونوں applications کے AUD tags کو comma-separated شکل میں `CF_ACCESS_AUD` میں رکھیں۔
4. دونوں کے لیے Allow policy بنائیں۔ صرف Admin اور Editor کے ای میلز شامل کریں۔
5. Access application کا AUD tag `CF_ACCESS_AUD` میں لگائیں۔
6. Admin اور Editor کے email addresses کو بالترتیب `ADMIN_EMAILS` اور `EDITOR_EMAILS` میں شامل کریں۔
7. `CF_ACCESS_TEAM_DOMAIN` میں آپ کی ٹیم کا Cloudflare Access team domain رکھیں۔

اہم: `/api/public-news` کو Access سے محفوظ نہ کریں؛ یہ عوامی ویب سائٹ کا read-only endpoint ہے۔ `/admin/*` اور `/api/manage-news` لازماً محفوظ ہوں۔

## کردار اور اجازتیں
- Admin: نئی خبر بنانا، ترمیم، شائع کرنا، draft بنانا، حذف کرنا، featured اور breaking flag لگانا۔
- Editor: خبر بنانا اور ترمیم کر کے Draft میں جمع کرنا۔ Editor براہِ راست publish یا delete نہیں کر سکتا۔
- عوام: صرف Published خبریں دیکھ سکتے ہیں۔

## جانچ
1. `https://YOUR-SITE.pages.dev/` کھولیں۔
2. `https://YOUR-SITE.pages.dev/admin/` کھولیں اور Cloudflare Access سے لاگ اِن کریں۔
3. Admin کے طور پر خبر Publish کریں؛ عوامی صفحے پر ظاہر ہونی چاہیے۔
4. Editor کے طور پر خبر جمع کریں؛ وہ Draft رہے گی، Admin منظوری کے بعد شائع کرے۔
5. `api/public-news` کو private معلومات یا drafts واپس نہیں کرنے چاہئیں۔

## اہم حدود اور پروڈکشن نوٹس
- Google Apps Script Web App کا endpoint خود عوامی URL ہوتا ہے، مگر POST عملیات کے لیے shared secret لازم ہے۔ secret صرف Cloudflare اور Apps Script کے server-side settings میں رکھیں۔
- اس starter میں تصاویر HTTPS image URLs سے آتی ہیں؛ اصل image hosting / upload storage شامل نہیں۔ بہتر production workflow کے لیے Cloudflare R2 یا معتبر media storage شامل کریں۔
- Cloudflare Access email policies آپ کے newsroom کی شناخت اور لاگ اِن کنٹرول کرتی ہیں۔ Admin/Editor role API میں email allowlists سے الگ نافذ ہوتا ہے۔
- Google Sheets ایک چھوٹے/درمیانے newsroom کے ابتدائی CMS کے لیے قابلِ عمل ہے؛ بہت زیادہ ٹریفک، متعدد مصنفین، audit history، scheduled publishing اور advanced search کے لیے بعد میں D1/Postgres پر منتقلی بہتر ہوگی۔
- کسی بھی خبر کی اشاعت سے پہلے ماخذ کی تصدیق، تصویر کے حقوق اور ادارتی منظوری یقینی بنائیں۔
