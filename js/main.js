// Pyodide 初期化
let pyodideReady = false;
let pyodide;
async function initPyodide() {
    pyodide = await loadPyodide();
    pyodideReady = true;
}
initPyodide();

// タブ切替
function switchLang(lang, e) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    e.target.classList.add("active");

    document.querySelectorAll(".editor").forEach(ed => ed.classList.remove("active"));
    if (lang === "html") document.getElementById("htmlEditor").classList.add("active");
    if (lang === "css") document.getElementById("cssEditor").classList.add("active");
    if (lang === "js") document.getElementById("jsEditor").classList.add("active");
    if (lang === "python") document.getElementById("pythonEditor").classList.add("active");
}

// Python用: 変数追跡ラッパー
const trackWrapper = `
import builtins
tracker = {}

def track(varname, value, lineno):
    if varname not in tracker:
        tracker[varname] = {'init': value, 'changes': []}
    if len(tracker[varname]['changes']) < 10:
        tracker[varname]['changes'].append({'line': lineno, 'value': value})
    return value

# 既存の代入文を track() でラップするには AST 自動変換が必要
`;

// Run ボタン
document.getElementById("runBtn").onclick = async () => {
    const activeTab = document.querySelector(".tab.active").textContent.toLowerCase();
    const html = document.getElementById("htmlEditor").value;
    const css = `<style>${document.getElementById("cssEditor").value}</style>`;
    const js = `<script>${document.getElementById("jsEditor").value}<\/script>`;
    const py = document.getElementById("pythonEditor").value;
    const preview = document.getElementById("preview");

    if (activeTab === "python") {
        if (!pyodideReady) {
            preview.srcdoc = `<pre>Python エンジンを読み込み中...</pre>`;
            return;
        }
        try {
            let output = "";

            // 標準出力とエラー出力をキャプチャ
            pyodide.setStdout({batched: (s) => { output += s + "\n"; }});
            pyodide.setStderr({batched: (s) => { output += s + "\n"; }});

            // trackWrapper を先頭に付けて実行
            const wrappedCode = trackWrapper + py;
            const result = pyodide.runPython(wrappedCode);

            // 変数追跡表を作成
            const tracker = pyodide.runPython('tracker');
            let tableHTML = `<table border="1" style="border-collapse: collapse; width:100%; margin-top:10px;">
                <tr><th>変数名</th><th>初期値</th>`;
            for (let i=1; i<=10; i++) tableHTML += `<th>変化${i}</th>`;
            tableHTML += `</tr>`;

            for (let key of Object.keys(tracker)) {
                let row = `<tr><td>${key}</td><td>${tracker[key]['init']}</td>`;
                for (let i=0; i<10; i++) {
                    if (tracker[key]['changes'][i]) {
                        const ch = tracker[key]['changes'][i];
                        row += `<td>${ch['value']} (line ${ch['line']})</td>`;
                    } else {
                        row += `<td></td>`;
                    }
                }
                row += `</tr>`;
                tableHTML += row;
            }
            tableHTML += `</table>`;

            preview.srcdoc = `<pre>${output}</pre>${tableHTML}`;
        } catch (e) {
            preview.srcdoc = `<pre style="color:red;">Error: ${e}</pre>`;
        }
    } else {
        // HTML/CSS/JS
        preview.srcdoc = html + css + js;
    }
};
