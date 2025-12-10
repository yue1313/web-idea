// ----------------- CodeMirror 初期化 -----------------
const editors = {};

function createEditor(id, mode) {
    return CodeMirror(document.getElementById(id), {
        mode: mode,
        theme: "dracula",
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        autofocus: true,
        extraKeys: {
            "Tab": (cm) => cm.replaceSelection("    ", "end"),
            "Shift-Tab": (cm) => {
                const selections = cm.listSelections();
                selections.forEach(sel => {
                    const from = sel.from();
                    const to = sel.to();
                    for (let i = from.line; i <= to.line; i++) {
                        const line = cm.getLine(i);
                        if (line.startsWith("    ")) cm.replaceRange("", {line:i,ch:0}, {line:i,ch:4});
                    }
                });
            }
        }
    });
}

editors.html = createEditor("htmlEditor", "xml");
editors.css = createEditor("cssEditor", "css");
editors.js = createEditor("jsEditor", "javascript");
editors.python = createEditor("pythonEditor", "python");

// ----------------- タブ切替 -----------------
document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");
        Object.keys(editors).forEach(key => editors[key].getWrapperElement().style.display = "none");
        editors[tab.dataset.lang].getWrapperElement().style.display = "block";
        editors[tab.dataset.lang].refresh();
    });
});

// 初期表示
Object.keys(editors).forEach(key => editors[key].getWrapperElement().style.display = "none");
editors.html.getWrapperElement().style.display = "block";

// ----------------- Pyodide 初期化 -----------------
let pyodideReady = false;
let pyodide;
async function initPyodide() {
    pyodide = await loadPyodide();
    pyodideReady = true;
}
initPyodide();

// ----------------- Runボタン -----------------
document.getElementById("runBtn").onclick = async () => {
    const activeLang = document.querySelector(".tab.active").dataset.lang;
    const preview = document.getElementById("preview");

    if (activeLang === "python") {
        if (!pyodideReady) {
            preview.srcdoc = `<pre>Python エンジン読み込み中...</pre>`;
            return;
        }

        const code = editors.python.getValue();
        try {
            let output = "";
            pyodide.setStdout({batched: s => { output += s + "\n"; }});
            pyodide.setStderr({batched: s => { output += s + "\n"; }});

            // ----------------- 変数追跡用コード -----------------
            const trackCode = `
import sys

tracker = {}

def trace_func(frame, event, arg):
    if event == 'opcode':  # opcode 単位で追跡
        locs = frame.f_locals
        for k,v in locs.items():
            if k not in tracker:
                tracker[k] = {'init': v, 'changes': []}
            if len(tracker[k]['changes']) < 10:
                tracker[k]['changes'].append({'line': frame.f_lineno, 'value': v})
    return trace_func

sys.settrace(trace_func)
`;

            pyodide.runPython(trackCode + "\n" + code);
            const tracker = pyodide.runPython('tracker');

            // tracker 表作成
            let tableHTML = `<table border="1" style="border-collapse: collapse; width:100%; margin-top:10px;">
                <tr><th>変数名</th><th>初期値</th>`;
            for (let i=1;i<=10;i++) tableHTML += `<th>変化${i}</th>`;
            tableHTML += `</tr>`;

            for (let key of Object.keys(tracker)) {
                let row = `<tr><td>${key}</td><td>${tracker[key]['init']}</td>`;
                for (let i=0;i<10;i++) {
                    if (tracker[key]['changes'][i]) {
                        const ch = tracker[key]['changes'][i];
                        row += `<td>${ch['value']} (line ${ch['line']})</td>`;
                    } else { row += "<td></td>"; }
                }
                row += "</tr>";
                tableHTML += row;
            }
            tableHTML += `</table>`;

            preview.srcdoc = `<pre>${output}</pre>${tableHTML}`;

        } catch (e) {
            preview.srcdoc = `<pre style="color:red;">Error: ${e}</pre>`;
        }

    } else {
        const html = editors.html.getValue();
        const css = `<style>${editors.css.getValue()}</style>`;
        const js = `<script>${editors.js.getValue()}<\/script>`;
        preview.srcdoc = html + css + js;
    }
};
