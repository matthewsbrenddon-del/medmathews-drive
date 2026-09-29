#!/usr/bin/env python3
"""
Converte seed-data/MedStudyHub_QBank_5000.xlsx (aba QUESTÕES) em
public/seed-data/questions-qbank.json — o banco de questões carregado pela
plataforma.

Uso:  python3 scripts/build-qbank.py

Só usa a biblioteca padrão (o .xlsx é lido direto do XML: a planilha usa
caminhos internos absolutos que o ExcelJS não abre).

Regras:
- IDs estáveis: "Q000123" -> "qbank-q000123". As 400 primeiras são as mesmas
  do banco anterior, então progresso, grifos e listas do aluno continuam.
  Para elas, área/tema/tags/dificuldade anteriores são preservados.
- Revalida (INEP): gabarito na coluna "Gabarito oficial" ("Anulada" -> anulada).
  Coletâneas: gabarito na coluna "Gabarito da fonte".
- Alternativa E "não se aplica" ou lixo de extração ("Essa questão possui
  comentário...") é descartada; se o gabarito for E, fica com um aviso.
- "Área" da planilha (24 valores) -> 5 grandes áreas ENAMED; a especialidade
  original fica em `especialidade`.
"""
import json
import math
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "seed-data" / "MedStudyHub_QBank_5000.xlsx"
OUT = ROOT / "public" / "seed-data" / "questions-qbank.json"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

GRANDES_AREAS = {
    "clinica-medica": "Clínica Médica",
    "cirurgia-geral": "Cirurgia Geral",
    "ginecologia-obstetricia": "Ginecologia e Obstetrícia",
    "pediatria": "Pediatria",
    "preventiva-mfc": "Preventiva e MFC",
}

AREA_TO_SLUG = {
    "Pediatria": "pediatria",
    "Medicina Preventiva / Saúde Coletiva": "preventiva-mfc",
    "Cirurgia": "cirurgia-geral",
    "Ortopedia": "cirurgia-geral",
    "Otorrinolaringologia": "cirurgia-geral",
    "Oftalmologia": "cirurgia-geral",
    "Urologia": "cirurgia-geral",
    "Obstetrícia": "ginecologia-obstetricia",
    "Ginecologia": "ginecologia-obstetricia",
    "Ginecologia e Obstetrícia": "ginecologia-obstetricia",
}
# Todo o resto (Psiquiatria, Infectologia, Neurologia, Cardiologia, etc.) -> Clínica Médica.

PLACEHOLDERS = {"", "não identificado", "não identificada", "não se aplica", "pendente", "não classificada"}


def clean(value):
    if value is None:
        return None
    text = str(value).strip()
    return None if text.lower() in PLACEHOLDERS else text


# --- Limpeza dos artefatos de extração das coletâneas -----------------------
FOOTER_RE = re.compile(r"\s*Essa\s+quest[ãa]o\s+po\s*ssui\s+co\s*ment[áa]rio.*$", re.S | re.I)
# Rodapé de página "4 00018 8 64 4" (às vezes seguido da marca d'água embaralhada).
PAGE_NUM_RE = re.compile(r"\s+4\s+000\d[\s\S]*$|\s+\d\s+\d{3,7}(?:\s?\d{1,6}){0,3}\s*$")
INEP_FOOTER_RE = re.compile(r"\s+\d{1,3}\s+INEP\d+\s*\|[^\n]*$")
HEADER_STARTERS = (
    "Paciente|Pacientes|Mulher|Homem|Criança|Menino|Menina|Lactente|Recém|Gestante|Primigesta|Secundigesta|"
    "Primípara|Multípara|Adolescente|Idos[oa]|Jovem|Um|Uma|Em relação|Sobre|Qual|Quais|Assinale|A respeito|"
    "Considere|Considerando|Durante|Após|Você|Senhor|Senhora|Estudante|Trabalhador|Puérpera|"
    "Escolar|Pré-escolar|Neonato|RN|Médico|Agricultor|Motorista|Assinale|Analise|Leia|Observe|Com relação|"
    "De acordo|Segundo|Dentre|Entre|Todas|São|É correto|Indique|Marque|Identifique|Mãe|Pai|Família|Casal|"
    "Na|No|Nas|Nos|Em|Para|Cada|Quanto|Quando|Sra?\\.|[A-ZÀ-Ú][a-zà-ú]+(?=,\\s*\\d)|[A-Z]{2,4}(?=,)|"
    "(?:O|A|Os|As)(?=\\s+[a-zà-ú])"
)
# Marca d'água "venda proibida medicina livre" embaralhada pela extração.
WATERMARK_RE = re.compile(r"(?:\s+(?:re|a|liv|d|n|in|ve|ic|ed|ibid|o|pr|e|l|v|i)\b){6,}")
# Palavras após as quais "A"/"O" maiúsculo faz parte do nome ("hepatite A").
NOT_HEADER_END = {"vitamina", "hepatite", "tipo", "grupo", "classe", "fator", "sorotipo", "influenza", "estreptococo", "vírus", "anexo", "figura", "quadro", "tabela", "estágio", "zona", "onda", "segmento"}
HEADER_RE = re.compile(r"^((?:[^\s,.;:?!()\d\"“”]+\s+){0,13}?[^\s,.;:?!()\d\"“”]+)\s+(?=(?:" + HEADER_STARTERS + r")(?![A-Za-zà-ú]))")


def build_vocab(texts):
    """Palavras que aparecem inteiras no corpus (com frequência) — usadas para
    reconstruir ligaduras perdidas ("noti cados" -> "notificados") e separar
    palavras coladas."""
    vocab = {}
    for t in texts:
        for w in re.findall(r"[A-Za-zÀ-ÿ]+", t):
            vocab[w.lower()] = vocab.get(w.lower(), 0) + 1
    return vocab


def segment_glued(text, freq):
    """Palavras coladas na extração ("internaçãoparaamelhoradodesconforto")
    são separadas por programação dinâmica usando as palavras do corpus."""

    total = sum(freq.values()) or 1

    def split_word(word):
        low = word.lower()
        n = len(low)
        best = [None] * (n + 1)
        best[0] = (0, [])
        for i in range(1, n + 1):
            for j in range(max(0, i - 24), i):
                piece = low[j:i]
                if best[j] is None or freq.get(piece, 0) < 3:
                    continue
                # Modelo de unigramas: prefere palavras frequentes ("para a melhora do").
                cost = best[j][0] - math.log(freq[piece] / total)
                if best[i] is None or cost < best[i][0]:
                    best[i] = (cost, best[j][1] + [(j, i)])
        if best[n] is None:
            return word
        return " ".join(word[a:b] for a, b in best[n][1])

    return re.sub(r"[A-Za-zÀ-ÿ]{18,}", lambda m: m.group(0) if freq.get(m.group(0).lower(), 0) >= 3 else split_word(m.group(0)), text)


def fix_ligatures(text, vocab):
    def join(m):
        a, b = m.group(1), m.group(2)
        for lig in ("fi", "fl", "ff", ""):
            cand = a + lig + b
            if lig == "" and not a.endswith(("T", "V", "W", "Y", "f")):
                continue  # só une sem ligadura no kerning ("T ratamento", "classif icação")
            if cand.lower() in vocab:
                return cand
        return m.group(0)

    # "noti cados", "pro ssionais", "per l", "T ratamento"
    return re.sub(r"\b([A-Za-zÀ-ÿ]{1,})\s([a-zà-ÿ]{1,})\b", join, text)


def clean_text(text, vocab):
    text = segment_glued(text, vocab)
    text = WATERMARK_RE.sub("", text)
    text = FOOTER_RE.sub("", text)
    text = PAGE_NUM_RE.sub("", text)
    text = INEP_FOOTER_RE.sub("", text)
    return fix_ligatures(text, vocab).strip()


def split_header(enunciado):
    """Coletâneas trazem o título da seção colado ao início do enunciado
    ("Distúrbios da condução atrioventricular Paciente masculino...")."""
    m = HEADER_RE.match(enunciado)
    if not m:
        return None, enunciado
    header = m.group(1).strip()
    words = header.split()
    rest = enunciado[m.end():]
    if not header[0].isupper() or len(rest) < 25:
        return None, enunciado
    if len(words) == 1 and (len(header) < 4 or re.match(HEADER_STARTERS, header)):
        return None, enunciado
    if re.match(r"(?:O|A|Os|As)\s", rest) and (len(words[-1]) == 1 or words[-1].lower() in NOT_HEADER_END):
        return None, enunciado
    return header, rest


def read_questions():
    z = zipfile.ZipFile(XLSX)
    shared = []
    for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(f"{NS}si"):
        shared.append("".join(t.text or "" for t in si.iter(f"{NS}t")))

    def col(ref):
        n = 0
        for ch in re.match(r"[A-Z]+", ref).group(0):
            n = n * 26 + ord(ch) - 64
        return n - 1

    rows = []
    for r in ET.fromstring(z.read("xl/worksheets/sheet2.xml")).iter(f"{NS}row"):
        vals = {}
        for c in r.findall(f"{NS}c"):
            t, v, inline = c.get("t"), c.find(f"{NS}v"), c.find(f"{NS}is")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr" and inline is not None:
                val = "".join(x.text or "" for x in inline.iter(f"{NS}t"))
            else:
                val = v.text if v is not None else None
            vals[col(c.get("r"))] = val
        if vals:
            rows.append([vals.get(i) for i in range(max(vals) + 1)])
    header = rows[0]
    return [dict(zip(header, row + [None] * (len(header) - len(row)))) for row in rows[1:]]


def main():
    previous = {}
    if OUT.exists():
        for q in json.loads(OUT.read_text(encoding="utf-8")):
            previous[q["id"]] = q

    rows = read_questions()
    vocab = build_vocab(
        [r["Enunciado completo"] or "" for r in rows] + [r[f"Alternativa {l}"] or "" for r in rows for l in "ABCDE"]
    )
    # Palavras compostas de duas partes que também existem soltas no corpus
    # entrariam no vocabulário "quebradas"; só aceitamos a união se ela existir inteira.
    out, warnings, stats = [], [], {"rodapes": 0, "cabecalhos": 0}
    for d in rows:
        qid = "qbank-" + d["ID interno"].strip().lower()
        is_revalida = d["Origem"] == "Revalida"
        area = (d["Área"] or "").strip()
        especialidade = clean(d["Especialidade"])
        slug = AREA_TO_SLUG.get(area) or AREA_TO_SLUG.get(especialidade or "") or "clinica-medica"

        alternatives = []
        for letter in "ABCDE":
            text = clean(d[f"Alternativa {letter}"])
            if not text:
                continue
            if text.startswith("Essa quest"):  # lixo de extração da coletânea
                continue
            if is_revalida:
                text = segment_glued(INEP_FOOTER_RE.sub("", text).strip(), vocab)
            else:
                cleaned = clean_text(text, vocab)
                if cleaned != text:
                    stats["rodapes"] += 1
                text = cleaned
                if not text:
                    continue
            alternatives.append({"letter": letter, "text": text})

        raw_gab = (d["Gabarito oficial"] if is_revalida else d["Gabarito da fonte"]) or ""
        anulada = raw_gab.strip().lower() == "anulada" or (d["Status"] or "") == "Anulada"
        gabarito = "" if anulada else raw_gab.strip().upper()[:1]
        if gabarito and gabarito not in {a["letter"] for a in alternatives}:
            alternatives.append({"letter": gabarito, "text": "[texto desta alternativa não foi extraído da fonte]"})
            alternatives.sort(key=lambda a: a["letter"])
            warnings.append(f"{qid}: alternativa {gabarito} sem texto na fonte")

        prova = clean(d["Nome da prova"]) or ""
        if not is_revalida:
            prova = "Coletânea — " + re.sub(r"\.pdf$", "", prova, flags=re.I)

        enunciado = (d["Enunciado completo"] or "").strip()
        secao = None
        if is_revalida:
            enunciado = segment_glued(enunciado, vocab)
        else:
            enunciado = clean_text(enunciado, vocab)
            secao, enunciado = split_header(enunciado)
            if secao:
                stats["cabecalhos"] += 1

        q = {
            "id": qid,
            "subjectSlug": slug,
            "subjectName": GRANDES_AREAS[slug],
            "tema": clean(d["Tema"]),
            "especialidade": especialidade,
            "banca": "INEP" if is_revalida else None,
            "ano": int(d["Ano"]) if clean(d["Ano"]) and str(d["Ano"]).isdigit() else None,
            "colecao": "Revalida (INEP)" if is_revalida else "Coletânea Medicina Livre",
            "prova": prova or None,
            "secao": secao,
            "enunciado": enunciado,
            "alternatives": alternatives,
            "gabarito": gabarito,
            "comentario": None,
            "dificuldade": 3 if (d["Dificuldade estimada"] or "").startswith("Média") else 0,
            "tags": [],
            "hasImage": (d["Tem imagem?"] or "").strip().lower() == "sim",
            "imagemTipo": clean(d["Tipo de imagem"]),
            "fonteUrl": clean(d["URL arquivo/PDF"]) or clean(d["URL fonte original"]),
        }
        if anulada:
            q["anulada"] = True

        old = previous.get(qid)
        if old:  # mesmas 400 questões do banco anterior: preserva a curadoria já feita
            for key in ("subjectSlug", "subjectName", "tema", "subtema", "tags", "dificuldade", "comentario", "banca", "ano"):
                if old.get(key) not in (None, "", []):
                    q[key] = old[key]

        out.append({k: v for k, v in q.items() if v not in (None, "")})

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} questões -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.1f} MB)")
    print(f"limpeza: {stats['rodapes']} alternativas sem rodapé | {stats['cabecalhos']} cabeçalhos de seção separados")
    print(f"anuladas: {sum(1 for q in out if q.get('anulada'))} | com imagem: {sum(1 for q in out if q.get('hasImage'))}")
    for w in warnings:
        print("aviso:", w)


if __name__ == "__main__":
    sys.exit(main())
