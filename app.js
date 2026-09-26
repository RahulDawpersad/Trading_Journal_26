(function () {
    "use strict";

    var THEME_KEY = "ledger_theme_v1";

    // ---------------------------------------------------------------
    // 1) Paste your Supabase project values here (Project Settings → API)
    // ---------------------------------------------------------------
    var SUPABASE_URL = "https://sfleuericmdcscswneoe.supabase.co";
    var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmbGV1ZXJpY21kY3Njc3duZW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MTM2MTYsImV4cCI6MjEwNTk4OTYxNn0.27rmp-b4NauUeVRzJ7QtQh3K9k3gimvaHjQkr2WaI-M";

    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    var currentUser = null;
    var channel = null;

    var state = { trades: [], transactions: [], audit: [] };

    async function fetchAll() {
        var uidNow = currentUser.id;
        var tRes = await sb.from("trades").select("*").eq("user_id", uidNow).order("date", { ascending: false });
        var xRes = await sb.from("transactions").select("*").eq("user_id", uidNow).order("date", { ascending: false });
        var aRes = await sb.from("audit_log").select("*").eq("user_id", uidNow).order("created_at", { ascending: false }).limit(200);
        if (tRes.error) console.error(tRes.error); else state.trades = tRes.data.map(normalizeTrade);
        if (xRes.error) console.error(xRes.error); else state.transactions = xRes.data.map(normalizeTx);
        if (aRes.error) console.error(aRes.error); else state.audit = aRes.data;
    }
    function normalizeTrade(row) {
        return {
            id: row.id, symbol: row.symbol, direction: row.direction, date: row.date,
            entry: row.entry, lot: row.lot, sl: row.sl, tp: row.tp, pl: Number(row.pl), reason: row.reason
        };
    }
    function normalizeTx(row) {
        return { id: row.id, type: row.type, amount: Number(row.amount), date: row.date, note: row.note };
    }

    var fmt = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 });
    function money(n) {
        n = Number(n) || 0;
        var s = fmt.format(Math.abs(n)).replace("ZAR", "R").replace("R\u00A0", "R ");
        return (n < 0 ? "-" : "") + s;
    }

    function moneyCompact(n) {
        n = Number(n) || 0;
        var abs = Math.abs(n);
        var s;
        if (abs >= 10000) s = "R" + Math.round(abs / 1000) + "k";
        else if (abs >= 1000) s = "R" + (abs / 1000).toFixed(1).replace(/\.0$/, "") + "k";
        else s = "R" + Math.round(abs);
        return (n < 0 ? "-" : "") + s;
    }

    function toast(msg) {
        var t = document.getElementById("toast");
        t.textContent = msg;
        t.classList.add("show");
        clearTimeout(toast._h);
        toast._h = setTimeout(function () { t.classList.remove("show"); }, 1800);
    }

    /* ---------- Theme ---------- */
    var root = document.documentElement;
    var themeIcon = document.getElementById("themeIcon");
    function systemPrefersDark() {
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    function applyTheme(mode) {
        if (mode === "dark") { root.setAttribute("data-theme", "dark"); themeIcon.textContent = "☾"; }
        else { root.setAttribute("data-theme", "light"); themeIcon.textContent = "☀︎"; }
    }
    function isDarkActive() { return root.getAttribute("data-theme") === "dark"; }
    (function initTheme() {
        var saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch (e) { }
        if (saved === "dark" || saved === "light") applyTheme(saved);
        else applyTheme(systemPrefersDark() ? "dark" : "light");
    })();
    document.getElementById("themeToggle").addEventListener("click", function () {
        var next = isDarkActive() ? "light" : "dark";
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { }
    });

    /* ---------- Client tag persistence ---------- */
    var clientTagEl = document.getElementById("clientTag");
    (function initClientTag() {
        try {
            var saved = localStorage.getItem("ledger_client_tag");
            if (saved) clientTagEl.textContent = saved;
        } catch (e) { }
    })();
    clientTagEl.addEventListener("blur", function () {
        try { localStorage.setItem("ledger_client_tag", clientTagEl.textContent.trim()); } catch (e) { }
    });

    /* ---------- Tabs ---------- */
    var tabButtons = document.querySelectorAll("nav.tabs button");
    tabButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            tabButtons.forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("active"); });
            document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
        });
    });

    /* ---------- Modals ---------- */
    function openOverlay(id) { document.getElementById(id).classList.add("open"); }
    function closeOverlay(id) { document.getElementById(id).classList.remove("open"); }
    document.querySelectorAll("[data-close]").forEach(function (b) {
        b.addEventListener("click", function () { b.closest(".overlay").classList.remove("open"); });
    });
    document.querySelectorAll(".overlay").forEach(function (ov) {
        ov.addEventListener("click", function (e) { if (e.target === ov) ov.classList.remove("open"); });
    });

    function wireSeg(segId, activeClassMap) {
        var seg = document.getElementById(segId);
        seg.querySelectorAll("button").forEach(function (btn) {
            btn.addEventListener("click", function () {
                seg.querySelectorAll("button").forEach(function (b) {
                    b.classList.remove("on");
                    Object.values(activeClassMap).forEach(function (c) { b.classList.remove(c); });
                });
                btn.classList.add("on");
                var cls = activeClassMap[btn.dataset.val];
                if (cls) btn.classList.add(cls);
                seg.dataset.value = btn.dataset.val;
            });
        });
        seg.dataset.value = seg.querySelector(".on").dataset.val;
    }
    wireSeg("dirSeg", { buy: "buy", sell: "sell" });
    wireSeg("txSeg", { deposit: "dep", withdrawal: "wd" });

    function todayISO() {
        var d = new Date();
        var tz = d.getTimezoneOffset() * 60000;
        return new Date(d - tz).toISOString().slice(0, 10);
    }

    /* ---------- Trade form ---------- */
    var tradeOverlay = "tradeOverlay";
    function resetTradeForm() {
        document.getElementById("tradeId").value = "";
        document.getElementById("tradeModalTitle").textContent = "Log a trade";
        document.getElementById("tSymbol").value = "";
        document.getElementById("tDate").value = todayISO();
        document.getElementById("tEntry").value = "";
        document.getElementById("tLot").value = "";
        document.getElementById("tSL").value = "";
        document.getElementById("tTP").value = "";
        document.getElementById("tPL").value = "";
        document.getElementById("tReason").value = "";
        var seg = document.getElementById("dirSeg");
        seg.querySelectorAll("button").forEach(function (b) { b.classList.remove("on", "buy", "sell"); });
        var buyBtn = seg.querySelector('[data-val="buy"]');
        buyBtn.classList.add("on", "buy");
        seg.dataset.value = "buy";
    }
    document.getElementById("openTradeBtn").addEventListener("click", function () {
        resetTradeForm(); openOverlay(tradeOverlay);
    });
    document.querySelectorAll('[data-open="trade"]').forEach(function (b) {
        b.addEventListener("click", function () { resetTradeForm(); openOverlay(tradeOverlay); });
    });

    document.getElementById("saveTradeBtn").addEventListener("click", async function () {
        var symbol = document.getElementById("tSymbol").value.trim();
        var pl = document.getElementById("tPL").value;
        if (!symbol) { toast("Add a symbol first"); return; }
        if (pl === "") { toast("Add a P/L result"); return; }
        var existingId = document.getElementById("tradeId").value;
        var payload = {
            symbol: symbol,
            direction: document.getElementById("dirSeg").dataset.value,
            date: document.getElementById("tDate").value || todayISO(),
            entry: document.getElementById("tEntry").value || null,
            lot: document.getElementById("tLot").value || null,
            sl: document.getElementById("tSL").value || null,
            tp: document.getElementById("tTP").value || null,
            pl: Number(pl),
            reason: document.getElementById("tReason").value.trim() || null
        };
        var res;
        if (existingId) {
            res = await sb.from("trades").update(payload).eq("id", existingId).select();
        } else {
            payload.user_id = currentUser.id;
            res = await sb.from("trades").insert(payload).select();
        }
        if (res.error) { toast("Couldn't save: " + res.error.message); return; }
        closeOverlay(tradeOverlay);
        toast(existingId ? "Trade updated" : "Trade logged");
        await fetchAll();
        renderAll();
    });

    function editTrade(id) {
        var t = state.trades.find(function (x) { return x.id === id; });
        if (!t) return;
        document.getElementById("tradeId").value = t.id;
        document.getElementById("tradeModalTitle").textContent = "Edit trade";
        document.getElementById("tSymbol").value = t.symbol;
        document.getElementById("tDate").value = t.date;
        document.getElementById("tEntry").value = t.entry;
        document.getElementById("tLot").value = t.lot;
        document.getElementById("tSL").value = t.sl;
        document.getElementById("tTP").value = t.tp;
        document.getElementById("tPL").value = t.pl;
        document.getElementById("tReason").value = t.reason;
        var seg = document.getElementById("dirSeg");
        seg.querySelectorAll("button").forEach(function (b) {
            b.classList.remove("on", "buy", "sell");
            if (b.dataset.val === t.direction) b.classList.add("on", t.direction);
        });
        seg.dataset.value = t.direction;
        openOverlay(tradeOverlay);
    }
    async function deleteTrade(id) {
        if (!confirm("Delete this trade?")) return;
        var res = await sb.from("trades").delete().eq("id", id);
        if (res.error) { toast("Couldn't delete: " + res.error.message); return; }
        await fetchAll();
        renderAll();
        toast("Trade deleted");
    }

    /* ---------- Transaction form ---------- */
    var txOverlay = "txOverlay";
    function resetTxForm() {
        document.getElementById("xAmount").value = "";
        document.getElementById("xDate").value = todayISO();
        document.getElementById("xNote").value = "";
        var seg = document.getElementById("txSeg");
        seg.querySelectorAll("button").forEach(function (b) { b.classList.remove("on", "dep", "wd"); });
        seg.querySelector('[data-val="deposit"]').classList.add("on", "dep");
        seg.dataset.value = "deposit";
    }
    document.querySelectorAll('[data-open="tx"]').forEach(function (b) {
        b.addEventListener("click", function () { resetTxForm(); openOverlay(txOverlay); });
    });
    document.getElementById("saveTxBtn").addEventListener("click", async function () {
        var amt = Number(document.getElementById("xAmount").value);
        if (!amt || amt <= 0) { toast("Enter an amount"); return; }
        var res = await sb.from("transactions").insert({
            user_id: currentUser.id,
            type: document.getElementById("txSeg").dataset.value,
            amount: amt,
            date: document.getElementById("xDate").value || todayISO(),
            note: document.getElementById("xNote").value.trim() || null
        }).select();
        if (res.error) { toast("Couldn't save: " + res.error.message); return; }
        closeOverlay(txOverlay);
        toast("Transaction saved");
        await fetchAll();
        renderAll();
    });
    async function deleteTx(id) {
        if (!confirm("Delete this transaction?")) return;
        var res = await sb.from("transactions").delete().eq("id", id);
        if (res.error) { toast("Couldn't delete: " + res.error.message); return; }
        await fetchAll();
        renderAll();
        toast("Transaction deleted");
    }

    /* ---------- Export ---------- */
    document.getElementById("exportBtn").addEventListener("click", function () {
        var rows = [["Date", "Symbol", "Direction", "Entry", "SL", "TP", "Lot", "P/L (R)", "Reason"]];
        state.trades.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (t) {
            rows.push([t.date, t.symbol, t.direction, t.entry, t.sl, t.tp, t.lot, t.pl, '"' + (t.reason || "").replace(/"/g, '""') + '"']);
        });
        var csv = rows.map(function (r) { return r.join(","); }).join("\n");
        var blob = new Blob([csv], { type: "text/csv" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "trading-journal-export.csv";
        a.click();
        toast("Export downloaded");
    });

    /* ---------- Stats ---------- */
    function computeStats() {
        var totalPL = state.trades.reduce(function (s, t) { return s + Number(t.pl || 0); }, 0);
        var deposits = state.transactions.filter(function (t) { return t.type === "deposit"; }).reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);
        var withdrawals = state.transactions.filter(function (t) { return t.type === "withdrawal"; }).reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);
        var wins = state.trades.filter(function (t) { return Number(t.pl) > 0; }).length;
        var losses = state.trades.filter(function (t) { return Number(t.pl) < 0; }).length;
        var winRate = state.trades.length ? Math.round((wins / state.trades.length) * 100) : 0;
        var balance = deposits - withdrawals + totalPL;
        return { totalPL: totalPL, deposits: deposits, withdrawals: withdrawals, wins: wins, losses: losses, winRate: winRate, balance: balance };
    }

    function renderStats() {
        var s = computeStats();
        document.getElementById("statBalance").textContent = money(s.balance);
        var plEl = document.getElementById("statPL");
        plEl.textContent = money(s.totalPL);
        plEl.className = "value mono " + (s.totalPL > 0 ? "profit" : s.totalPL < 0 ? "loss" : "");
        document.getElementById("statPLcount").textContent = state.trades.length + " trade" + (state.trades.length === 1 ? "" : "s") + " logged";
        document.getElementById("statWinRate").textContent = s.winRate + "%";
        document.getElementById("statWinCount").textContent = s.wins + "W · " + s.losses + "L";
        document.getElementById("statDeposits").textContent = money(s.deposits);
        document.getElementById("statWithdrawals").textContent = money(s.withdrawals);
    }

    /* ---------- Trades table ---------- */
    function renderTrades() {
        var wrap = document.getElementById("tradesTableWrap");
        if (!state.trades.length) {
            wrap.innerHTML = '<div class="empty-state"><div class="glyph">◈</div><h3>No trades yet</h3><p>Log your first trade to start building the journal.</p></div>';
            return;
        }
        var sorted = state.trades.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
        var html = '<table><thead><tr>' +
            '<th>Date</th><th>Symbol</th><th>Dir</th><th>Entry</th><th>SL</th><th>TP</th><th>Lot</th><th>P/L</th><th>Reason</th><th></th>' +
            '</tr></thead><tbody>';
        sorted.forEach(function (t) {
            html += '<tr>' +
                '<td data-label="Date">' + t.date + '</td>' +
                '<td data-label="Symbol"><b>' + escapeHtml(t.symbol) + '</b></td>' +
                '<td data-label="Direction"><span class="dir-tag ' + t.direction + '">' + t.direction + '</span></td>' +
                '<td data-label="Entry" class="mono">' + (t.entry || "—") + '</td>' +
                '<td data-label="SL" class="mono">' + (t.sl || "—") + '</td>' +
                '<td data-label="TP" class="mono">' + (t.tp || "—") + '</td>' +
                '<td data-label="Lot" class="mono">' + (t.lot || "—") + '</td>' +
                '<td data-label="P/L" class="mono amt ' + (t.pl > 0 ? "profit" : t.pl < 0 ? "loss" : "") + '">' + money(t.pl) + '</td>' +
                '<td data-label="Reason" class="reason">' + (escapeHtml(t.reason) || "—") + '</td>' +
                '<td class="row-actions"><button data-edit="' + t.id + '" title="Edit">✎</button><button data-del="' + t.id + '" title="Delete">✕</button></td>' +
                '</tr>';
        });
        html += '</tbody></table>';
        wrap.innerHTML = html;
        wrap.querySelectorAll("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { editTrade(b.dataset.edit); }); });
        wrap.querySelectorAll("[data-del]").forEach(function (b) { b.addEventListener("click", function () { deleteTrade(b.dataset.del); }); });
    }

    function escapeHtml(s) {
        if (!s) return "";
        return s.replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    /* ---------- Transactions list ---------- */
    function renderTx() {
        var list = document.getElementById("txList");
        if (!state.transactions.length) {
            list.innerHTML = '<div class="empty-state"><div class="glyph">◈</div><h3>No transactions yet</h3><p>Record a deposit or withdrawal to track account funding.</p></div>';
            return;
        }
        var sorted = state.transactions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
        list.innerHTML = sorted.map(function (t) {
            var isDep = t.type === "deposit";
            return '<div class="tx-row">' +
                '<div class="tx-left">' +
                '<div class="tx-icon ' + (isDep ? "dep" : "wd") + '">' + (isDep ? "↓" : "↑") + '</div>' +
                '<div><div>' + (isDep ? "Deposit" : "Withdrawal") + (t.note ? ' <span class="tx-note">— ' + escapeHtml(t.note) + '</span>' : '') + '</div>' +
                '<div class="tx-date">' + t.date + '</div></div>' +
                '</div>' +
                '<div style="display:flex; align-items:center; gap:12px;">' +
                '<div class="tx-amt ' + (isDep ? "profit" : "loss") + '">' + (isDep ? "+" : "-") + money(t.amount).replace("-", "") + '</div>' +
                '<button data-txdel="' + t.id + '" class="btn ghost" style="padding:6px 8px;" title="Delete">✕</button>' +
                '</div>' +
                '</div>';
        }).join("");
        list.querySelectorAll("[data-txdel]").forEach(function (b) { b.addEventListener("click", function () { deleteTx(b.dataset.txdel); }); });
    }

    /* ---------- Calendar shared helpers ---------- */
    var calDate = new Date();
    calDate.setDate(1);
    var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var selectedWeekStart = null;

    function initDow() {
        document.getElementById("calDow").innerHTML = DOW.map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join("");
    }

    function tradesByDate() {
        var map = {};
        state.trades.forEach(function (t) {
            if (!map[t.date]) map[t.date] = [];
            map[t.date].push(t);
        });
        return map;
    }
    function txByDate() {
        var map = {};
        state.transactions.forEach(function (t) {
            if (!map[t.date]) map[t.date] = [];
            map[t.date].push(t);
        });
        return map;
    }
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function isoDate(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }
    function getMondayOf(date) {
        var d = new Date(date);
        d.setHours(0, 0, 0, 0);
        var day = d.getDay();
        var diff = (day === 0 ? -6 : 1 - day);
        d.setDate(d.getDate() + diff);
        return d;
    }
    function isMobileView() {
        return window.matchMedia("(max-width: 760px)").matches;
    }

    function renderCalendar() {
        var year = calDate.getFullYear(), month = calDate.getMonth();
        document.getElementById("calMonthLabel").textContent =
            calDate.toLocaleString("en-ZA", { month: "long", year: "numeric" });

        if (isMobileView()) {
            renderWeekStrip(year, month);
        } else {
            renderMonthGrid(year, month);
        }
    }

    /* ---------- Desktop month grid ---------- */
    function renderMonthGrid(year, month) {
        var firstDay = new Date(year, month, 1);
        var startOffset = (firstDay.getDay() + 6) % 7;
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var byDate = tradesByDate();
        var txDate = txByDate();
        var todayStr = todayISO();

        var cells = [];
        for (var i = 0; i < startOffset; i++) cells.push('<div class="cal-cell pad"></div>');

        for (var d = 1; d <= daysInMonth; d++) {
            var dateStr = year + "-" + pad(month + 1) + "-" + pad(d);
            var dayTrades = byDate[dateStr] || [];
            var dayTx = txDate[dateStr] || [];
            var dayPL = dayTrades.reduce(function (s, t) { return s + Number(t.pl || 0); }, 0);
            var depSum = dayTx.filter(function (t) { return t.type === "deposit"; }).reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);
            var wdSum = dayTx.filter(function (t) { return t.type === "withdrawal"; }).reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);
            var hasTrades = dayTrades.length > 0;
            var hasTx = dayTx.length > 0;
            var cls = "cal-cell";
            if (hasTrades) cls += dayPL >= 0 ? " win has-trades" : " loss has-trades";
            else if (hasTx) cls += " activity-only has-trades";
            if (dateStr === todayStr) cls += " today";

            var txChips = "";
            var txDots = "";
            if (hasTx) {
                txChips = '<div class="tx-row">';
                if (depSum > 0) txChips += '<span class="tx-chip dep">+' + money(depSum) + '</span>';
                if (wdSum > 0) txChips += '<span class="tx-chip wd">-' + money(wdSum) + '</span>';
                txChips += '</div>';

                txDots = '<div class="tx-dots">';
                if (depSum > 0) txDots += '<span class="tx-dot dep" title="Deposit +' + money(depSum) + '"></span>';
                if (wdSum > 0) txDots += '<span class="tx-dot wd" title="Withdrawal -' + money(wdSum) + '"></span>';
                txDots += '</div>';
            }

            var titleAttr = hasTrades
                ? (' title="P/L: ' + money(dayPL) + ' · ' + dayTrades.length + ' trade' + (dayTrades.length === 1 ? "" : "s") + '"')
                : '';

            cells.push(
                '<div class="' + cls + '" data-date="' + dateStr + '"' + titleAttr + '>' +
                '<div class="d-num">' + d + '</div>' +
                (hasTrades
                    ? '<div class="d-pl mono ' + (dayPL >= 0 ? "profit" : "loss") + '">' + moneyCompact(dayPL) + '</div><div class="d-meta">' + dayTrades.length + ' trade' + (dayTrades.length === 1 ? "" : "s") + '</div>'
                    : '<div></div>') +
                txChips + txDots +
                '</div>'
            );
        }
        var totalCells = startOffset + daysInMonth;
        var trailing = (7 - (totalCells % 7)) % 7;
        for (var j = 0; j < trailing; j++) cells.push('<div class="cal-cell pad"></div>');

        var grid = document.getElementById("calGrid");
        grid.innerHTML = cells.join("");
        grid.querySelectorAll(".has-trades").forEach(function (cell) {
            cell.addEventListener("click", function () { openDayDetail(cell.dataset.date); });
        });
    }

    /* ---------- Mobile sliding week swiper ---------- */
    var swipeMoved = false;        // suppress click after a drag
    var swipeAnimating = false;    // ignore new touches during the settle animation

    function renderWeekStrip(year, month) {
        var byDate = tradesByDate();
        var txDate = txByDate();
        var todayStr = todayISO();

        if (!selectedWeekStart) {
            selectedWeekStart = getMondayOf(new Date(year, month, 1));
        }

        var track = document.getElementById("weekTrack");

        var prevMon = new Date(selectedWeekStart); prevMon.setDate(prevMon.getDate() - 7);
        var nextMon = new Date(selectedWeekStart); nextMon.setDate(nextMon.getDate() + 7);

        track.innerHTML =
            buildWeekPageHtml(prevMon, byDate, txDate, todayStr) +
            buildWeekPageHtml(selectedWeekStart, byDate, txDate, todayStr) +
            buildWeekPageHtml(nextMon, byDate, txDate, todayStr);

        // Reset to centre page without animation
        track.classList.remove("animate");
        track.style.transform = "translateX(-33.3333%)";

        // Bind day clicks on all three pages
        track.querySelectorAll(".week-day").forEach(function (btn) {
            btn.addEventListener("click", function () {
                if (swipeMoved || swipeAnimating) return;
                track.querySelectorAll(".week-day").forEach(function (b) { b.classList.remove("selected"); });
                btn.classList.add("selected");
                renderWeekDetail(btn.dataset.date);
            });
        });

        // Auto-select: today if in centre week, else first active, else Monday
        var todayInWeek = null;
        var firstActive = null;
        for (var k = 0; k < 7; k++) {
            var dt2 = new Date(selectedWeekStart);
            dt2.setDate(dt2.getDate() + k);
            var ds = isoDate(dt2);
            if (ds === todayStr) todayInWeek = ds;
            if (!firstActive && ((byDate[ds] || []).length || (txDate[ds] || []).length)) firstActive = ds;
        }
        var selected = todayInWeek || firstActive || isoDate(selectedWeekStart);

        track.querySelectorAll('.week-day[data-date="' + selected + '"]').forEach(function (btn) {
            btn.classList.add("selected");
        });

        renderWeekDetail(selected);
    }

    function buildWeekPageHtml(monday, byDate, txDate, todayStr) {
        // Relative bar scale within this week
        var maxAbs = 0;
        for (var i = 0; i < 7; i++) {
            var dt = new Date(monday); dt.setDate(dt.getDate() + i);
            var key = isoDate(dt);
            var pl = (byDate[key] || []).reduce(function (s, t) { return s + Number(t.pl || 0); }, 0);
            if (Math.abs(pl) > maxAbs) maxAbs = Math.abs(pl);
        }
        if (maxAbs === 0) maxAbs = 1;

        var cells = [];
        for (var i = 0; i < 7; i++) {
            var dt = new Date(monday); dt.setDate(dt.getDate() + i);
            var dateStr = isoDate(dt);
            var dayTrades = byDate[dateStr] || [];
            var dayTx = txDate[dateStr] || [];
            var dayPL = dayTrades.reduce(function (s, t) { return s + Number(t.pl || 0); }, 0);
            var hasTx = dayTx.length > 0;
            var isToday = dateStr === todayStr;

            var barH = 4;
            if (dayTrades.length) barH = 4 + Math.round((Math.abs(dayPL) / maxAbs) * 24);
            var barClass = dayTrades.length
                ? (dayPL >= 0 ? "profit" : "loss")
                : (hasTx ? "tx" : "");

            cells.push(
                '<button type="button" class="week-day' + (isToday ? " today" : "") +
                '" data-date="' + dateStr + '">' +
                '<span class="wd-dow">' + DOW[i] + '</span>' +
                '<span class="wd-num">' + dt.getDate() + '</span>' +
                '<span class="wd-bar ' + barClass + '" style="height:' + barH + 'px"></span>' +
                (hasTx ? '<span class="wd-tx-dot"></span>' : '') +
                '</button>'
            );
        }
        return '<div class="week-page">' + cells.join("") + '</div>';
    }

    function renderWeekDetail(dateStr) {
        var byDate = tradesByDate();
        var txDate = txByDate();
        var dayTrades = byDate[dateStr] || [];
        var dayTx = txDate[dateStr] || [];

        var dObj = new Date(dateStr + "T00:00:00");
        var dateLabel = dObj.toLocaleDateString("en-ZA", {
            weekday: "long", day: "numeric", month: "long"
        });

        var dayPL = dayTrades.reduce(function (s, t) { return s + Number(t.pl || 0); }, 0);

        var html = '<div class="wd-head">' +
            '<span class="wd-date">' + dateLabel + '</span>' +
            (dayTrades.length
                ? '<span class="wd-total mono ' + (dayPL >= 0 ? "profit" : "loss") + '">' + money(dayPL) + '</span>'
                : '') +
            '</div>';

        if (!dayTrades.length && !dayTx.length) {
            html += '<div class="wd-empty">No activity on this day.</div>';
        } else {
            if (dayTx.length) {
                html += '<div class="wd-section-label">Transactions</div>';
                html += dayTx.map(function (t) {
                    var isDep = t.type === "deposit";
                    return '<div class="wd-row">' +
                        '<div class="wd-left">' +
                        '<div class="wd-title">' + (isDep ? "Deposit" : "Withdrawal") + '</div>' +
                        (t.note ? '<div class="wd-meta">' + escapeHtml(t.note) + '</div>' : '') +
                        '</div>' +
                        '<div class="wd-amt mono ' + (isDep ? "profit" : "loss") + '">' +
                        (isDep ? "+" : "-") + money(t.amount).replace("-", "") +
                        '</div>' +
                        '</div>';
                }).join("");
            }
            if (dayTrades.length) {
                html += '<div class="wd-section-label">Trades</div>';
                html += dayTrades.map(function (t) {
                    return '<div class="wd-row">' +
                        '<div class="wd-left">' +
                        '<div class="wd-title">' + escapeHtml(t.symbol) +
                        ' <span class="dir-tag ' + t.direction + '" style="font-size:9.5px;padding:1px 6px;">' + t.direction + '</span></div>' +
                        '<div class="wd-meta">entry ' + (t.entry || "—") + ' · lot ' + (t.lot || "—") +
                        (t.reason ? ' · ' + escapeHtml(t.reason) : '') + '</div>' +
                        '</div>' +
                        '<div class="wd-amt mono ' + (t.pl >= 0 ? "profit" : "loss") + '">' + money(t.pl) + '</div>' +
                        '</div>';
                }).join("");
            }
        }

        document.getElementById("weekDetail").innerHTML = html;
    }

    /* Commit a week change after the slide finishes */
    function commitWeekChange(direction) {
        // direction: -1 = previous week, +1 = next week
        selectedWeekStart = new Date(selectedWeekStart);
        selectedWeekStart.setDate(selectedWeekStart.getDate() + (direction * 7));
        calDate = new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), 1);

        document.getElementById("calMonthLabel").textContent =
            calDate.toLocaleString("en-ZA", { month: "long", year: "numeric" });

        renderWeekStrip(calDate.getFullYear(), calDate.getMonth());
        swipeAnimating = false;
    }

    /* Touch / pointer drag handling on the swiper */
    (function wireSwipe() {
        var swiper = document.getElementById("weekSwiper");
        var track = document.getElementById("weekTrack");

        var startX = 0, startY = 0, startTime = 0, lastX = 0;
        var swiperWidth = 0;
        var dragging = false;
        var decided = false;
        var currentOffsetPx = 0;

        function getSwiperWidth() {
            return swiper.getBoundingClientRect().width;
        }

        function onStart(e) {
            if (!isMobileView()) return;
            if (swipeAnimating) return;
            var t = e.touches ? e.touches[0] : e;
            startX = t.clientX;
            startY = t.clientY;
            lastX = startX;
            startTime = Date.now();
            swiperWidth = getSwiperWidth();
            currentOffsetPx = 0;
            dragging = true;
            decided = false;
            swipeMoved = false;
            track.classList.remove("animate");
        }

        function onMove(e) {
            if (!dragging) return;
            var t = e.touches ? e.touches[0] : e;
            var dx = t.clientX - startX;
            var dy = t.clientY - startY;

            if (!decided) {
                if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
                if (Math.abs(dy) > Math.abs(dx)) {
                    // vertical scroll — hand off to browser
                    dragging = false;
                    return;
                }
                decided = true;
            }

            if (e.cancelable) e.preventDefault();
            swipeMoved = true;

            lastX = t.clientX;
            currentOffsetPx = dx;

            // Rubber-band beyond one full page
            var onePage = swiperWidth;
            if (currentOffsetPx > onePage) {
                currentOffsetPx = onePage + (currentOffsetPx - onePage) * 0.3;
            } else if (currentOffsetPx < -onePage) {
                currentOffsetPx = -onePage + (currentOffsetPx + onePage) * 0.3;
            }

            // Centre page sits at -swiperWidth px
            var finalPx = -swiperWidth + currentOffsetPx;
            track.style.transform = "translateX(" + finalPx + "px)";
        }

        function onEnd() {
            if (!dragging) return;
            dragging = false;
            if (!decided) { swipeMoved = false; return; }

            var swiperW = swiperWidth || getSwiperWidth();
            var threshold = swiperW * 0.22;
            var velocityThreshold = 0.45;
            var dt = Date.now() - startTime;
            var pxPerMs = Math.abs(currentOffsetPx) / Math.max(dt, 1);

            var direction = 0;
            if (currentOffsetPx < -threshold || (currentOffsetPx < -20 && pxPerMs > velocityThreshold)) {
                direction = 1;   // next week
            } else if (currentOffsetPx > threshold || (currentOffsetPx > 20 && pxPerMs > velocityThreshold)) {
                direction = -1;  // previous week
            }

            swipeAnimating = true;
            track.classList.add("animate");

            if (direction !== 0) {
                var destPx = direction > 0 ? -swiperW * 2 : 0;
                track.style.transform = "translateX(" + destPx + "px)";
                setTimeout(function () { commitWeekChange(direction); }, 320);
            } else {
                // snap back to centre
                track.style.transform = "translateX(" + (-swiperW) + "px)";
                setTimeout(function () { swipeAnimating = false; }, 320);
            }

            setTimeout(function () { swipeMoved = false; }, 60);
        }

        swiper.addEventListener("touchstart", onStart, { passive: true });
        swiper.addEventListener("touchmove", onMove, { passive: false });
        swiper.addEventListener("touchend", onEnd);
        swiper.addEventListener("touchcancel", function () {
            dragging = false;
            swipeMoved = false;
        });

        // Mouse fallback for testing on a narrow desktop window
        swiper.addEventListener("mousedown", function (e) {
            if (!isMobileView()) return;
            onStart(e);
        });
        window.addEventListener("mousemove", function (e) { if (dragging) onMove(e); });
        window.addEventListener("mouseup", function (e) { if (dragging) onEnd(e); });
    })();

    /* Arrow buttons — use the same animated flow */
    document.getElementById("prevMonth").addEventListener("click", function () {
        if (isMobileView()) animateStep(-1);
        else { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); }
    });
    document.getElementById("nextMonth").addEventListener("click", function () {
        if (isMobileView()) animateStep(1);
        else { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); }
    });

    function animateStep(direction) {
        if (swipeAnimating) return;
        if (!selectedWeekStart) selectedWeekStart = getMondayOf(new Date());

        var track = document.getElementById("weekTrack");
        var swiper = document.getElementById("weekSwiper");
        var swiperW = swiper.getBoundingClientRect().width;

        // reset to centre immediately (no animation)
        track.classList.remove("animate");
        track.style.transform = "translateX(" + (-swiperW) + "px)";
        void track.offsetWidth; // force reflow

        swipeAnimating = true;
        track.classList.add("animate");
        var destPx = direction > 0 ? -swiperW * 2 : 0;
        track.style.transform = "translateX(" + destPx + "px)";
        setTimeout(function () { commitWeekChange(direction); }, 320);
    }

    /* ---------- Desktop day detail modal ---------- */
    function openDayDetail(dateStr) {
        var byDate = tradesByDate();
        var txDate = txByDate();
        var dayTrades = byDate[dateStr] || [];
        var dayTx = txDate[dateStr] || [];
        document.getElementById("dayModalTitle").textContent = new Date(dateStr + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

        var body = "";
        if (dayTx.length) {
            body += '<div style="font-size:11px; text-transform:uppercase; letter-spacing:0.03em; color:var(--text-faint); margin:2px 0 6px;">Transactions</div>';
            body += dayTx.map(function (t) {
                var isDep = t.type === "deposit";
                return '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">' +
                    '<span>' + (isDep ? "Deposit" : "Withdrawal") + (t.note ? ' <span style="color:var(--text-muted); font-size:12px;">— ' + escapeHtml(t.note) + '</span>' : '') + '</span>' +
                    '<span class="mono ' + (isDep ? "profit" : "loss") + '">' + (isDep ? "+" : "-") + money(t.amount) + '</span>' +
                    '</div>';
            }).join("");
        }
        if (dayTrades.length) {
            body += '<div style="font-size:11px; text-transform:uppercase; letter-spacing:0.03em; color:var(--text-faint); margin:14px 0 6px;">Trades</div>';
            body += dayTrades.map(function (t) {
                return '<div style="padding:10px 0; border-bottom:1px solid var(--border);">' +
                    '<div style="display:flex; justify-content:space-between; margin-bottom:4px;">' +
                    '<b>' + escapeHtml(t.symbol) + '</b> <span class="mono ' + (t.pl >= 0 ? "profit" : "loss") + '">' + money(t.pl) + '</span></div>' +
                    '<div style="font-size:12px; color:var(--text-muted);">' + t.direction + ' · entry ' + (t.entry || "—") + ' · lot ' + (t.lot || "—") + '</div>' +
                    (t.reason ? '<div style="font-size:12.5px; color:var(--text-muted); margin-top:4px;">' + escapeHtml(t.reason) + '</div>' : '') +
                    '</div>';
            }).join("");
        }
        document.getElementById("dayModalBody").innerHTML = body || "<p>Nothing on this day.</p>";
        openOverlay("dayOverlay");
    }

    /* Re-render on viewport size changes crossing the breakpoint */
    var lastMobile = isMobileView();
    var resizeTimer = null;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            var nowMobile = isMobileView();
            if (nowMobile !== lastMobile) {
                lastMobile = nowMobile;
                renderCalendar();
            }
        }, 150);
    });

    /* ---------- Audit log ---------- */
    function renderAudit() {
        var list = document.getElementById("auditList");
        if (!state.audit.length) {
            list.innerHTML = '<div class="empty-state"><div class="glyph">◈</div><h3>No activity yet</h3><p>Every trade, deposit, edit and delete — from any device — will show up here as it happens.</p></div>';
            return;
        }
        list.innerHTML = state.audit.map(function (a) {
            var when = new Date(a.created_at).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
            return '<div class="audit-row" data-audit-id="' + a.id + '">' +
                '<span class="audit-dot ' + a.action + '"></span>' +
                '<div class="audit-body">' +
                '<div class="audit-summary">' + escapeHtml(a.summary || (a.action + " " + a.entity)) + '</div>' +
                '<div class="audit-meta">' + a.action + ' · ' + a.entity + ' · ' + when + '</div>' +
                '</div>' +
                '</div>';
        }).join("");
    }

    /* ---------- Render all ---------- */
    function renderAll() {
        renderStats();
        renderTrades();
        renderTx();
        renderCalendar();
        renderAudit();
    }

    /* ---------- Auth ---------- */
    var authMode = "signin";
    document.querySelectorAll("[data-authtab]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            authMode = btn.dataset.authtab;
            document.querySelectorAll("[data-authtab]").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            document.getElementById("authSubmit").textContent = authMode === "signin" ? "Sign in" : "Create account";
            document.getElementById("authHint").textContent = authMode === "signup"
                ? "Depending on your Supabase settings you may need to confirm your email before signing in."
                : "";
            hideAuthError();
        });
    });
    function showAuthError(msg) {
        var el = document.getElementById("authError");
        el.textContent = msg; el.classList.add("show");
    }
    function hideAuthError() { document.getElementById("authError").classList.remove("show"); }

    document.getElementById("authSubmit").addEventListener("click", async function () {
        hideAuthError();
        var email = document.getElementById("authEmail").value.trim();
        var password = document.getElementById("authPassword").value;
        if (!email || !password) { showAuthError("Enter an email and password."); return; }
        var res;
        if (authMode === "signup") res = await sb.auth.signUp({ email: email, password: password });
        else res = await sb.auth.signInWithPassword({ email: email, password: password });
        if (res.error) { showAuthError(res.error.message); return; }
        if (authMode === "signup" && !res.data.session) {
            var msg = "Check " + email + " for a confirmation link, then sign in.";
            document.getElementById("authHint").textContent = msg;
            toast("Confirmation email sent");
        }
    });

    document.getElementById("signOutBtn").addEventListener("click", async function () {
        await sb.auth.signOut();
    });

    function showAuthScreen() {
        document.getElementById("authScreen").style.display = "flex";
        document.getElementById("app").classList.remove("ready");
    }
    async function showApp() {
        document.getElementById("authScreen").style.display = "none";
        document.getElementById("app").classList.add("ready");
        document.getElementById("userEmail").textContent = currentUser.email;
        await fetchAll();
        renderAll();
        subscribeRealtime();
    }

    function subscribeRealtime() {
        if (channel) sb.removeChannel(channel);
        channel = sb.channel("ledger-" + currentUser.id)
            .on("postgres_changes", { event: "*", schema: "public", table: "trades", filter: "user_id=eq." + currentUser.id },
                async function () { await fetchAll(); renderAll(); })
            .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: "user_id=eq." + currentUser.id },
                async function () { await fetchAll(); renderAll(); })
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log", filter: "user_id=eq." + currentUser.id },
                async function () { await fetchAll(); renderAll(); })
            .subscribe();
    }

    sb.auth.onAuthStateChange(function (event, session) {
        if (session && session.user) {
            currentUser = session.user;
            showApp();
        } else {
            currentUser = null;
            if (channel) { sb.removeChannel(channel); channel = null; }
            showAuthScreen();
        }
    });

    initDow();
})();
