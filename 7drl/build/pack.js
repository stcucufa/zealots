const stylesheet = await Bun.file("../style.css").text();
const script = await Bun.file("../game.js").text();

console.log(`<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Z.E.A.L.O.T.S. (7DRL 2024)</title>
        <style>
${stylesheet}
        </style>
    </head>
    <body>
        <div class="screen"></div>
        <pre class="canvas"></pre>
        <script>
${script}
        </script>
    </body>
</html>`);
