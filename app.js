function renderMonthGrid(year, month) {
    var firstDay = new Date(year, month, 1);
    var startOffset = (firstDay.getDay() + 6) % 7;
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var byDate = tradesByDate();
    var txDate = txByDate();
    var todayStr = todayISO();
    var ntSet = noTradeSet();

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
        if (!hasTrades && ntSet[dateStr]) cls += " notrade";

        var txChips = "";
        if (hasTx) {
            txChips = '<div class="cal-tx">';
            if (depSum > 0) txChips += '<span class="tx-chip dep" title="Deposit ' + money(depSum) + '"><i>↓</i>' + moneyCompact(depSum) + '</span>';
            if (wdSum > 0) txChips += '<span class="tx-chip wd" title="Withdrawal ' + money(wdSum) + '"><i>↑</i>' + moneyCompact(wdSum) + '</span>';
            txChips += '</div>';
        }

        var titleAttr = hasTrades
            ? (' title="P/L: ' + money(dayPL) + ' · ' + dayTrades.length + ' trade' + (dayTrades.length === 1 ? "" : "s") + '"')
            : '';

        cells.push(
            '<div class="' + cls + '" data-date="' + dateStr + '"' + titleAttr + '>' +
            '<div class="d-num">' + d + '</div>' +
            (hasTrades
                ? '<div class="d-pl mono ' + (dayPL >= 0 ? "profit" : "loss") + '">' + moneyCompact(dayPL) + '</div><div class="d-meta">' + dayTrades.length + ' trade' + (dayTrades.length === 1 ? "" : "s") + '</div>'
                : (ntSet[dateStr] ? '<div class="d-nt">No trades</div>' : '<div></div>')) +
            txChips +
            '</div>'
        );
    }
    var totalCells = startOffset + daysInMonth;
    var trailing = (7 - (totalCells % 7)) % 7;
    for (var j = 0; j < trailing; j++) cells.push('<div class="cal-cell pad"></div>');

    var grid = document.getElementById("calGrid");
    grid.innerHTML = cells.join("");
    grid.querySelectorAll(".cal-cell[data-date]").forEach(function (cell) {
        cell.addEventListener("click", function () { openDayDetail(cell.dataset.date); });
    });
}
