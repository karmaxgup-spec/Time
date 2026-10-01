// Time Dividers - adds "---9:15 AM---" style headers to the prompt, once per time block.
// Only affects the prompt sent to the model. Your saved chat is never modified.

const MODULE = 'time_dividers';
const defaults = Object.freeze({
    enabled: true,
    intervalMinutes: 15, // a new divider appears when a message lands in a new block of this length
    includeDate: true,   // show the date too when the day changes: "---Oct 1, 9:15 AM---"
});

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE]) extensionSettings[MODULE] = structuredClone(defaults);
    for (const k of Object.keys(defaults)) {
        if (!Object.hasOwn(extensionSettings[MODULE], k)) extensionSettings[MODULE][k] = defaults[k];
    }
    return extensionSettings[MODULE];
}

function parseDate(sendDate) {
    if (!sendDate) return null;
    const moment = SillyTavern.libs.moment;
    let m = moment(sendDate, moment.ISO_8601, true);
    if (!m.isValid()) m = moment(new Date(sendDate));
    if (!m.isValid()) m = moment(sendDate, 'LL LT'); // older ST format: "September 30, 2026 9:15pm"
    return m.isValid() ? m : null;
}

globalThis.timeDividersInterceptor = async function (chat, _contextSize, _abort, _type) {
    const settings = getSettings();
    if (!settings.enabled) return;

    const interval = Math.max(1, Number(settings.intervalMinutes) || 15);
    let lastBlockKey = null;
    let lastDay = null;

    for (let i = 0; i < chat.length; i++) {
        const msg = chat[i];
        const m = parseDate(msg.send_date);
        if (!m) continue;

        const dayKey = m.format('YYYY-MM-DD');
        const block = Math.floor((m.hours() * 60 + m.minutes()) / interval);
        const blockKey = `${dayKey} ${block}`;
        if (blockKey === lastBlockKey) continue;

        const dayChanged = lastDay !== null && dayKey !== lastDay;
        const timeFmt = interval >= 60 ? 'h A' : 'h:mm A';
        const label = (settings.includeDate && dayChanged)
            ? m.format(`MMM D, ${timeFmt}`)
            : m.format(timeFmt);

        // Copy the message so the real chat history is untouched
        chat[i] = { ...msg, mes: `---${label}---\n${msg.mes}` };

        lastBlockKey = blockKey;
        lastDay = dayKey;
    }
};

(function initUI() {
    const settings = getSettings();
    const html = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>Time Dividers</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content">
        <label class="checkbox_label"><input type="checkbox" id="td_enabled"> <span>Enabled</span></label>
        <label class="checkbox_label"><input type="checkbox" id="td_date"> <span>Show date when the day changes</span></label>
        <label for="td_interval">Divider every (minutes)</label>
        <input type="number" id="td_interval" class="text_pole" min="1" max="1440" step="1">
      </div>
    </div>`;
    const target = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!target) return;
    target.insertAdjacentHTML('beforeend', html);
    const save = () => SillyTavern.getContext().saveSettingsDebounced();
    const en = document.getElementById('td_enabled');
    const dt = document.getElementById('td_date');
    const iv = document.getElementById('td_interval');
    en.checked = settings.enabled;
    dt.checked = settings.includeDate;
    iv.value = settings.intervalMinutes;
    en.addEventListener('change', () => { settings.enabled = en.checked; save(); });
    dt.addEventListener('change', () => { settings.includeDate = dt.checked; save(); });
    iv.addEventListener('input', () => { settings.intervalMinutes = Math.max(1, Number(iv.value) || 15); save(); });
})();
