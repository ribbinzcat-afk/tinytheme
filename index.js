// TinyTheme — เครื่องยนต์ธีมแบบปรับแต่งได้สำหรับ SillyTavern
// ดู THEME-AUTHORING.md สำหรับสัญญาตัวแปร --tt-* และรูปแบบ theme pack

import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { eventSource, event_types } from "../../../../script.js";
import { power_user, applyPowerUserSettings } from "../../../power-user.js";
import { callGenericPopup, POPUP_TYPE } from "../../../popup.js";
import { SlashCommandParser } from "../../../slash-commands/SlashCommandParser.js";
import { SlashCommand } from "../../../slash-commands/SlashCommand.js";
import { ARGUMENT_TYPE, SlashCommandNamedArgument } from "../../../slash-commands/SlashCommandArgument.js";
import { SlashCommandEnumValue } from "../../../slash-commands/SlashCommandEnumValue.js";

const extensionName = "tinytheme";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const STYLE_IDS = {
    fonts: "tinytheme-fonts",
    structure: "tinytheme-structure",
    vars: "tinytheme-vars",
};

/** แคช theme pack ที่โหลดแล้ว — กัน fetch ซ้ำตอนสลับโหมด/ปรับ slider (สลับแค่ธีมจริงถึง fetch ใหม่) */
const themeCache = {}; // id -> { meta, css }

let activeThemeId = null;

function ensureSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    const s = extension_settings[extensionName];
    if (s.enabled === undefined) s.enabled = true;
    if (!s.activeTheme) s.activeTheme = "thai-novel-reader";
    if (!s.perTheme || typeof s.perTheme !== "object") s.perTheme = {};
    return s;
}

/**
 * อ่านค่าปรับแต่งของธีมหนึ่ง — fallback ไปหา theme.json's defaults ทีละคีย์
 * (ตั้งใจไม่ใช้ Object.assign ตอน object ว่าง เพราะคีย์ใหม่ที่เพิ่มในเวอร์ชันหลัง
 * จะหายสำหรับผู้ใช้เดิมที่มี object ไม่ว่างอยู่แล้ว — บทเรียนจาก TinyFeed)
 */
function getThemeSetting(themeId, key) {
    const s = ensureSettings();
    const perTheme = s.perTheme[themeId];
    if (perTheme && perTheme[key] !== undefined && perTheme[key] !== null) {
        return perTheme[key];
    }
    const meta = themeCache[themeId]?.meta;
    return meta?.defaults?.[key];
}

/** เขียนค่าปรับแต่งของธีมหนึ่ง แล้วเซฟ (debounced) */
function setThemeSetting(themeId, key, value) {
    const s = ensureSettings();
    if (!s.perTheme[themeId]) s.perTheme[themeId] = {};
    s.perTheme[themeId][key] = value;
    saveSettingsDebounced();
}

/** อ่านทั้ง object การปรับแต่งของธีมหนึ่ง (ใช้เติมค่าเริ่มต้นในฟอร์ม) */
function getThemeSettingsObject(themeId) {
    const meta = themeCache[themeId]?.meta;
    const keys = ["mode", "proseSize", "proseFont", "lineHeight", "columnWidth", "indent", "accent"];
    const out = {};
    for (const key of keys) {
        out[key] = getThemeSetting(themeId, key);
    }
    return out;
}

/** ดึง theme.json + theme.css ของธีมหนึ่ง (แคชไว้ ไม่ fetch ซ้ำ) */
async function fetchTheme(themeId) {
    if (themeCache[themeId]) return themeCache[themeId];
    const base = `${extensionFolderPath}/themes/${themeId}`;
    const [meta, css] = await Promise.all([
        $.getJSON(`${base}/theme.json`),
        $.get(`${base}/theme.css`),
    ]);
    const entry = { meta, css };
    themeCache[themeId] = entry;
    return entry;
}

/** รายชื่อ theme pack ที่ติดตั้งไว้ทั้งหมด — [{id, name}] เรียงตาม themes/index.json
 *  (แคชไว้ในตัวแปรนี้ ไม่ fetch ซ้ำ — รายการนี้ไม่เปลี่ยนระหว่าง session) */
let themeRegistryCache = null;

/** อ่าน themes/index.json แล้ว fetch theme.json ของทุกอันเพื่อเอาแค่ชื่อ
 *  (ไป fetchTheme() เต็มๆ อีกทีตอนผู้ใช้เลือกจริง — ที่นี่ขอแค่ label) */
async function fetchThemeRegistry() {
    if (themeRegistryCache) return themeRegistryCache;
    const ids = await $.getJSON(`${extensionFolderPath}/themes/index.json`);
    const entries = await Promise.all(
        ids.map(async (id) => {
            try {
                const meta = await $.getJSON(`${extensionFolderPath}/themes/${id}/theme.json`);
                return { id, name: meta.name || id };
            } catch (e) {
                console.error(`[${extensionName}] อ่าน theme.json ของ "${id}" ไม่ได้:`, e);
                return { id, name: id };
            }
        }),
    );
    themeRegistryCache = entries;
    return entries;
}

function getOrCreateStyleTag(id) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement("style");
        el.id = id;
        document.head.appendChild(el);
    }
    return el;
}

/**
 * สร้างเนื้อหาทั้งหมดของก้อน <style id="tinytheme-fonts"> — จาก
 * theme.json.fontImports (URL ของ Google Fonts เป็นต้น) + theme.json.fonts
 * (ไฟล์ .ttf ที่ประกาศ @font-face เอง)
 *
 * ลำดับสำคัญ: @import ต้องมาก่อนกฎอื่นทุกกฎในสไตล์ชีตเสมอ (ข้อจำกัดของ
 * สเปก CSS เอง — ถ้าอยู่หลัง @font-face แม้แต่บรรทัดเดียว เบราว์เซอร์จะ
 * เมิน @import ทั้งหมดเงียบๆ) จึงต้องแยกฟังก์ชันนี้ให้คุม "ก้อน fonts"
 * ทั้งก้อนตั้งแต่ import จนถึง @font-face ไม่ใช่แค่ต่อ string มาเฉยๆ
 */
function buildFontsCss(meta) {
    const parts = [];

    for (const url of meta.fontImports || []) {
        parts.push(`@import url('${url}');`);
    }

    for (const font of meta.fonts || []) {
        for (const src of font.src || []) {
            parts.push(
                `@font-face {\n` +
                `  font-family: '${font.family}';\n` +
                `  font-style: ${src.style || "normal"};\n` +
                `  font-weight: ${src.weight || 400};\n` +
                `  src: url('${src.url}') format('truetype');\n` +
                `  font-display: swap;\n` +
                `}`,
            );
        }
    }

    return parts.join("\n\n");
}

/** hex "#00CBC3" -> "0, 203, 195" (สำหรับ rgba(var(--tt-accent-rgb), .15) ) */
function hexToRgbTriplet(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

/** hex "#00CBC3" -> {r:0, g:203, b:195} (สำหรับ --SmartThemeCheckboxBgColorR/G/B) */
function hexToRgbChannels(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** สร้าง :root { --tt-*: ... } จาก mode ที่เลือก + ค่าที่ผู้ใช้ปรับ */
function buildVarsCss(themeId, meta) {
    const modeId = getThemeSetting(themeId, "mode") || meta.defaults?.mode || Object.keys(meta.modes)[0];
    const mode = meta.modes[modeId] || meta.modes[meta.defaults?.mode] || Object.values(meta.modes)[0];

    const lines = [];
    for (const [key, value] of Object.entries(mode.vars || {})) {
        lines.push(`  --tt-${key}: ${value};`);
    }

    // แยก R/G/B ของสีข้อความหลักไว้ให้ checkbox ของ SillyTavern เอง
    // คำนวณสี tick ให้ contrast ถูกต้อง (ดูคอมเมนต์ยาวใน theme.css) — ธีม
    // ส่วนใหญ่ใช้ชื่อตัวแปร "text" แต่บางธีม (เช่น line-chat ที่แยกสี UI
    // ออกจากสีบับเบิ้ล) ตั้งชื่อว่าอย่างอื่น (เช่น "ui-text") จึงให้
    // theme.json ระบุเองได้ผ่าน checkboxTextVar
    const textVarKey = meta.checkboxTextVar || "text";
    const textChannels = hexToRgbChannels(mode.vars?.[textVarKey]);
    if (textChannels) {
        lines.push(`  --tt-text-r: ${textChannels.r};`);
        lines.push(`  --tt-text-g: ${textChannels.g};`);
        lines.push(`  --tt-text-b: ${textChannels.b};`);
    }

    // สี accent ที่ผู้ใช้เลือกเอง (ถ้ามี) แทนที่ของโหมด
    const customAccent = getThemeSetting(themeId, "accent");
    if (customAccent) {
        lines.push(`  --tt-accent: ${customAccent};`);
        const rgb = hexToRgbTriplet(customAccent);
        if (rgb) lines.push(`  --tt-accent-rgb: ${rgb};`);
    }

    const proseSize = getThemeSetting(themeId, "proseSize");
    const proseFont = getThemeSetting(themeId, "proseFont");
    const lineHeight = getThemeSetting(themeId, "lineHeight");
    const columnWidth = getThemeSetting(themeId, "columnWidth");
    const indent = getThemeSetting(themeId, "indent");

    if (proseSize !== undefined) lines.push(`  --tt-prose-size: ${proseSize}px;`);
    if (proseFont !== undefined) lines.push(`  --tt-prose-font: ${proseFont};`);
    if (lineHeight !== undefined) lines.push(`  --tt-prose-line-height: ${lineHeight};`);
    if (columnWidth !== undefined) lines.push(`  --tt-column-width: ${columnWidth}px;`);
    if (indent !== undefined) lines.push(`  --tt-indent: ${indent}%;`);

    const rootBlock = `:root {\n${lines.join("\n")}\n}`;

    // CSS ที่ใช้เฉพาะโหมดนี้โหมดเดียว (เช่น rainbow ต้องมีชั้นไล่สีทับแผง
    // UI เพิ่มอีกก้อนที่โหมดอื่นไม่มี) — ต่อท้าย :root แล้วฉีดรวมไปกับ
    // ก้อน vars เดียวกัน จะได้ถูกสร้างใหม่ทุกครั้งที่สลับโหมดเหมือนกัน
    // ไม่ต้องเพิ่ม <style> ก้อนที่ 4 ให้ reorderStylesToEnd ต้องตามดูแลอีกจุด
    if (mode.extraCss) {
        return `${rootBlock}\n\n${mode.extraCss}`;
    }
    return rootBlock;
}

/**
 * บังคับโหมดแชท (Flat/Bubbles/Document) ถ้า theme.json.requires.chatDisplay
 * ระบุไว้ — บางธีม (เช่น line-chat) วาดบับเบิ้ลเองทั้งหมด ถ้าผู้ใช้ยังค้าง
 * อยู่โหมด Document จาก Thai Novel Reader หน้าตาจะพังทันที core มีฟังก์ชัน
 * applyChatDisplay() ทำแบบนี้อยู่แล้วแต่ไม่ export (ไม่มีใน power-user.js's
 * export list) จึงต้องทำเองสามบรรทัดแทน — ตรงกับพฤติกรรมจริงของฟังก์ชัน
 * นั้น (สลับ body class ตรงๆ + sync ค่า/ดรอปดาวน์ + เซฟ)
 *
 * ไม่มีกลไก "จำค่าเดิมไว้คืนตอนสลับออก" โดยตั้งใจ — ธีมที่ไม่ได้ระบุ
 * requires.chatDisplay (เช่น Thai Novel Reader) ออกแบบให้ใช้ได้ในทุกโหมด
 * แชทอยู่แล้ว จึงไม่จำเป็นต้องบังคับหรือคืนค่าอะไรเมื่อสลับมา
 */
function applyChatDisplayIfRequired(meta) {
    const required = meta.requires?.chatDisplay;
    if (required === undefined || required === null) return;

    power_user.chat_display = required;
    $("#chat_display").val(required).prop("selected", true);
    $("body").removeClass("bubblechat documentstyle");
    if (required === 1) $("body").addClass("bubblechat");
    if (required === 2) $("body").addClass("documentstyle");
    saveSettingsDebounced();
}

/** ฉีด/อัปเดต CSS 3 ก้อนตามลำดับ: fonts -> structure -> vars */
async function applyTheme(themeId) {
    const { meta, css } = await fetchTheme(themeId);
    activeThemeId = themeId;

    getOrCreateStyleTag(STYLE_IDS.fonts).textContent = buildFontsCss(meta);
    getOrCreateStyleTag(STYLE_IDS.structure).textContent = css;
    getOrCreateStyleTag(STYLE_IDS.vars).textContent = buildVarsCss(themeId, meta);
    applyChatDisplayIfRequired(meta);

    return meta;
}

/** เรียกใหม่เฉพาะก้อน vars — ใช้ตอนสลับโหมด/ปรับ slider (ไม่ fetch ซ้ำ) */
function refreshVars() {
    if (!activeThemeId || !themeCache[activeThemeId]) return;
    getOrCreateStyleTag(STYLE_IDS.vars).textContent = buildVarsCss(activeThemeId, themeCache[activeThemeId].meta);
}

/** meta ของธีมที่กำลังใช้งานอยู่ (undefined ถ้ายังไม่โหลด) */
function getActiveMeta() {
    return activeThemeId ? themeCache[activeThemeId]?.meta : undefined;
}

/**
 * เติมค่าลงฟอร์มในกล่อง panel หนึ่งกล่อง (ใช้ร่วมกันทั้ง drawer และ popup —
 * เรียกซ้ำได้หลายกล่องพร้อมกัน จึงต้องอ่าน/เขียนผ่าน jQuery scope ของ
 * $container นั้นเท่านั้น ห้ามใช้ id เพราะ id ต้องไม่ซ้ำใน DOM เดียวกัน)
 */
function populatePanel($container) {
    const meta = getActiveMeta();
    if (!meta) return;

    // เลือก theme pack (thai-novel-reader / line-chat / ...) — คนละชั้นกับ
    // "โหมดสี" ข้างล่าง (โหมดสีคือสลับพาเลตต์ *ภายใน* pack เดียวกัน) แถวนี้
    // ไม่ผ่าน controls[] allowlist เพราะเป็นตัวเลือกระดับ engine ไม่ใช่ของ
    // ธีมใดธีมหนึ่ง — ต้องโชว์เสมอไม่ว่าจะใช้ pack ไหนอยู่ก็ตาม
    if (themeRegistryCache) {
        const $packSelect = $container.find(".tinytheme-pack-select");
        $packSelect.empty();
        for (const entry of themeRegistryCache) {
            $packSelect.append(`<option value="${entry.id}">${entry.name}</option>`);
        }
        $packSelect.val(activeThemeId);
    }

    // ซ่อนแถวควบคุมที่ธีมนี้ไม่รองรับ (theme.json's controls[] เป็น allowlist)
    const allowed = new Set(meta.controls || []);
    $container.find("[data-control]").each(function () {
        const key = $(this).data("control");
        $(this).toggle(allowed.has(key));
    });

    const $modeSelect = $container.find(".tinytheme-mode-select");
    $modeSelect.empty();
    for (const [modeId, mode] of Object.entries(meta.modes)) {
        $modeSelect.append(`<option value="${modeId}">${mode.label}</option>`);
    }
    $modeSelect.val(getThemeSetting(activeThemeId, "mode"));

    const $fontSelect = $container.find(".tinytheme-font-select");
    $fontSelect.empty();
    for (const choice of meta.fontChoices || []) {
        $fontSelect.append(`<option value="${choice.value}">${choice.label}</option>`);
    }
    $fontSelect.val(getThemeSetting(activeThemeId, "proseFont"));

    const proseSize = getThemeSetting(activeThemeId, "proseSize");
    $container.find(".tinytheme-prose-size-slider").val(proseSize);
    $container.find(".tinytheme-prose-size-value").text(`${proseSize}px`);

    const lineHeight = getThemeSetting(activeThemeId, "lineHeight");
    $container.find(".tinytheme-line-height-slider").val(lineHeight);
    $container.find(".tinytheme-line-height-value").text(lineHeight);

    const columnWidth = getThemeSetting(activeThemeId, "columnWidth");
    $container.find(".tinytheme-column-width-slider").val(columnWidth);
    $container.find(".tinytheme-column-width-value").text(`${columnWidth}px`);

    const indent = getThemeSetting(activeThemeId, "indent");
    $container.find(".tinytheme-indent-slider").val(indent);
    $container.find(".tinytheme-indent-value").text(`${indent}%`);

    const accent = getThemeSetting(activeThemeId, "accent");
    const currentMode = meta.modes[getThemeSetting(activeThemeId, "mode")];
    $container.find(".tinytheme-accent-input").val(accent || currentMode?.vars?.accent || "#00CBC3");

    $container.find(".tinytheme-stat-toggle").each(function () {
        const statKey = $(this).data("stat");
        $(this).prop("checked", Boolean(getThemeSetting(activeThemeId, statKey)));
    });
}

/** เรียกทุกกล่อง panel ที่เปิดอยู่ตอนนี้ (drawer + popup ถ้าเปิดพร้อมกัน) */
function populateAllPanels() {
    $(".tinytheme-panel").each(function () {
        populatePanel($(this));
    });
}

async function mountPanel($mountPoint) {
    const html = await $.get(`${extensionFolderPath}/panel.html`);
    $mountPoint.empty().append(html);
    populatePanel($mountPoint);
}

function removeTheme() {
    for (const id of Object.values(STYLE_IDS)) {
        document.getElementById(id)?.remove();
    }
    activeThemeId = null;
}

/**
 * ผูก toggle เลขข้อความ/เวลาตอบ/โทเคน เข้ากับ power_user จริง — สามฟิลด์นี้
 * ควบคุมด้วย body class ของ SillyTavern เอง (no-timer/no-mesIDDisplay/
 * no-tokenCount) ไม่ใช่ CSS var ธรรมดา จึงต้องเรียก applyPowerUserSettings()
 * ให้ core สลับ class ให้ ไม่ใช่แค่เขียน --tt-* เฉยๆ
 */
function syncStatsToPowerUser() {
    if (!activeThemeId) return;
    power_user.mesIDDisplay_enabled = Boolean(getThemeSetting(activeThemeId, "mesIDDisplay_enabled"));
    power_user.timer_enabled = Boolean(getThemeSetting(activeThemeId, "timer_enabled"));
    power_user.message_token_count_enabled = Boolean(getThemeSetting(activeThemeId, "message_token_count_enabled"));
    applyPowerUserSettings();
    saveSettingsDebounced();
}

/**
 * ย้าย <style> ทั้ง 3 ก้อนของเราไปไว้ท้าย <head> อีกครั้ง — เพื่อให้ชนะ
 * #custom-style ของธีม SillyTavern ที่เลือกไว้เสมอ ไม่ใช่ "บังเอิญ" ตาม
 * จังหวะ fetch. appendChild บน element ที่อยู่ใน DOM แล้วคือการ "ย้าย"
 * ไม่ใช่ clone — เรียกอีกครั้งตอน APP_READY (core รับประกันว่า
 * #custom-style ถูกสร้างเสร็จก่อนหน้านั้นแล้วเสมอ) กันปัญหา extension
 * script (type="module" async) รันเสร็จก่อน/หลัง core init ไม่แน่นอน
 */
function reorderStylesToEnd() {
    for (const id of Object.values(STYLE_IDS)) {
        const el = document.getElementById(id);
        if (el) document.head.appendChild(el);
    }
}

/** เปิดใช้งาน: ฉีดธีม + เติม panel ใน drawer + โชว์ปุ่มไม้กายสิทธิ์ */
async function enableExtension() {
    const settings = ensureSettings();
    const meta = await applyTheme(settings.activeTheme);
    console.log(`[${extensionName}] Applied theme: ${settings.activeTheme} (${meta.name} v${meta.version})`);
    $(".tinytheme-hint").text(`ธีมที่ใช้อยู่: ${meta.name}`);
    $(".tinytheme-panel-mount").show();
    await mountPanel($(".tinytheme-panel-mount"));
    syncStatsToPowerUser();
    $("#tinytheme-menu-button").show();
}

/** ปิดใช้งาน: ถอน CSS ธีมทั้งหมด กลับไปหน้าตาปกติของ SillyTavern
 *  (ไม่แตะ power_user.timer_enabled ฯลฯ — ค่าพวกนั้นเป็นความชอบเรื่อง
 *  การแสดงผลข้อความทั่วไป ไม่ใช่ส่วนของธีม เก็บไว้ตามที่ผู้ใช้ตั้งล่าสุด) */
function disableExtension() {
    removeTheme();
    $(".tinytheme-hint").text("TinyTheme ปิดอยู่");
    $(".tinytheme-panel-mount").hide().empty();
    $("#tinytheme-menu-button").hide();
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings2").append(settingsHtml);
        console.log(`[${extensionName}] Settings drawer injected successfully.`);

        const settings = ensureSettings();
        $("#tinytheme-enabled").prop("checked", settings.enabled);

        // ปุ่มในเมนูไม้กายสิทธิ์ — ทางลัดเปิด panel แบบ popup โดยไม่ต้องไปหน้า Extensions
        const menuButton = $(`
            <div id="tinytheme-menu-button" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
                <div class="fa-solid fa-palette extensionsMenuExtensionButton"></div>
                <span>TinyTheme</span>
            </div>`);
        $("#extensionsMenu").append(menuButton);
        menuButton.on("click", async () => {
            const $popupContent = $('<div class="tinytheme-popup-mount"></div>');
            await mountPanel($popupContent);
            callGenericPopup($popupContent, POPUP_TYPE.TEXT, "", { okButton: "ปิด", wide: false });
        });

        // ต้องรู้ก่อนว่ามี theme pack อะไรติดตั้งอยู่บ้าง เพื่อเติมดรอปดาวน์
        // เลือก pack ใน populatePanel() ได้ — enableExtension() ข้างล่าง
        // เรียก mountPanel() ซึ่งเรียก populatePanel() ต่อ จึงต้องรอให้เสร็จก่อน
        await fetchThemeRegistry();

        if (settings.enabled) {
            await enableExtension();
        } else {
            $("#tinytheme-menu-button").hide();
            $(".tinytheme-hint").text("TinyTheme ปิดอยู่");
        }

        $(document).on("change", "#tinytheme-enabled", async function () {
            const isEnabled = $(this).prop("checked");
            const s = ensureSettings();
            s.enabled = isEnabled;
            saveSettingsDebounced();
            if (isEnabled) {
                await enableExtension();
            } else {
                disableExtension();
            }
        });

        eventSource.on(event_types.APP_READY, reorderStylesToEnd);

        // สลับ theme pack (คนละชั้นกับ .tinytheme-mode-select ข้างล่าง ซึ่ง
        // สลับแค่โหมดสี *ภายใน* pack เดียวกัน) ต้อง applyTheme() เต็มรูปแบบ
        // ใหม่ทั้งหมด — fetch theme.css/theme.json ก้อนใหม่ ไม่ใช่แค่เขียน
        // ทับก้อน vars เหมือน refreshVars() เฉยๆ
        $(document).on("change", ".tinytheme-pack-select", async function () {
            const newThemeId = $(this).val();
            const s = ensureSettings();
            s.activeTheme = newThemeId;
            saveSettingsDebounced();
            const meta = await applyTheme(newThemeId);
            $(".tinytheme-hint").text(`ธีมที่ใช้อยู่: ${meta.name}`);
            syncStatsToPowerUser();
            populateAllPanels();
        });

        // Delegated handler: ใช้ class ไม่ใช่ id เพราะ panel เดียวกันอาจถูก
        // mount ซ้ำได้หลายกล่องพร้อมกัน (drawer + popup ในอนาคต)
        $(document).on("change", ".tinytheme-mode-select", function () {
            const modeId = $(this).val();
            setThemeSetting(activeThemeId, "mode", modeId);
            refreshVars();
            populateAllPanels(); // sync ค่าให้ทุกกล่อง panel ที่เปิดอยู่พร้อมกัน
        });

        $(document).on("change", ".tinytheme-font-select", function () {
            setThemeSetting(activeThemeId, "proseFont", $(this).val());
            refreshVars();
        });

        // ใช้ "input" ไม่ใช่ "change" — ต้องเห็นผลขณะลาก slider ทันที ไม่ใช่แค่ตอนปล่อยเมาส์
        $(document).on("input", ".tinytheme-prose-size-slider", function () {
            const value = Number($(this).val());
            setThemeSetting(activeThemeId, "proseSize", value);
            refreshVars();
            $(".tinytheme-prose-size-value").text(`${value}px`);
        });

        $(document).on("input", ".tinytheme-line-height-slider", function () {
            const value = Number($(this).val());
            setThemeSetting(activeThemeId, "lineHeight", value);
            refreshVars();
            $(".tinytheme-line-height-value").text(value);
        });

        $(document).on("input", ".tinytheme-column-width-slider", function () {
            const value = Number($(this).val());
            setThemeSetting(activeThemeId, "columnWidth", value);
            refreshVars();
            $(".tinytheme-column-width-value").text(`${value}px`);
        });

        $(document).on("input", ".tinytheme-indent-slider", function () {
            const value = Number($(this).val());
            setThemeSetting(activeThemeId, "indent", value);
            refreshVars();
            $(".tinytheme-indent-value").text(`${value}%`);
        });

        $(document).on("click", ".tinytheme-reset-all", function () {
            const s = ensureSettings();
            s.perTheme[activeThemeId] = {};
            saveSettingsDebounced();
            refreshVars();
            populateAllPanels();
            syncStatsToPowerUser();
            toastr.info("รีเซ็ตค่าปรับแต่งเป็นค่าเริ่มต้นของธีมแล้ว");
        });

        $(document).on("input", ".tinytheme-accent-input", function () {
            setThemeSetting(activeThemeId, "accent", $(this).val());
            refreshVars();
        });

        $(document).on("click", ".tinytheme-accent-reset", function () {
            setThemeSetting(activeThemeId, "accent", null);
            refreshVars();
            populateAllPanels(); // เติมช่องสีกลับเป็นของโหมดปัจจุบัน
        });

        $(document).on("change", ".tinytheme-stat-toggle", function () {
            const statKey = $(this).data("stat");
            setThemeSetting(activeThemeId, statKey, $(this).prop("checked"));
            syncStatsToPowerUser();
        });

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: "tinytheme",
            callback: async (namedArgs) => {
                const meta = getActiveMeta();
                if (!meta) return "";
                if (namedArgs.mode) {
                    const modeId = String(namedArgs.mode).toLowerCase();
                    if (!meta.modes[modeId]) {
                        toastr.warning(`ไม่พบโหมดสีชื่อ "${namedArgs.mode}"`);
                    } else {
                        setThemeSetting(activeThemeId, "mode", modeId);
                    }
                }
                if (namedArgs.size) {
                    setThemeSetting(activeThemeId, "proseSize", Number(namedArgs.size));
                }
                refreshVars();
                populateAllPanels();
                return "";
            },
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: "mode",
                    description: "โหมดสี (ชื่อ id เช่น normal, sepia, night, dark)",
                    typeList: [ARGUMENT_TYPE.STRING],
                    enumProvider: () => {
                        const meta = getActiveMeta();
                        if (!meta) return [];
                        return Object.keys(meta.modes).map((id) => new SlashCommandEnumValue(id));
                    },
                }),
                SlashCommandNamedArgument.fromProps({
                    name: "size",
                    description: "ขนาดตัวอักษรเนื้อเรื่อง (px)",
                    typeList: [ARGUMENT_TYPE.NUMBER],
                }),
            ],
            helpString: "ปรับโหมดสี/ขนาดตัวอักษรของ TinyTheme เช่น /tinytheme mode=dark size=22",
        }));
    } catch (error) {
        console.error(`[${extensionName}] Failed to initialize:`, error);
    }
});
