/*
    ATM MACHINE SIMULATION - behaviour
    By Anirudh Saxena

    This is the same logic as atm.c (PIN login with 3 attempts, balance,
    deposit, withdraw in multiples of 100, mini statement of the last 5
    transactions, change PIN), now driven by an on-screen ATM.
    Default PIN: 1234
*/

(function () {
    "use strict";

    var MAX_TXN = 5;        // mini statement remembers this many transactions
    var START_PIN = 1234;
    var START_BALANCE = 10000.00;

    // ----- account data (same as the globals in atm.c) -----
    var atm = { pin: START_PIN, balance: START_BALANCE, txns: [], attempts: 0 };

    // ----- what the screen is doing right now -----
    var view = "welcome";
    var buf = "";          // digits typed on the keypad
    var note = null;       // { text, kind } message shown on screen
    var temp = {};         // small scratch space (new PIN, result text...)
    var busy = false;      // true while the card is sliding in

    var $ = function (id) { return document.getElementById(id); };
    var screenEl = $("screen");
    var cardEl = $("card");
    var cardSlot = $("cardSlot");
    var receiptEl = $("receipt");
    var cashSlot = $("cashSlot");
    var cashBills = $("cashBills");
    var led = $("led");
    var statusText = $("statusText");

    function money(n) {
        return "Rs. " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function round2(n) { return Math.round(n * 100) / 100; }

    function setStatus(text, kind) {
        statusText.textContent = text;
        led.className = "led" + (kind ? " " + kind : "");
    }

    // ----- transactions (keeps only the last MAX_TXN, like addTransaction in C) -----
    function addTransaction(type, amount) {
        if (atm.txns.length === MAX_TXN) { atm.txns.shift(); }
        atm.txns.push({ type: type, amount: amount });
    }

    function parseAmount() {
        if (buf === "" || buf === ".") { return null; }
        var n = parseFloat(buf);
        return isNaN(n) ? null : n;
    }

    // ----- screen definitions -----
    // options[0..2] = left buttons, options[3..5] = right buttons
    function opt(label, run) { return { label: label, run: run }; }

    var screens = {
        welcome: function () {
            return {
                title: "Welcome to the ATM",
                lines: ["Insert your card to begin."],
                options: [null, null, null, null, null, opt("Insert card", insertCard)]
            };
        },

        pin: function () {
            return {
                title: "Enter your 4-digit PIN",
                input: { kind: "pin", max: 4 },
                options: [null, null, null, null, null, opt("Eject card", ejectCard)]
            };
        },

        menu: function () {
            return {
                title: "What would you like to do?",
                options: [
                    opt("Check balance", function () { go("balance"); }),
                    opt("Deposit money", function () { go("deposit"); }),
                    opt("Withdraw money", function () { go("withdraw"); }),
                    opt("Mini statement", function () { go("statement"); }),
                    opt("Change PIN", function () { go("cp_old"); }),
                    opt("Exit", function () { go("goodbye"); })
                ]
            };
        },

        balance: function () {
            return {
                title: "Your current balance",
                big: money(atm.balance),
                options: [null, null, null, null, null, opt("Main menu", function () { go("menu"); })]
            };
        },

        deposit: function () {
            return {
                title: "Enter amount to deposit",
                input: { kind: "amount", max: 9 },
                options: [null, null, null, null, null, opt("Main menu", function () { go("menu"); })]
            };
        },

        withdraw: function () {
            var quick = function (n) { return opt(money(n).replace(".00", ""), function () { doWithdraw(n); }); };
            return {
                title: "Enter amount to withdraw",
                lines: ["Amounts must be in multiples of 100."],
                input: { kind: "amount", max: 9 },
                options: [quick(500), quick(1000), quick(2000), quick(5000), quick(10000),
                          opt("Main menu", function () { go("menu"); })]
            };
        },

        statement: function () {
            var rows = [];
            for (var i = atm.txns.length - 1; i >= 0; i--) {
                rows.push([atm.txns[i].type, money(atm.txns[i].amount)]);
            }
            return {
                title: "Mini statement",
                lines: rows.length === 0 ? ["No transactions yet."] : [],
                rows: rows,
                total: ["Balance", money(atm.balance)],
                options: [null, null, null, null, null, opt("Main menu", function () { go("menu"); })]
            };
        },

        cp_old: function () {
            return {
                title: "Change PIN",
                lines: ["Enter your current PIN."],
                input: { kind: "pin", max: 4 },
                options: [null, null, null, null, null, opt("Main menu", function () { go("menu"); })]
            };
        },
        cp_new: function () {
            return {
                title: "Change PIN",
                lines: ["Enter your new 4-digit PIN."],
                input: { kind: "pin", max: 4 },
                options: [null, null, null, null, null, opt("Main menu", function () { go("menu"); })]
            };
        },
        cp_confirm: function () {
            return {
                title: "Change PIN",
                lines: ["Confirm your new PIN."],
                input: { kind: "pin", max: 4 },
                options: [null, null, null, null, null, opt("Main menu", function () { go("menu"); })]
            };
        },

        result: function () {
            return {
                title: temp.result.title,
                lines: temp.result.lines,
                options: [null, null, null, null,
                          opt("Exit", function () { go("goodbye"); }),
                          opt("Main menu", function () { go("menu"); })]
            };
        },

        blocked: function () {
            return {
                title: "Card blocked",
                lines: ["Too many wrong attempts. Your card has been kept by the machine."],
                options: [null, null, null, null, null, opt("Reset demo", resetDemo)]
            };
        },

        goodbye: function () {
            return {
                title: "Thank you for using the ATM",
                lines: ["Goodbye! Please take your card."],
                options: [null, null, null, null, null, opt("Insert card", insertCard)]
            };
        }
    };

    // ----- Enter key behaviour for each screen (the same checks as the C functions) -----
    var onEnter = {
        pin: function () {
            if (buf.length !== 4) { return say("Enter all 4 digits of your PIN.", "error"); }
            if (parseInt(buf, 10) === atm.pin) {
                atm.attempts = 0;
                go("menu", { text: "Login successful!", kind: "ok" });
                return;
            }
            atm.attempts++;
            buf = "";
            if (atm.attempts >= 3) {
                go("blocked");
            } else {
                say("Wrong PIN! Attempts left: " + (3 - atm.attempts), "error");
            }
        },

        deposit: function () {
            var amount = parseAmount();
            if (amount === null) { return say("Invalid input! Please enter a number.", "error"); }
            if (amount <= 0) { return say("Amount must be greater than 0.", "error"); }

            atm.balance = round2(atm.balance + amount);
            addTransaction("Deposit", amount);
            showResult("Deposit successful", [
                money(amount) + " deposited successfully.",
                "New balance: " + money(atm.balance)
            ]);
        },

        withdraw: function () { doWithdraw(parseAmount()); },

        cp_old: function () {
            if (buf === "") { return go("menu", { text: "Invalid input!", kind: "error" }); }
            if (parseInt(buf, 10) !== atm.pin) {
                return go("menu", { text: "Wrong PIN! PIN not changed.", kind: "error" });
            }
            go("cp_new");
        },

        cp_new: function () {
            if (buf === "") { return go("menu", { text: "Invalid input!", kind: "error" }); }
            var n = parseInt(buf, 10);
            if (n < 1000 || n > 9999) {
                return go("menu", { text: "PIN must be exactly 4 digits.", kind: "error" });
            }
            temp.newPin = n;
            go("cp_confirm");
        },

        cp_confirm: function () {
            if (buf === "") { return go("menu", { text: "Invalid input!", kind: "error" }); }
            if (parseInt(buf, 10) === temp.newPin) {
                atm.pin = temp.newPin;
                go("menu", { text: "PIN changed successfully!", kind: "ok" });
            } else {
                go("menu", { text: "PINs do not match. PIN not changed.", kind: "error" });
            }
        }
    };

    function doWithdraw(amount) {
        if (amount === null) { return say("Invalid input! Please enter a number.", "error"); }
        if (amount <= 0) { return say("Amount must be greater than 0.", "error"); }
        if (amount > atm.balance) {
            return say("Insufficient balance! You have " + money(atm.balance), "error");
        }
        if (Math.trunc(amount) % 100 !== 0) {
            return say("Please enter an amount in multiples of 100.", "error");
        }

        atm.balance = round2(atm.balance - amount);
        addTransaction("Withdraw", amount);
        showResult("Please collect your cash", [
            "Dispensed: " + money(amount),
            "Remaining balance: " + money(atm.balance)
        ]);
        dispenseCash(amount);
    }

    function showResult(title, lines) {
        temp.result = { title: title, lines: lines };
        go("result");
    }

    // ----- navigation + drawing -----
    function go(next, message) {
        view = next;
        buf = "";
        note = message || null;
        if (next !== "result") { clearCash(); }
        if (next !== "statement") { receiptEl.classList.remove("out"); }
        if (next === "statement") { printReceipt(); }
        render();
    }

    function say(text, kind) {
        note = { text: text, kind: kind };
        render();
    }

    function inputHtml(input) {
        if (input.kind === "pin") {
            var dots = "";
            for (var i = 0; i < input.max; i++) {
                dots += i < buf.length ? "&#9679; " : '<span class="ghost">&#9675;</span> ';
            }
            return '<div class="input-box" aria-label="PIN entry">' + dots + "</div>";
        }
        return '<div class="input-box">Rs. ' + (buf === "" ? '<span class="ghost">0</span>' : buf) + "</div>";
    }

    function render() {
        var s = screens[view]();
        var html = '<h2 class="screen-title">' + s.title + "</h2><div class=\"screen-body\">";

        if (s.big) { html += '<div class="big-amount">' + s.big + "</div>"; }
        (s.lines || []).forEach(function (line) { html += '<p class="screen-line">' + line + "</p>"; });

        if (s.rows && s.rows.length) {
            html += '<div class="rows">';
            s.rows.forEach(function (r) { html += '<div class="row"><span>' + r[0] + "</span><span>" + r[1] + "</span></div>"; });
            html += "</div>";
        }
        if (s.total) {
            html += '<div class="row total"><span>' + s.total[0] + "</span><span>" + s.total[1] + "</span></div>";
        }
        if (s.input) { html += inputHtml(s.input); }
        if (note) { html += '<p class="note ' + note.kind + '">' + note.text + "</p>"; }
        html += "</div>";

        // Left column = slots 0-2, right column = slots 3-5
        html += '<div class="screen-opts">';
        for (var i = 0; i < 6; i++) {
            var o = s.options[i];
            var side = i > 2 ? " right" : "";
            if (o) {
                html += '<button class="opt' + side + '" data-slot="' + i + '">' + o.label + "</button>";
            } else {
                html += '<span class="opt empty' + side + '"></span>';
            }
        }
        html += "</div>";

        screenEl.innerHTML = html;
        screenEl.dataset.input = s.input ? JSON.stringify(s.input) : "";

        var welcomeLike = view === "welcome" || view === "goodbye";
        cardSlot.classList.toggle("ready", welcomeLike);
        if (welcomeLike) { cardEl.classList.remove("inserted"); }

        if (view === "blocked") { setStatus("Card blocked", "off"); }
        else if (view === "welcome" || view === "goodbye") { setStatus("Ready", ""); }
        else { setStatus("In use", "busy"); }
    }

    function currentOption(slot) { return screens[view]().options[slot]; }

    function pressSlot(slot) {
        if (busy) { return; }
        var o = currentOption(slot);
        if (o) { o.run(); }
    }

    // ----- keypad -----
    function pressKey(k) {
        if (busy) { return; }
        var s = screens[view]();

        if (k === "cancel") {
            if (view === "pin") { return ejectCard(); }
            if (view === "menu") { return go("goodbye"); }
            if (view === "welcome" || view === "goodbye" || view === "blocked") { return; }
            return go("menu");
        }
        if (k === "clear") { buf = ""; note = null; return render(); }
        if (k === "del") { buf = buf.slice(0, -1); note = null; return render(); }
        if (k === "enter") {
            if (onEnter[view]) { onEnter[view](); }
            return;
        }

        if (!s.input) { return; }
        if (k === ".") {
            if (s.input.kind !== "amount" || buf.indexOf(".") !== -1) { return; }
            if (buf === "") { buf = "0"; }
        } else if (buf.length >= s.input.max) {
            return;
        }
        // only 2 decimal places for money
        if (buf.indexOf(".") !== -1 && buf.length - buf.indexOf(".") > 2 && k !== ".") { return; }

        buf += k;
        note = null;
        render();
    }

    // ----- card -----
    function insertCard() {
        if (busy) { return; }
        if (view !== "welcome" && view !== "goodbye") { return; }
        busy = true;
        cardSlot.classList.remove("ready");
        cardEl.classList.add("inserted");
        setStatus("Reading card", "busy");
        setTimeout(function () {
            busy = false;
            atm.attempts = 0;
            go("pin");
        }, 800);
    }

    function ejectCard() {
        go("goodbye");
    }

    // ----- cash tray + receipt -----
    function dispenseCash(amount) {
        clearCash();
        var count = Math.min(4, Math.max(1, Math.ceil(amount / 2500)));
        for (var i = 0; i < count; i++) {
            var bill = document.createElement("span");
            bill.className = "bill";
            bill.textContent = "Rs. " + (amount >= 500 ? 500 : 100);
            bill.style.setProperty("--rest", (14 + i * 8) + "px");
            bill.style.animationDelay = (i * 0.15) + "s";
            bill.style.zIndex = i + 1;
            cashBills.appendChild(bill);
        }
        cashSlot.classList.add("active");
    }

    function clearCash() {
        cashBills.innerHTML = "";
        cashSlot.classList.remove("active");
    }

    function printReceipt() {
        var html = '<div class="r-head">SAXENA BANK<br>Mini statement</div><div class="r-rule"></div>';
        if (atm.txns.length === 0) { html += "<div>No transactions yet.</div>"; }
        for (var i = atm.txns.length - 1; i >= 0; i--) {
            html += '<div class="r-line"><span>' + atm.txns[i].type + "</span><span>" + money(atm.txns[i].amount) + "</span></div>";
        }
        html += '<div class="r-rule"></div><div class="r-line"><span>Balance</span><span>' + money(atm.balance) + "</span></div>";
        receiptEl.innerHTML = html;
        receiptEl.classList.remove("out");
        void receiptEl.offsetWidth;           // restart the print animation
        receiptEl.classList.add("out");
    }

    function resetDemo() {
        atm = { pin: START_PIN, balance: START_BALANCE, txns: [], attempts: 0 };
        busy = false;
        temp = {};
        go("welcome");
    }

    // ----- events -----
    document.addEventListener("click", function (e) {
        var slotBtn = e.target.closest("[data-slot]");
        if (slotBtn) { return pressSlot(parseInt(slotBtn.dataset.slot, 10)); }

        var keyBtn = e.target.closest("[data-key]");
        if (keyBtn) { return pressKey(keyBtn.dataset.key); }
    });

    cardSlot.addEventListener("click", insertCard);
    cashSlot.addEventListener("click", clearCash);
    receiptEl.addEventListener("click", function () { receiptEl.classList.remove("out"); });
    $("reset").addEventListener("click", resetDemo);

    document.addEventListener("keydown", function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) { return; }
        var k = e.key;
        if (/^[0-9]$/.test(k) || k === ".") { pressKey(k); }
        else if (k === "Enter") {
            // don't hijack Enter on a focused button
            if (document.activeElement && document.activeElement.tagName === "BUTTON") { return; }
            pressKey("enter");
        }
        else if (k === "Backspace") { pressKey("del"); }
        else if (k === "Delete") { pressKey("clear"); }
        else if (k === "Escape") { pressKey("cancel"); }
    });

    render();
})();
