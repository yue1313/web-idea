const editors = {};

// ---------------- CodeMirror 初期化 ----------------
function createEditor(id, mode) {
    return CodeMirror(document.getElementById(id), {
        mode: mode,
        theme: "dracula",
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        autofocus: true
    });
}

// HTML/CSS/JS/Python 全て CodeMirror で統合
editors.html = createEditor("htmlEditor", "xml");
editors.css = createEditor("cssEditor", "css");
editors.js = createEditor("jsEditor", "javascript");
editors.python = createEditor("pythonEditor", "python");

// ---------------- タブ切替 ----------------
document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");

        const lang = e.target.dataset.lang;
        if(lang === "python") {
            // Python エディタ表示
            editors.python.getWrapperElement().style.display = "block";
            // HTML/CSS/JS エディタ非表示
            editors.html.getWrapperElement().style.display = "none";
            editors.css.getWrapperElement().style.display = "none";
            editors.js.getWrapperElement().style.display = "none";

            document.getElementById("preview").style.display = "none";
            document.getElementById("pyConsole").style.display = "flex";
        } else {
            // HTML/CSS/JS エディタ表示
            editors.html.getWrapperElement().style.display = "block";
            editors.css.getWrapperElement().style.display = "block";
            editors.js.getWrapperElement().style.display = "block";
            editors.python.getWrapperElement().style.display = "none";

            document.getElementById("preview").style.display = "block";
            document.getElementById("pyConsole").style.display = "none";
        }
    });
});

// ---------------- Pyodide 初期化 ----------------
let pyodideReady = false;
let pyodide;
async function initPyodide() {
    pyodide = await loadPyodide();
    pyodideReady = true;
}
initPyodide();

// ---------------- Python コンソール関連 ----------------
let inputResolve = null;

function waitForInput() {
    return new Promise(resolve => {
        inputResolve = resolve;
        const inputEl = document.getElementById("pyInput");
        inputEl.disabled = false;
        inputEl.focus();
    });
}

document.getElementById("pyInput").addEventListener("keydown", (e)=>{
    if(e.key === "Enter" && inputResolve){
        const val = e.target.value;
        const outputEl = document.getElementById("pyOutput");
        outputEl.textContent += val + "\n"; // echo 入力
        inputResolve(val);
        inputResolve = null;
        e.target.value = "";
        e.target.disabled = true;
    }
});

// ---------------- Run ボタン ----------------
document.getElementById("runBtn").onclick = async () => {
    const activeLang = document.querySelector(".tab.active").dataset.lang;

    if(activeLang === "python") {
        if(!pyodideReady){
            document.getElementById("pyOutput").textContent = "Python エンジン読み込み中...";
            return;
        }

        const code = editors.python.getValue();
        const outputEl = document.getElementById("pyOutput");
        outputEl.textContent = "";
        const inputEl = document.getElementById("pyInput");
        inputEl.value = "";
        inputEl.disabled = true;

        try{
            // stdin を input() に対応
            pyodide.globals.set("js_input", waitForInput);
            await pyodide.runPythonAsync(`
import sys
from js import js_input

class ConsoleIO:
    def write(self, s):
        if s != '\\n':
            from js import document
            outputEl = document.getElementById("pyOutput")
            outputEl.textContent += s
    def flush(self):
        pass

sys.stdout = ConsoleIO()
sys.stderr = ConsoleIO()

def input(prompt=""):
    from js import document
    outputEl = document.getElementById("pyOutput")
    outputEl.textContent += prompt
    return js_input()
`);
            await pyodide.runPythonAsync(code);
        } catch(e){
            outputEl.innerHTML += `<span style="color:red;">${e}</span>\n`;
        }

    } else {
        // HTML/CSS/JS 同時プレビュー
        const html = editors.html.getValue();
        const css = `<style>${editors.css.getValue()}</style>`;
        const js = `<script>${editors.js.getValue()}<\/script>`;
        document.getElementById("preview").srcdoc = html + css + js;
    }
};
