# TinyTheme — คู่มือสร้างธีมใหม่

เอกสารนี้สำหรับคนที่จะเขียน **theme pack ใหม่** ลงในเครื่องยนต์ TinyTheme (ไม่ใช่คู่มือใช้งาน extension — ถ้าแค่อยากปรับสี/ฟอนต์ ให้เปิด TinyTheme จากเมนู Extensions หรือปุ่มไม้กายสิทธิ์แล้วปรับในหน้าจอได้เลย)

> **ก่อนเริ่ม:** อ่าน [บทที่ 5 "กับดักที่เจ็บมาแล้ว"](#5-กับดักที่เจ็บมาแล้ว) ก่อนเขียน CSS แม้แต่บรรทัดเดียว — ทุกข้อในตารางนั้นคือบั๊กจริงที่เจอตอนทำธีม "Thai Novel Reader" แล้วแก้ไปแล้ว เขียนธีมใหม่แล้วชนกับดักเดิมซ้ำ = เสียเวลาโดยไม่จำเป็น

---

## 1. โครงไฟล์ theme pack

```
tinytheme/themes/
  index.json                 ← ทะเบียนธีมทั้งหมด: ["thai-novel-reader", "your-theme-id"]
  your-theme-id/
    theme.json                metadata + palette ต่อโหมด + ค่าเริ่มต้น + ฟอนต์
    theme.css                 โครงสร้าง CSS — ใช้ var(--tt-*) ล้วน ห้ามมี hex ดิบ
```

**ลงทะเบียนธีม:** เพิ่ม id ของธีม (ชื่อโฟลเดอร์) เข้าไปใน `themes/index.json` เครื่องยนต์จะไม่เห็นธีมที่ไม่ได้ลงทะเบียนไว้ตรงนี้ แม้ไฟล์จะอยู่ในโฟลเดอร์แล้วก็ตาม

```json
["thai-novel-reader", "your-theme-id"]
```

`your-theme-id` ต้องตรงกับชื่อโฟลเดอร์เป๊ะ (lowercase-with-hyphens) เพราะเครื่องยนต์ใช้ค่านี้ต่อ URL ตรงๆ: `themes/${id}/theme.json`

---

## 2. สาม `<style>` ก้อนที่เครื่องยนต์ฉีดให้ (ต้องเข้าใจก่อนเขียน CSS)

เครื่องยนต์ **ไม่** โหลด `theme.css` ตรงๆ ผ่าน `<link>` — มันจะ `fetch()` ไฟล์แล้วยัดใส่ `<style>` เอง ฉีดเรียงกัน 3 ก้อน:

| ลำดับ | id | มาจากไหน | เขียนใหม่เมื่อ |
|---|---|---|---|
| 1 | `tinytheme-fonts` | สร้างจาก `theme.json`'s `fonts[]` เป็น `@font-face` อัตโนมัติ | เปลี่ยนธีม |
| 2 | `tinytheme-structure` | เนื้อหา `theme.css` ทั้งไฟล์ ตรงๆ | เปลี่ยนธีม |
| 3 | `tinytheme-vars` | สร้างจาก mode ที่เลือก + ค่าที่ผู้ใช้ปรับ เป็น `:root { --tt-*: ... }` | สลับโหมด/ลาก slider ใดๆ |

**ทำไมแยก 3 ก้อน:** ก้อน 3 (`vars`) เขียนทับใหม่ได้ถูกๆ (แค่สร้างสตริงสั้นๆ) ตอนผู้ใช้สลับโหมดหรือลาก slider — ไม่ต้อง fetch/parse CSS 20KB ใหม่ทุกครั้ง นี่คือเหตุผลที่ `theme.css` **ห้ามมีค่าสีหรือขนาดดิบ** ต้องอ้างผ่าน `var(--tt-*)` ทั้งหมด ไม่งั้นการสลับโหมดจะไม่มีผล (ค่าดิบอยู่ในก้อน 2 ที่ไม่ได้ถูกเขียนใหม่)

ทั้ง 3 ก้อนถูกฉีดเป็น **`<style>` แยกจากกัน ไม่ใช่ `<link>`** เพราะไฟล์จริง (`theme.css`) ไม่เคยถูกเบราว์เซอร์โหลดตรงๆ — สิ่งที่ปรากฏใน head คือเนื้อหาที่ fetch มาแล้ว

---

## 3. สัญญาตัวแปร `--tt-*`

### กลุ่ม A — palette (ธีมกำหนดค่าไว้ใน `theme.json`'s `modes.<id>.vars`)

| ตัวแปร | ความหมาย | ตัวอย่าง |
|---|---|---|
| `--tt-page` | พื้นหลังหน้าเว็บ (นอกการ์ดเนื้อหา) | `#FFFFFF` |
| `--tt-card` | พื้นการ์ด/กล่องเนื้อหาหลัก | `#FFFFFF` |
| `--tt-card-alt` | พื้นรอง (โค้ดบล็อก, hover, ช่อง input) | `#F4F4F4` |
| `--tt-text` | สีตัวอักษรหลัก | `#303030` |
| `--tt-text-strong` | สีตัวอักษรเน้น (หัวข้อ, ชื่อ) | `#303030` |
| `--tt-text-muted` | สีตัวอักษรรอง/จาง (timestamp, meta) | `#909090` |
| `--tt-line` | สีเส้นคั่น/ขอบ | `#E6E6E6` |
| `--tt-accent` | สีเน้นหลักของธีม (ลิงก์, ปุ่ม, ไอคอนเปิด) | `#00CBC3` |
| `--tt-accent-rgb` | สี accent แบบ `R, G, B` **คั่นด้วยคอมมา ไม่ใช่ hex** — ใช้เขียน `rgba(var(--tt-accent-rgb), .15)` | `0, 203, 195` |
| `--tt-accent-soft` | สี accent เฉดอ่อน/รอง | `#95DBD5` |
| `--tt-grayscale` | ค่า `filter: grayscale()` ของรูปภาพ (0%–100%) | `0%` |
| `--tt-contrast` | ค่า `filter: contrast()` ของรูปภาพ | `100%` |

**สำคัญ:** `--tt-accent-rgb` ต้องเป็น**ตัวเลข 3 ตัวคั่นด้วยคอมมา** (`"0, 203, 195"`) ไม่ใช่ `#00CBC3` — เครื่องยนต์แปลง hex→triplet ให้อัตโนมัติเฉพาะตอนผู้ใช้เลือกสี accent เอง แต่ค่าที่ธีมกำหนดไว้ใน `theme.json` ต้องเป็น triplet อยู่แล้ว

### กลุ่ม B — ผู้ใช้ปรับได้ (เครื่องยนต์เขียนทับจาก UI)

| ตัวแปร | ควบคุมด้วย | ค่าใน `theme.json.defaults` |
|---|---|---|
| `--tt-prose-size` | slider ขนาดตัวอักษร | `proseSize` (หน่วย px, เครื่องยนต์เติม `px` ให้) |
| `--tt-prose-font` | dropdown ฟอนต์ (จาก `fontChoices`) | `proseFont` (ใส่ทั้ง font stack เช่น `"'Jindara', sans-serif"`) |
| `--tt-prose-line-height` | slider ระยะบรรทัด | `lineHeight` (ตัวเลขไม่มีหน่วย) |
| `--tt-column-width` | slider ความกว้างคอลัมน์ | `columnWidth` (หน่วย px) |
| `--tt-indent` | slider ย่อหน้าเยื้อง | `indent` (หน่วย % เครื่องยนต์เติม `%` ให้) |

ธีมที่ไม่ต้องการ control กลุ่มไหน (เช่น ธีมแชทบับเบิลไม่มีคอนเซปต์ "ย่อหน้าเยื้อง") **ไม่ต้อง** ใส่ตัวแปรนั้นใน `theme.css` เลย — แค่ไม่ใส่ key นั้นใน `controls[]` (ดูบทที่ 4) แล้ว UI จะซ่อน control นั้นให้เอง

---

## 4. schema ของ `theme.json`

```jsonc
{
  "id": "your-theme-id",              // ต้องตรงกับชื่อโฟลเดอร์
  "name": "ชื่อธีมที่แสดงผล",
  "description": "อธิบายสั้นๆ",
  "author": "ชื่อผู้เขียน",
  "version": "1.0.0",

  "fonts": [                          // @font-face ที่ธีมต้องการ (ถ้ามี)
    {
      "family": "ชื่อฟอนต์",
      "src": [
        { "url": "https://.../Regular.ttf", "weight": 400, "style": "normal" },
        { "url": "https://.../Bold.ttf",     "weight": 700, "style": "normal" }
      ]
    }
  ],

  "fontChoices": [                    // ตัวเลือกใน dropdown "ฟอนต์เนื้อเรื่อง"
    { "label": "ชื่อที่แสดง", "value": "'ชื่อฟอนต์', fallback, sans-serif" }
  ],

  "modes": {                          // อย่างน้อย 1 โหมด — key คือ id ภายใน (lowercase)
    "mode-id": {
      "label": "ชื่อที่แสดงใน dropdown",
      "vars": { /* ตารางกลุ่ม A ทั้ง 12 ตัว — ใส่ให้ครบทุกตัว */ },
      "themeColors": {                // ค่าสำหรับ SillyTavern's native color pickers
        "main_text_color": "rgba(r, g, b, a)",
        "italics_text_color": "rgba(...)",
        "underline_text_color": "rgba(...)",
        "quote_text_color": "rgba(...)",
        "blur_tint_color": "rgba(...)",
        "chat_tint_color": "rgba(...)",
        "border_color": "rgba(...)"
      }
    }
  },

  "defaults": {                       // ค่าเริ่มต้นของ control กลุ่ม B + สถิติ
    "mode": "mode-id",                // ต้องตรงกับ key ใน modes ด้านบน
    "proseSize": 20,
    "proseFont": "...",
    "lineHeight": 1.7,
    "columnWidth": 640,
    "indent": 10,
    "mesIDDisplay_enabled": true,
    "timer_enabled": true,
    "message_token_count_enabled": true
  },

  "controls": ["mode", "proseSize", "proseFont", "lineHeight", "columnWidth", "indent", "accent", "stats"]
}
```

**`themeColors` ทำไมแยกจาก `vars`:** SillyTavern เองมีระบบสี picker ของตัวเอง (`main_text_color` ฯลฯ) ที่ยังใช้อยู่ในบางจุดที่ CSS ธีมไม่ได้ครอบคลุม (เช่นตอน export เป็นไฟล์ธีม `.json` แบบ standalone — ดูบทที่ 6) จึงต้องกำหนดคู่ขนานไว้ ไม่ใช่ derive จาก `vars` อัตโนมัติ เพราะบางคีย์ไม่ได้ map 1:1 (เช่น `quote_text_color` ธีม "Thai Novel Reader" จงใจให้เท่ากับสีข้อความหลัก ไม่ใช่สี accent เพราะบทสนทนาในเครื่องหมายคำพูดใช้สีเดียวกับคำบรรยาย)

**`controls[]` ที่รองรับ:** `"mode"`, `"proseSize"`, `"proseFont"`, `"lineHeight"`, `"columnWidth"`, `"indent"`, `"accent"`, `"stats"` — ชื่อใน array ต้องตรงกับ `data-control` attribute ใน `panel.html` เป๊ะ (ดู `index.js`'s `populatePanel()`)

---

## 5. กับดักที่เจ็บมาแล้ว

ทุกแถวคือบั๊กจริงที่เกิดขึ้นตอนทำธีม "Thai Novel Reader" ก่อนจะย้ายมาเป็นเครื่องยนต์นี้ — เขียนธีมใหม่แล้วมีโอกาสสูงจะชนกับดักเดิม

| กับดัก | อาการ | ต้นเหตุ | วิธีแก้ |
|---|---|---|---|
| **`!important` แพ้ `!important`** | `.name_text { display: ... !important }` ไม่มีผล | CSS ตัดสิน specificity **ก่อน** source order เสมอ แม้ทั้งคู่จะมี `!important` — selector สั้นแพ้ selector ยาวกว่าเสมอไม่ว่าจะประกาศทีหลังแค่ไหน | ต้องเขียน selector ให้ specificity เท่ากับของ core จริงๆ เช่น `body.documentstyle #chat .mes .mes_block .ch_name .name_text` ไม่ใช่แค่ `.name_text` |
| **`--SmartTheme*` ไม่ยอมเปลี่ยนตามธีม** | สีไม่ตรงที่ตั้งไว้ ทั้งที่ CSS var ดูถูกต้อง | SillyTavern core เขียนค่าพวกนี้เป็น **inline style บน `:root`** ตอนโหลดธีม (ผ่าน color picker) ซึ่งชนะ external stylesheet เสมอถ้าไม่มี `!important` | ทุกการ map `--SmartTheme* : var(--tt-*)` ต้องมี `!important` เสมอ (ดูตัวอย่างในบทที่ 6) |
| **`@import` ฟอนต์ไม่โหลด** | ฟอนต์ Google Fonts เงียบๆ ไม่ทำงาน ทั้งที่ URL ถูก | `@import` ต้องเป็นกฎ**แรกสุด**ของ stylesheet ตาม CSS spec ถ้ามี `:root {}` หรือกฎอื่นนำหน้าแม้แต่บรรทัดเดียว เบราว์เซอร์จะทิ้ง `@import` นั้นทั้งก้อน (บั๊กนี้เกิดขึ้นจริงกับธีมรุ่นก่อนๆ) | เครื่องยนต์เลี่ยงปัญหานี้ไปเลยด้วยการไม่ใช้ `@import` เลย — ให้ประกาศฟอนต์ผ่าน `theme.json`'s `fonts[]` แล้วให้เครื่องยนต์สร้าง `@font-face` แยกก้อนต่างหาก (ก้อนที่ 1 ในตารางบทที่ 2) ถ้าธีมต้องพึ่ง Google Fonts จริงๆ ให้ใช้ `@font-face` ชี้ตรงไป URL ของไฟล์ฟอนต์ ไม่ใช่ `@import` CSS ของ Google |
| **บังคับ `display` ผิดที่ ปุ่มซ้อนทับกัน** | ปุ่มแก้ไข 7 ปุ่มโผล่มาซ้อนทับข้อความอื่น | `.mes_edit_buttons` ปกติ `display:none` และ SillyTavern สลับมันเป็น `display:flex` เองผ่าน **inline style ธรรมดา (ไม่มี `!important`)** ตอนกดแก้ไขข้อความ ถ้าธีมไปบังคับ `display: flex !important` ทับไว้ก่อน จะทำให้ปุ่มโชว์ตลอดเวลาไม่ว่าจะกำลังแก้ไขอยู่หรือไม่ | **ห้ามแตะ `display`** ของ `.mes_edit_buttons`, `.mes_buttons`, และลูกของ `#rightSendForm` เด็ดขาด — ปรับแค่ `position`/`opacity`/สี ที่ไม่กระทบการมองเห็น |
| **ข้อความมองไม่เห็นในธีมสว่าง** | หัวข้อ/รายการที่ปิดอยู่ใน Prompt Manager หรือ World Info อ่านไม่ออก | SillyTavern core hardcode สีตัวอักษรบางจุดเป็น `rgba(255,255,255,.3)` (สีขาวโปร่งแสง) ตรงๆ โดยสมมติว่าพื้นหลังต้องเป็นสีเข้มเสมอ — พอธีมเป็นสีสว่าง กลายเป็นขาวบนขาว | override selector พวกนี้ตรงๆ ด้วย `var(--tt-text-muted)` — ดูตัวอย่างเต็มใน `theme.css` หัวข้อ "13b. Prompt Manager" และ `.disabledWIEntry` |
| **ไอคอนแถบบนจางจนมองไม่เห็นในธีมมืด** | ไอคอนบนสุด (settings, extensions ฯลฯ) แทบมองไม่เห็นเลยในโหมดมืด | `.drawer-icon.closedIcon` ของ core ตั้ง `opacity: 0.3` ไว้ พอซ้อนกับสีตัวอักษรที่จางอยู่แล้ว (`--tt-text-muted` ในโหมดมืดมักเป็นสีเทาเข้ม) กลายเป็นเกือบมองไม่เห็นเลย | ใช้ `--tt-text` (สีหลัก สว่างกว่า) เป็นสีไอคอนแทน `--tt-text-muted` และตั้ง opacity ขั้นต่ำที่ 0.7 ไม่ใช่ปล่อยตาม default 0.3 |
| **ตัดคำไทยพังกลางคำ** | คำไทยขาดครึ่งกลางคำเวลาบรรทัดแคบ | ใส่ `word-break: break-all` หรือ `overflow-wrap: anywhere` โดยไม่ได้ตั้งใจ — ภาษาไทยไม่มีช่องว่างระหว่างคำ เบราว์เซอร์เลยตัดได้ทุกจุดถ้าอนุญาต | ใช้แค่ `overflow-wrap: break-word` (ตัดเฉพาะตอนคำยาวเกินบรรทัดจริงๆ) อย่าใช้ `break-all`/`anywhere` ในเนื้อเรื่องภาษาไทย |
| **ปุ่ม/ข้อความไทยยาวๆ ตัดเป็นแนวตั้งทีละตัวอักษร** | ปุ่มที่มีข้อความไทยยาว (เช่น "รีเซ็ตเป็นค่าเริ่มต้นของธีม") บีบแคบจนอักษรเรียงตัวลงแนวตั้ง | element ใช้ `width: min-content` (เช่น ST's `.menu_button`) — พอข้อความไทยไม่มีช่องว่างให้ตัดคำ เบราว์เซอร์พยายามบีบให้แคบที่สุดโดยตัดได้ทุกตัวอักษร | override `width: auto !important` บน element ที่มีข้อความไทยยาวอยู่ข้างใน |
| **แถบสถิติไม่ตรงกลาง avatar** | เลข `#3`/เวลา/โทเคน เยื้องซ้ายจากจุดกึ่งกลาง avatar ~15px เวลามีแค่บางฟิลด์โผล่ | ใช้ CSS Grid วางฟิลด์ที่ "โผล่บ้างไม่โผล่บ้าง" (เวลา/โทเคน) เป็น 3 คอลัมน์เท่ากัน โดยให้ avatar (row บนสุด) span คร่อมทั้ง 3 คอลัมน์ — พอบางคอลัมน์ว่าง grid ยังต้องเผื่อพื้นที่ให้ avatar span ได้ ทำให้แถวเบี้ยวจากจุดกึ่งกลางจริง | ฟิลด์ที่**มีค่าเสมอ** (เช่น เลขข้อความ) ต้องอยู่**คอลัมน์กลาง** ของทั้ง 3 คอลัมน์ ไม่ใช่คอลัมน์ริม — ทดสอบแล้วว่ากรณีมีแค่ฟิลด์กลางอย่างเดียวจะตรงกึ่งกลาง avatar เป๊ะ |
| **`custom_css` ทั้งก้อนถูกยัดใน `<style>` เดียว** | ลืมว่า core โหลด `custom_css` ยังไงตอนแปลง theme pack เป็นไฟล์ standalone (บทที่ 6) | `applyCustomCSS()` ของ core สร้าง `<style id="custom-style">` เดียวแล้ว set `.innerHTML` ทั้งก้อน — ไม่มีการแยกไฟล์/ลำดับโหลดแบบเครื่องยนต์นี้ | เวลา export เป็น `.json` standalone ต้อง **ต่อ** @font-face + :root(ค่าดิบ) + theme.css เข้าด้วยกันเป็นสตริงเดียว ให้เหมือนกับที่เครื่องยนต์ฉีด 3 ก้อนตอน runtime (ดู `scratchpad/build_theme_json.py`) |

---

## 6. ตัวอย่างธีมขั้นต่ำ (ก๊อปไปแก้ได้เลย)

`themes/my-simple-theme/theme.json`:
```json
{
  "id": "my-simple-theme",
  "name": "My Simple Theme",
  "description": "ตัวอย่างธีมขั้นต่ำที่ใช้งานได้จริง",
  "author": "your-name",
  "version": "1.0.0",
  "fonts": [],
  "fontChoices": [
    { "label": "Sarabun", "value": "'Sarabun', 'Noto Sans', sans-serif" }
  ],
  "modes": {
    "light": {
      "label": "สว่าง",
      "vars": {
        "page": "#FAFAFA", "card": "#FFFFFF", "card-alt": "#F0F0F0",
        "text": "#222222", "text-strong": "#000000", "text-muted": "#888888",
        "line": "#DDDDDD", "accent": "#3366FF", "accent-rgb": "51, 102, 255",
        "accent-soft": "#88AAFF", "grayscale": "0%", "contrast": "100%"
      },
      "themeColors": {
        "main_text_color": "rgba(34, 34, 34, 1)",
        "italics_text_color": "rgba(136, 136, 136, 1)",
        "underline_text_color": "rgba(51, 102, 255, 1)",
        "quote_text_color": "rgba(34, 34, 34, 1)",
        "blur_tint_color": "rgba(255, 255, 255, 1)",
        "chat_tint_color": "rgba(250, 250, 250, 1)",
        "border_color": "rgba(221, 221, 221, 1)"
      }
    }
  },
  "defaults": {
    "mode": "light", "proseSize": 16, "proseFont": "'Sarabun', 'Noto Sans', sans-serif",
    "lineHeight": 1.6, "columnWidth": 600, "indent": 0,
    "mesIDDisplay_enabled": true, "timer_enabled": true, "message_token_count_enabled": true
  },
  "controls": ["mode", "proseSize", "proseFont", "lineHeight", "columnWidth", "accent", "stats"]
}
```

`themes/my-simple-theme/theme.css`:
```css
:root {
  --SmartThemeBodyColor: var(--tt-text) !important;
  --SmartThemeEmColor: var(--tt-text-muted) !important;
  --SmartThemeUnderlineColor: var(--tt-accent) !important;
  --SmartThemeQuoteColor: var(--tt-text) !important;
  --SmartThemeBorderColor: var(--tt-line) !important;
  --SmartThemeBlurTintColor: var(--tt-card) !important;
  --SmartThemeChatTintColor: var(--tt-page) !important;
}

body {
  background-color: var(--tt-page) !important;
}

.mes {
  background: var(--tt-card) !important;
  border-bottom: 1px solid var(--tt-line) !important;
  max-width: var(--tt-column-width) !important;
  margin: 0 auto !important;
}

.mes_text {
  font-family: var(--tt-prose-font) !important;
  font-size: var(--tt-prose-size) !important;
  line-height: var(--tt-prose-line-height) !important;
  color: var(--tt-text) !important;
}

.mes_text a {
  color: var(--tt-accent) !important;
}
```

จากนั้นเพิ่ม `"my-simple-theme"` ใน `themes/index.json` แล้วจะโผล่ในตัวเลือกโหมด/ธีมของ TinyTheme ทันที — ไม่ต้อง build อะไรเพิ่ม

---

## 7. อ้างอิงเพิ่มเติม

- **โครง DOM ของข้อความแชท** (`.mes`, `.mesAvatarWrapper`, `.ch_name`, `.name_text`, `.mes_text`, `.mes_buttons`) — ดู `SillyTavern-release/public/index.html:7378-7458` (ค้นหา `id="message_template"`)
- **top bar / drawer / form controls** — `#top-bar`, `#top-settings-holder`, `#send_form`, `.drawer-content`, `.inline-drawer-*` ดูตัวอย่างการ theme ครบใน `themes/thai-novel-reader/theme.css`
- **ตัวแปร CSS ดั้งเดิมของ SillyTavern** — `SillyTavern-release/public/style.css:20-133` (รายการ `--SmartTheme*` ทั้งหมดที่มีอยู่)
- **การ export เป็นไฟล์ธีม `.json` standalone** (ไม่ต้องพึ่ง extension) — ดู `scratchpad/build_theme_json.py` เป็นตัวอย่างสคริปต์ที่ต่อ 3 ก้อน CSS เข้าด้วยกันจาก `theme.json` + `theme.css` เดียวกับที่เครื่องยนต์ใช้ ทำให้ CSS มีแหล่งเดียว (single source of truth) ไม่ต้องดูแลสองที่
