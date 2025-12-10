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

// Python エディタ インデント補助
const pyEditor = document.getElementById("pythonEditor");
pyEditor.addEventListener("keydown", function(e) {
    const start = this.selectionStart;
    const end = this.selectionEnd;

    if (e.key === "Tab") {
        e.preventDefault();
        const value = this.value;
        this.value = value.substring(0, start) + "    " + value.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
    } else if (e.key === "Enter") {
        e.preventDefault();
        const value = this.value;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const line = value.substring(lineStart, start);
        const indentMatch = line.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : "";
        this.value = value.substring(0, start) + "\n" + indent + value.substring(end);
        this.selectionStart = this.selectionEnd = start + 1 + indent.length;
    }
});

// Python 自動追跡ラッパー
const trackWrapper = `
import builtins
import ast
import _ast
tracker = {}

def track(varname, value, lineno):
    if varname not in tracker:
        tracker[varname] = {'init': value, 'changes': []}
    if len(tracker[varname]['changes']) < 10:
        tracker[varname]['changes'].append({'line': lineno, 'value': value})
    return value

class TrackTransformer(ast.NodeTransformer):
    def visit_Assign(self, node):
        new_nodes = []
        for target in node.targets:
            if isinstance(target, ast.Name):
                new_node = ast.Assign(
                    targets=[target],
                    value=ast.Call(
                        func=ast.Name(id='track', ctx=ast.Load()),
                        args=[ast.Constant(value=target.id),
                              node.value,
                              ast.Constant(value=node.lineno)],
                        keywords=[]
                    )
                )
                new_nodes.append(new_node)
            else:
                new_nodes.append(node)
        return new_nodes

def wrap_code(source):
    tree = ast.parse(source)
    tree = TrackTransformer().visit(tree)
    ast.fix_missing_locations(tree)
    return compile(tree, filename="<ast>", mode="exec")
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
            pyodide.setStdout({batched: (s) => { output += s + "\n"; }});
            pyodide.setStderr({batched: (s) => { output += s + "\n"; }});

            // trackWrapper を読み込み wrap_code 定義
            pyodide.runPython(trackWrapper);

            // ユーザーコードを wrap_code で変換・実行
            pyodide.runPython(`
code = wrap_code("""${py.replace(/\\/g, "\\\\").replace(/"""/g, '\\"""')}""")
exec(code)
`);

            // 変数追跡表
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
