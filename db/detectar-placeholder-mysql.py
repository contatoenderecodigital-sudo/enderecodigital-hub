# Detector de placeholder do MySQL que sobrou em SQL.
# Escrito em arquivo, e nao inline no shell, porque o heredoc come a barra
# invertida e a classe de caracteres da regex chega quebrada no Python.
import io, os, re

SQL = re.compile(r"\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE)\b", re.I)
LITERAL = re.compile(r"`([^`]*)`", re.S)
INTERP = re.compile(r"\$\{[^{}]*\}")

raizes = [
    r"C:/Projetos Claude/enderecodigital-hub",
    r"C:/Projetos Claude/site-enderecodigital",
]

achados = []
for raiz in raizes:
    for dirp, dirs, files in os.walk(raiz):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".next", ".git", "docs")]
        for fn in files:
            if not fn.endswith((".ts", ".tsx")):
                continue
            p = os.path.join(dirp, fn)
            try:
                s = io.open(p, encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            for m in LITERAL.finditer(s):
                corpo = m.group(1)
                if not SQL.search(corpo):
                    continue
                limpo = INTERP.sub("", corpo)
                if "?" not in limpo:
                    continue
                linha = s[: m.start()].count("\n") + 1
                trechos = [
                    l.strip()
                    for l in corpo.split("\n")
                    if "?" in INTERP.sub("", l)
                ]
                achados.append((os.path.relpath(p, raiz).replace("\\", "/"), linha, trechos[:2]))

if achados:
    print("PLACEHOLDERS ? QUE SOBRARAM EM SQL:")
    for f, l, t in achados:
        print("  %s:%d" % (f, l))
        for x in t:
            print("     " + x[:110])
else:
    print("nenhum ? sobrando em SQL")
