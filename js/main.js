document.getElementById("run").onclick = () => {
    const lang = document.getElementById("lang").value;
    const code = document.getElementById("editor").value;

    document.getElementById("output").textContent = 
        `[${lang}] 実行ボタンが押されました。\nまだエンジンは未実装です。`;
}
