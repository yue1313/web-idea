let editors = {};

// CodeMirror 初期化
function createEditor(id, mode){
    const editor = CodeMirror.fromTextArea(document.getElementById(id), {
        mode: mode,
        theme: "dracula",
        lineNumbers: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false
    });
    editor.refresh();
    return editor;
}

editors.html = createEditor("htmlEditor", "xml");
editors.css = createEditor("cssEditor", "css");
editors.js = createEditor("jsEditor", "javascript");
editors.python = createEditor("pythonEditor", "python");

// 初期表示
editors.html.getWrapperElement().style.display = "block";
editors.css.getWrapperElement().style.display = "block";
editors.js.getWrapperElement().style.display = "block";
editors.python.getWrapperElement().style.display = "none";
document.getElementById("preview").style.display = "block";
document.getElementById("pyConsole").style.display = "none";

// タブ切替
document.querySelectorAll(".tab").forEach(tab=>{
    tab.addEventListener("click", e=>{
        document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
        e.target.classList.add("active");
        const lang = e.target.dataset.lang;

        if(lang==="python"){
            editors.html.getWrapperElement().style.display="none";
            editors.css.getWrapperElement().style.display="none";
            editors.js.getWrapperElement().style.display="none";
            editors.python.getWrapperElement().style.display="block";
            editors.python.refresh();

            document.getElementById("preview").style.display="none";
            document.getElementById("pyConsole").style.display="flex";
        }else{
            editors.html.getWrapperElement().style.display="block";
            editors.css.getWrapperElement().style.display="block";
            editors.js.getWrapperElement().style.display="block";
            editors.python.getWrapperElement().style.display="none";
            editors.html.refresh();
            editors.css.refresh();
            editors.js.refresh();

            document.getElementById("preview").style.display="block";
            document.getElementById("pyConsole").style.display="none";
        }
    });
});

// Pyodide 初期化
let pyodideReady = false;
let pyodide;
async function initPyodide(){
    pyodide = await loadPyodide();
    pyodideReady = true;
}
initPyodide();

// Python input() 用
let inputResolve = null;
async function js_input() {
    return new Promise(resolve=>{
        inputResolve = resolve;
        const inputEl = document.getElementById("pyInput");
        inputEl.disabled=false;
        inputEl.focus();
    });
}

document.getElementById("pyInput").addEventListener("keydown", e=>{
    if(e.key==="Enter" && inputResolve){
        const val = e.target.value;
        document.getElementById("pyOutput").textContent += val + "\n";
        inputResolve(val);
        inputResolve = null;
        e.target.value="";
        e.target.disabled=true;
    }
});

// Runボタン
document.getElementById("runBtn").onclick = async ()=>{
    const activeLang = document.querySelector(".tab.active").dataset.lang;

    if(activeLang==="python"){
        if(!pyodideReady){
            document.getElementById("pyOutput").textContent="Pythonエンジン読み込み中...";
            return;
        }
        const code = editors.python.getValue();
        const outputEl = document.getElementById("pyOutput");
        outputEl.textContent="";
        const inputEl = document.getElementById("pyInput");
        inputEl.value="";
        inputEl.disabled=true;

        try{
            pyodide.globals.set("js_input", js_input);

            await pyodide.runPythonAsync(`
import sys
import asyncio
import builtins
from js import document, js_input

class ConsoleIO:
    def write(self, s):
        document.getElementById("pyOutput").textContent += s
    def flush(self): pass

sys.stdout = ConsoleIO()
sys.stderr = ConsoleIO()

async def py_input(prompt=""):
    document.getElementById("pyOutput").textContent += prompt
    val = await js_input()
    return val

builtins.input = lambda prompt="": asyncio.get_event_loop().run_until_complete(py_input(prompt))
`);

            await pyodide.runPythonAsync(code);
        }catch(e){
            outputEl.innerHTML += `<span style="color:red;">${e}</span>\n`;
        }

    }else{
        // HTML/CSS/JS プレビュー
        const html = editors.html.getValue();
        const css = `<style>${editors.css.getValue()}</style>`;
        const js = `<script>${editors.js.getValue()}<\/script>`;
        document.getElementById("preview").srcdoc = html + css + js;
    }
};
