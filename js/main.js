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
            editors.python.getWrapperElement().style.display = "block";
            editors.html.getWrapperElement().style.display = "none";
            editors.css.getWrapperElement().style.display = "none";
            editors.js.getWrapperElement().style.display = "none";
            document.getElementById("preview").style.display = "none";
            document.getElementById("pyConsole").style.display = "flex";
        } else {
            editors.python.getWrapperElement().style.display = "none";
            editors.html.getWrapperElement().style.display = "block";
            editors.css.getWrapperElement().style.display = "block";
            editors.js.getWrapperElement().style.display = "block";
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
        document.getElementById("pyInput").disabled = false;
        document.getElementById("pyInput").focus();
    });
}

document.getElementById("pyInput").addEventListener("keydown", (e)=>{
    if(e.key === "Enter" && inputResolve){
        const val = e.target.value;
        const outputEl = document.getElementById("pyOutput");
        outputEl.textContent += val + "\n"; // echo
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
        document.getElementById("pyInput").value = "";
        document.getElementById("pyInput").disabled = true;

        try{
            // stdin を input() に対応させる
            pyodide.globals.set("js_input", waitForInput);
            await pyodide.runPythonAsync(`
import sys
from js import console, js_input

class ConsoleIO:
    def __init__(self):
        self.output = console
    def write(self, s):
        if s != '\\n':
            console.log(s)
    def flush(self):
        pass

sys.stdout = ConsoleIO()
sys.stderr = ConsoleIO()

def input(prompt=""):
    print(prompt, end="")
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
