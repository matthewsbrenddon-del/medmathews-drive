#!/usr/bin/env python3
"""
Enriquece public/seed-data/library-mapeamento.json com título legível, tipo,
tema e subtema de cada arquivo.

Uso:  python3 scripts/build-library-topics.py [--report]

Muitos arquivos têm nome genérico ("1. Aula.mp4", "Podcast.mp3",
"309990.mp4", "MAT322583_IDAPOST3207_V2.pdf"): o assunto real está na pasta
que os contém ("14. Insuficiência Cardíaca (Parte 1) › 1. Aula.mp4"). Aqui:

- titulo:  "Insuficiência Cardíaca (Parte 1) — Aula 1"
- tipo:    Videoaula, Slide, Resumo, Apostila, Podcast, Pílula, ...
- tema:    assunto canônico, igual entre cursos ("Insuficiência Cardíaca"),
           para agrupar e pesquisar conteúdos de cursinhos diferentes juntos
- subtema: recorte específico da pasta ("Classificação, fisiopatologia ...")

O agrupamento em temas usa um dicionário curado (TEMAS abaixo) montado a
partir da leitura dos ~1.500 nomes de pasta do acervo. Idempotente: pode
rodar de novo quando a planilha for atualizada.
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / "public" / "seed-data" / "library-mapeamento.json"

CODES = {
    "CAR": "Cardiologia", "CIR": "Cirurgia", "END": "Endocrinologia", "GAS": "Gastroenterologia",
    "GIN": "Ginecologia", "HEP": "Hepatologia", "HEM": "Hematologia", "INF": "Infectologia",
    "NEF": "Nefrologia", "NEU": "Neurologia", "OBS": "Obstetrícia", "PED": "Pediatria", "PEDI": "Pediatria",
    "PNE": "Pneumologia", "PRE": "Preventiva", "PREV": "Preventiva", "PSI": "Psiquiatria", "PSQ": "Psiquiatria",
    "REU": "Reumatologia", "DER": "Dermatologia", "OFT": "Oftalmologia", "ORL": "Otorrinolaringologia",
    "OTO": "Otorrinolaringologia", "ORT": "Ortopedia", "URO": "Urologia", "CM": "Clínica Médica",
    "CX": "Cirurgia", "GO": "Ginecologia e Obstetrícia", "INT": "Medicina Intensiva", "EME": "Emergência",
}

# Pastas que só organizam (não dizem o assunto).
STRUCTURAL = re.compile(
    r"^(\d+\s*[-.]?\s*)?(bonus|bônus|aulas?|apostilas?|questoes|questões|videos|vídeos|imagens|slides?( das aulas)?|"
    r"materiais?|material complementar|resumos?|extras?|geral|curso|arquivos|pdfs?|mapas? mentais|flashcards|"
    r"podcasts?|revis[aã]o|livros?)$",
    re.I,
)

# Nome de arquivo genérico -> tipo.
GENERIC = [
    (r"aula|videoaula|v[ií]deo", "Videoaula"),
    (r"slides?", "Slide"),
    (r"resumo", "Resumo"),
    (r"apostila", "Apostila"),
    (r"podcast", "Podcast"),
    (r"p[ií]lula", "Pílula"),
    (r"resolu[cç][aã]o de quest[aã]o", "Resolução de questão"),
    (r"flashcards?", "Flashcards"),
    (r"demonstra[cç][aã]o", "Demonstração"),
    (r"caso da s[ée]rie", "Caso da série"),
    (r"outro olhar", "Outro olhar"),
    (r"mapa mental", "Mapa mental"),
    (r"introdu[cç][aã]o", "Introdução"),
]

KIND_BY_EXT = {"mp4": "Videoaula", "mov": "Videoaula", "mkv": "Videoaula", "webm": "Videoaula", "mp3": "Podcast", "m4a": "Podcast",
               "pdf": "PDF", "epub": "Capítulo de livro", "png": "Imagem", "jpg": "Imagem", "jpeg": "Imagem", "gif": "Imagem"}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm(s):
    s = s.replace("ª", "a").replace("º", "o")
    return re.sub(r"\s+", " ", strip_accents(s).lower()).strip()


def split_ext(name):
    name = name.strip()
    exts = []
    while True:
        m = re.search(r"\.([A-Za-z0-9]{2,4})$", name)
        if not m:
            break
        exts.append(m.group(1).lower())
        name = name[: m.start()]
    return name.strip(), (exts[0] if exts else "")


def expand_code(seg):
    """'CAR 2' -> 'Cardiologia 2'; 'Ped 1 - Neonatologia' -> 'Neonatologia'."""
    m = re.match(r"^([A-Za-z]{2,4})\s*(\d+)?\s*(?:-\s*(.+))?$", seg.strip())
    if m and m.group(1).upper() in CODES:
        if m.group(3):
            return m.group(3).strip(), CODES[m.group(1).upper()]
        return f"{CODES[m.group(1).upper()]}{' ' + m.group(2) if m.group(2) else ''}", CODES[m.group(1).upper()]
    return None, None


def smart_title(s):
    """Arruma CAIXA ALTA e 'Todas As Palavras Maiúsculas'."""
    words = s.split()
    if not words:
        return s
    upper_ratio = sum(1 for w in words if w.isupper() and len(w) > 3) / len(words)
    title_ratio = sum(1 for w in words if w[:1].isupper()) / len(words)
    small = {"de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o", "as", "os", "com", "por", "para", "à", "ao", "sem", "x"}
    if upper_ratio > 0.6 or (title_ratio > 0.9 and len(words) > 3):
        out = []
        for i, w in enumerate(words):
            lw = w.lower()
            if re.fullmatch(r"[A-Z]{2,5}", w) and upper_ratio <= 0.6:
                out.append(w)  # siglas: HAS, DPOC, GNRP
            elif i > 0 and lw in small:
                out.append(lw)
            else:
                out.append(lw[:1].upper() + lw[1:])
        return " ".join(out)
    return s[:1].upper() + s[1:]


ACCENT_FIX = {
    "Hipertensao": "Hipertensão", "Sistemica": "Sistêmica", "Pre-Operatorio": "Pré-Operatório", "Cancer": "Câncer",
    "Hepatico": "Hepático", "Esofago": "Esôfago", "Diverticulos": "Divertículos", "Divertuclos": "Divertículos",
    "Pediatrico": "Pediátrico", "Cirurgico": "Cirúrgico", "Diagnostico": "Diagnóstico", "Alteracoes": "Alterações",
    "Sintomaticas": "Sintomáticas", "Nefritica": "Nefrítica", "Preparaçao": "Preparação", "Diafragmatico": "Diafragmático",
    "Cranioencefalico": "Cranioencefálico", "Encefalica": "Encefálica", "Lesoes": "Lesões", "Especificas": "Específicas",
    "Hemodinamica": "Hemodinâmica", "Fistula": "Fístula", "Deiscencia": "Deiscência", "Hernias": "Hérnias",
    "Infancia": "Infância", "Laparoscopica": "Laparoscópica", "Plastica": "Plástica", "Ulceras": "Úlceras",
    "Pressao": "Pressão", "Cicatrizaçao": "Cicatrização", "Monitorizaçao": "Monitorização", "Anatomia do Esofago": "Anatomia do Esôfago",
    "Aleitamento Materno  Crescimento E Desenvolvimento": "Aleitamento Materno, Crescimento e Desenvolvimento",
    "Questoes": "Questões", "Infecçoes": "Infecções", "Pos-Operatorio": "Pós-Operatório", "Pos-Operatorias": "Pós-Operatórias",
    "Hemorragica": "Hemorrágica", "Hepatica": "Hepática", "Clinica": "Clínica", "Medica": "Médica", "Obstetricia": "Obstetrícia",
    "Neurologica": "Neurológica", "Transplante Hepatico": "Transplante Hepático",
}


def fix_accents(s):
    for a, b in ACCENT_FIX.items():
        s = re.sub(rf"\b{re.escape(a)}\b", b, s)
    return s


def clean_topic(seg):
    """'14. Insuficiência Cardíaca (Parte 1)Classificação Fisio...' -> (tema, subtitulo)."""
    s = seg.strip()
    s = re.sub(r"_linearized$", "", s)
    s = re.sub(r"^\d+\s*[-.)]?\s*", "", s)  # numeração
    s = re.sub(r"\s*-\s*\d{2}h\d{1,2}m\s*$", "", s)  # duração "- 00h58m"
    code_topic, _ = expand_code(s)
    if code_topic:
        s = code_topic
    sub = None
    # "(Parte 1)Classificação ..." -> subtítulo colado depois do parêntese
    m = re.match(r"^(.*?\))\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^()]{6,})$", s)
    if m and "(" in m.group(1):
        s, sub = m.group(1).strip(), m.group(2).strip()
    s = fix_accents(smart_title(s.replace("_", " ").strip()))
    if sub:
        sub = fix_accents(smart_title(sub))
    return s.strip(" -–"), sub


def generic_kind(stem):
    """Retorna (tipo, número) se o nome for genérico; senão None."""
    s = stem.strip()
    s_low = norm(s)
    num = None
    m = re.match(r"^(\d+)\s*[.)-]?\s*(.*)$", s_low)
    if m:
        num, rest = m.group(1), m.group(2).strip()
    else:
        rest = s_low
    if rest == "" and num is not None:
        return "Parte", num
    for pattern, kind in GENERIC:
        if re.fullmatch(pattern, strip_accents(rest)):
            return kind, num
    return None


def code_file(stem):
    """Nomes internos de plataforma: IDs numéricos, MAT..._IDAPOST, SBP, REV2024, bon2023."""
    if re.fullmatch(r"\d{4,}", stem):
        return ("id", stem)
    if re.match(r"(?i)^mat\d+_idapost\d+", stem):
        v = re.search(r"(?i)_v(\d+)$", stem)
        return ("apostila", v.group(1) if v else None)
    m = re.match(r"(?i)^\d{4}_PEDIATRIASBP_M(\d+)_A(\d+)(_CC)?", stem)
    if m:
        return ("sbp", ("Caso clínico" if m.group(3) else "Aula", m.group(2)))
    m = re.match(r"(?i)^REV\d{4}_VIDEOAULA_S\d+_\w+?_[A-Z]{2,4}\d_(.+)$", stem)
    if m:
        return ("rev", m.group(1).replace("_", " "))
    if re.match(r"(?i)^bon\d{4}_", stem):
        return ("bonus", None)
    m = re.match(r"(?i)^ap[eê]ndice\s+(\w+)\s*(\d*)$", stem)
    if m:
        return ("apendice", (m.group(1), m.group(2)))
    return None


# ---------------------------------------------------------------------------
# Temas canônicos (leitura dos nomes de pasta de todos os cursos). Ordem
# importa: o primeiro padrão que casar define o tema. Padrões sobre o texto
# normalizado (minúsculo, sem acento).
# ---------------------------------------------------------------------------
TEMAS = [
    # Cardiologia
    (r"insuficiencia cardiaca|edema agudo de pulmao", "Insuficiência Cardíaca"),
    (r"hipertensao arterial|crise hipertensiva|emergencias hipertensivas|renovascular|\bhas\b", "Hipertensão Arterial"),
    (r"sindromes? coronarian|\biam\b|infarto|angina|coronariopatia|doenca arterial coronariana|dor toracica", "Síndromes Coronarianas"),
    (r"arritmia|bradiarritmia|taquiarritmia|fibrilacao atrial|bloqueio(s)? atrioventricular|taquicardia", "Arritmias"),
    (r"valvopatia|valvulopatia|estenose (mitral|aortica)|insuficiencia (mitral|aortica)", "Valvopatias"),
    (r"endocardite", "Endocardite Infecciosa"),
    (r"pericardi|miocardite|miocardiopatia|cardiomiopatia", "Miocardiopatias e Pericardiopatias"),
    (r"dislipidemia|colesterol", "Dislipidemias"),
    (r"febre reumatica", "Febre Reumática"),
    (r"eletrocardiograma|\becg\b", "Eletrocardiograma"),
    (r"parada cardio|ressuscitacao|suporte (basico|avancado) de vida|\brcp\b|\bpcr\b", "Parada Cardiorrespiratória"),
    (r"sincope", "Síncope"),
    (r"cardiopatias? congenita", "Cardiopatias Congênitas"),
    # Pneumo
    (r"\basma\b", "Asma"),
    (r"\bdpoc\b|doenca pulmonar obstrutiva", "DPOC"),
    (r"pneumonia|\bpac\b", "Pneumonias"),
    (r"tuberculose", "Tuberculose"),
    (r"tromboembolismo pulmonar|\btep\b|trombose venosa|\btvp\b|tromboembolismo venoso", "Tromboembolismo Venoso"),
    (r"derrame pleural|pleura", "Derrame Pleural"),
    (r"cancer de pulmao|neoplasia(s)? (de|do) pulmao|neoplasias pulmonares|nodulo pulmonar", "Câncer de Pulmão e Nódulo Pulmonar"),
    (r"intersticia|sarcoidose|pneumoconiose", "Doenças Pulmonares Intersticiais"),
    (r"insuficiencia respiratoria|ventilacao mecanica|\bsdra\b", "Insuficiência Respiratória e Ventilação"),
    (r"tabagismo", "Tabagismo"),
    # Gastro / Hepato
    (r"hemorragia digestiva", "Hemorragia Digestiva"),
    (r"refluxo|\bdrge\b", "Doença do Refluxo Gastroesofágico"),
    (r"dispepsia|ulcera peptica|pylori|doenca ulcerosa|pos-?operacoes gastricas", "Dispepsia e Doença Ulcerosa Péptica"),
    (r"doenca(s)? inflamatoria(s)? intestina|crohn|retocolite", "Doenças Inflamatórias Intestinais"),
    (r"diarreia", "Diarreias"),
    (r"pancreatite", "Pancreatites"),
    (r"cirrose|hipertensao portal|ascite|encefalopatia hepatica|peritonite bacteriana", "Cirrose e Complicações"),
    (r"hepatite", "Hepatites"),
    (r"(cancer|neoplasia|tumor|tumores)( \w+)? (de |do |da )?(esofago|estomago|gastric)|adenocarcinoma gastric", "Câncer de Esôfago e Estômago"),
    (r"(cancer|neoplasia)s?( \w+)? (colorretal|de colon|do colon|do intestino)|polipo", "Câncer Colorretal e Pólipos"),
    (r"(cancer|neoplasia|tumor|tumores)( \w+)? (de |do )?pancreas|periampular", "Tumores de Pâncreas"),
    (r"figado|hepatocarcinoma|nodulo(s)? hepatico|tumores hepaticos", "Tumores Hepáticos"),
    (r"vias biliares|colelitiase|colecistite|colecistopatia|colangite|coledocolitiase|litiase biliar", "Doenças das Vias Biliares"),
    (r"esofago|acalasia|disfagia", "Doenças do Esôfago"),
    (r"doenca celiaca|ma absorcao|disabsorcao", "Síndromes Disabsortivas"),
    (r"transplante hepatico", "Transplante Hepático"),
    # Cirurgia
    (r"\btrauma|politrauma|atls|queimad", "Trauma"),
    (r"abdome agudo|apendicite|diverticulite|obstrucao intestinal|isquemia mesenterica", "Abdome Agudo"),
    (r"hernia", "Hérnias"),
    (r"pre-?operatorio|pos-?operatorio|risco cirurgico|complicacoes (pos|cirurg)|perioperatorio", "Pré e Pós-Operatório"),
    (r"cirurgia (infantil|pediatrica)|gastrocirurgia pediatrica", "Cirurgia Pediátrica"),
    (r"cirurgia vascular|aneurisma|doenca arterial periferica|insuficiencia venosa|varizes|isquemia (arterial|de membro)|obstrucao arterial|arterias viscerais|anatomia vascular|linfedema|anomalias vasculares", "Cirurgia Vascular"),
    (r"proctologia|hemorroid|fissura anal|fistula anal|abscesso anorretal|orificia|megacolon|canal anal|constipacao", "Proctologia"),
    (r"anestes", "Anestesiologia"),
    (r"cicatrizacao|feridas|ulceras? de pressao|fios de sutura", "Feridas e Cicatrização"),
    (r"suporte nutricional|nutricao (enteral|parenteral)|terapia nutricional", "Suporte Nutricional"),
    (r"bariatrica|obesidade", "Obesidade e Cirurgia Bariátrica"),
    (r"tireoide|tireoid|tireotox|hipotireoid|hipertireoid|nodulo(s)? (de )?tireoid", "Doenças da Tireoide"),
    (r"cabeca e pescoco|cisto tireoglosso|massa cervical", "Cabeça e Pescoço"),
    (r"sarcoma", "Sarcomas"),
    (r"cirurgia plastica", "Cirurgia Plástica"),
    (r"transplante", "Transplantes"),
    # Endócrino
    (r"diabetes|cetoacidose|hipoglicemia|estado hiperosmolar", "Diabetes Mellitus"),
    (r"adrena|suprarrena|cushing|addison|feocromocitoma|hiperaldosteronismo", "Doenças da Adrenal"),
    (r"hipofise|prolactin|acromegalia|hipopituitarismo|diabetes insipidus", "Doenças da Hipófise"),
    (r"paratireoide|calcio|hipercalcemia|osteoporose|osteometabolic", "Metabolismo do Cálcio e Osteoporose"),
    # Nefro
    (r"lesao renal aguda|injuria renal aguda|insuficiencia renal aguda", "Lesão Renal Aguda"),
    (r"doenca renal cronica|insuficiencia renal cronica|dialise", "Doença Renal Crônica"),
    (r"glomerul|sindrome nefr|hematuria|proteinuria", "Glomerulopatias"),
    (r"disturbio(s)? (do|de) (sodio|potassio|agua)|hiponatremia|hipernatremia|hipocalemia|hipercalemia|hidroeletrolit", "Distúrbios Hidroeletrolíticos"),
    (r"acido-?basic|acido-?base|acidobasic|acidose|alcalose|gasometria", "Distúrbios Ácido-Base"),
    (r"infeccao (do trato )?urinari|pielonefrite|\bitu\b", "Infecção do Trato Urinário"),
    (r"litiase|nefrolitiase|calculo renal|urolitiase", "Litíase Urinária"),
    (r"prostata|hiperplasia prostatica|\bhpb\b", "Doenças da Próstata"),
    (r"tumores? (renais|de rim|de bexiga)|cancer (renal|de bexiga)|neoplasias urologicas", "Tumores Urológicos"),
    # Infecto
    (r"\bhiv\b|\baids\b", "HIV/Aids"),
    (r"sepse|choque septico", "Sepse"),
    (r"\bchoque\b", "Choque"),
    (r"meningite|meningoencefalite", "Meningites"),
    (r"arbovirose|dengue|zika|chikungunya|febre amarela", "Arboviroses"),
    (r"sifilis|infeccoes sexualmente|\bist\b|\bdst\b|uretrite|cervicite", "Infecções Sexualmente Transmissíveis"),
    (r"hanseniase", "Hanseníase"),
    (r"leishmaniose|malaria|doenca de chagas|esquistossomose|parasitoses|helmint", "Doenças Parasitárias e Tropicais"),
    (r"infeccoes relacionadas a assistencia|\biras\b|infeccao hospitalar", "Infecções Relacionadas à Assistência"),
    (r"antibiotic|antimicrobian", "Antimicrobianos"),
    (r"endocardite", "Endocardite Infecciosa"),
    (r"covid|influenza|gripe|viroses respiratorias", "Viroses Respiratórias"),
    (r"acidentes? (por animais )?peconhentos|raiva", "Acidentes com Animais e Raiva"),
    (r"infeccoes? (de pele|cutane)|celulite|erisipela|piodermite", "Infecções de Pele"),
    # Hemato / Onco
    (r"anemia", "Anemias"),
    (r"leucemia|mielodisplas|mieloprolifer", "Leucemias e Neoplasias Mieloides"),
    (r"linfoma|mieloma", "Linfomas e Mieloma"),
    (r"hemostasia|coagulopatia|trombocitopenia|plaquetas|hemofilia|trombofilia|anticoagula", "Hemostasia e Trombose"),
    (r"transfus|hemoterapia|hemocomponent", "Hemoterapia"),
    (r"emergencias oncologicas|oncologia", "Oncologia"),
    # Reumato
    (r"lupus|\bles\b", "Lúpus Eritematoso Sistêmico"),
    (r"artrite reumatoide", "Artrite Reumatoide"),
    (r"espondil", "Espondiloartrites"),
    (r"gota|microcristal", "Artrites Microcristalinas"),
    (r"vasculite", "Vasculites"),
    (r"artrites? infecciosa|artrite septica", "Artrites Infecciosas"),
    (r"tecido conectivo|esclerose sistemica|esclerodermia|sjogren|miopatias inflamatorias|dermatomiosite", "Doenças do Tecido Conectivo"),
    (r"artropatias|osteoartrite|osteoartrose|fibromialgia|reumatismo", "Artropatias"),
    # Neuro
    (r"acidente vascular|\bavc\b|\bave\b|doencas? cerebrovascular", "Acidente Vascular Cerebral"),
    (r"epilepsia|convuls|estado de mal", "Epilepsia e Crises Convulsivas"),
    (r"cefaleia|enxaqueca", "Cefaleias"),
    (r"demencia|alzheimer", "Demências"),
    (r"parkinson|disturbios? do movimento", "Distúrbios do Movimento"),
    (r"neuropatia|polineuropatia|guillain|miastenia|esclerose (multipla|lateral)|doencas desmielinizantes|nervos perifericos|juncao neuromuscular", "Doenças Neuromusculares e Desmielinizantes"),
    (r"transtornos do sono|^sono$|insonia|apneia", "Distúrbios do Sono"),
    (r"coma|rebaixamento do nivel|delirium", "Coma e Delirium"),
    (r"semiologia neurologica", "Semiologia Neurológica"),
    (r"tce|traumatismo cranio|hipertensao intracraniana", "Trauma Cranioencefálico"),
    # Psiquiatria
    (r"depress|transtornos? do humor|bipolar", "Transtornos do Humor"),
    (r"ansiedade|panico|toc\b|estresse pos", "Transtornos de Ansiedade"),
    (r"esquizofrenia|psicose|psicotico", "Psicoses"),
    (r"alcool|dependencia quimica|substancias psicoativas|drogas", "Transtornos por Uso de Substâncias"),
    (r"suicidio", "Suicídio"),
    (r"psicofarmac|antidepressivo|antipsicotico", "Psicofarmacologia"),
    (r"transtornos? (alimentares|de personalidade|do desenvolvimento|somatoformes|conversivos)|tdah|autismo", "Outros Transtornos Mentais"),
    # Ginecologia
    (r"amenorreia", "Amenorreias"),
    (r"anticoncep|contracep|planejamento familiar", "Anticoncepção"),
    (r"climaterio|menopausa", "Climatério"),
    (r"endometriose", "Endometriose"),
    (r"infertilidade", "Infertilidade"),
    (r"sangramento uterino|miomatose|mioma|pólipo endometrial|hiperplasia endometrial", "Sangramento Uterino Anormal e Miomas"),
    (r"(cancer|neoplasia)s? (de )?(colo|cervical)|\bhpv\b|neoplasias? intraepitelia|rastreamento do cancer de colo", "Câncer de Colo e HPV"),
    (r"(cancer|neoplasia|tumor)s? (de )?(endometrio|corpo uterino)", "Câncer de Endométrio"),
    (r"(cancer|neoplasia|tumor|tumores)s? (de )?ovari|massas anexiais", "Tumores de Ovário"),
    (r"mama|mastologia|mastite|mamografia", "Mastologia"),
    (r"vulvovaginite|corrimento|vaginose|doenca inflamatoria pelvica|\bdip\b", "Infecções Genitais"),
    (r"sindrome dos ovarios policisticos|\bsop\b|hiperandrogenismo", "Síndrome dos Ovários Policísticos"),
    (r"prolapso|incontinencia urinaria|uroginecologia|distopia", "Uroginecologia"),
    (r"violencia sexual", "Violência Sexual"),
    (r"(cancer|neoplasia)s? (de )?vulva", "Câncer de Vulva"),
    (r"ciclo menstrual|fisiologia menstrual|puberdade|amenorr", "Ciclo Menstrual e Puberdade"),
    # Obstetrícia
    (r"pre-?natal|assistencia pre-?natal", "Pré-Natal"),
    (r"hipertens(ao|ivas)? (na )?gest|pre-?eclampsia|eclampsia|sindrome hellp", "Síndromes Hipertensivas da Gestação"),
    (r"diabetes (gestacional|na gestacao)", "Diabetes na Gestação"),
    (r"(hemorragi\w*|sangramentos?) da (primeira|1a) metade|abort|gravidez ectopica|gestacao ectopica|doenca trofoblastica|mola", "Sangramentos da 1ª Metade da Gestação"),
    (r"(hemorragi\w*|sangramentos?) da (segunda|2a) metade|placenta previa|descolamento prematuro|dpp\b|rotura uterina", "Sangramentos da 2ª Metade da Gestação"),
    (r"parto|trabalho de parto|partograma|mecanismo de parto|bacia obstetrica|estatica fetal|cesare|cesari|forcipe|forceps|pos-?datismo|gestacao prolongada", "Parto"),
    (r"puerperio|hemorragia pos-?parto|infeccao puerperal", "Puerpério"),
    (r"prematur|trabalho de parto prematuro|rotura prematura|amniorrexe|\brpmo\b", "Prematuridade e Rotura de Membranas"),
    (r"vitalidade fetal|sofrimento fetal|cardiotocografia|perfil biofisico|doppler", "Vitalidade Fetal"),
    (r"infeccoes (congenitas|na gestacao)|toxoplasmose|sifilis (na gestacao|congenita)|rubeola|citomegalovirus", "Infecções na Gestação"),
    (r"ultrassom|ultrassonografia", "Ultrassonografia Obstétrica"),
    (r"gemelar|gestacao multipla", "Gestação Gemelar"),
    (r"aloimunizacao|isoimunizacao|\brh\b", "Aloimunização Rh"),
    (r"modificacoes (fisiologicas|gravidicas|locais|sistemicas)|organismo materno|fisiologia da gestacao|diagnostico de gravidez|embriologia|placenta|oligodramnio|polidramnio|liquido amniotico", "Fisiologia da Gestação"),
    (r"crescimento intrauterino|\brciu\b|restricao de crescimento", "Restrição de Crescimento Fetal"),
    (r"farmacos na gestacao|medicamentos na gestacao|teratogen", "Fármacos na Gestação"),
    # Pediatria
    (r"neonat|recem-?nascido|reanimacao neonatal|ictericia neonatal|periodo neonatal|perinatal", "Neonatologia"),
    (r"aleitamento|amamentacao", "Aleitamento Materno"),
    (r"crescimento|desenvolvimento|puericultura|baixa estatura", "Crescimento e Desenvolvimento"),
    (r"imuniza|vacina|calendario vacinal", "Imunizações"),
    (r"doencas exantematicas|exantema|sarampo|varicela|escarlatina", "Doenças Exantemáticas"),
    (r"infeccoes (respiratorias|de vias aereas|das vias aereas)|vias aereas superiores|bronquiolite|laringite|epiglotite|otite|sinusite|faringite|coqueluche", "Infecções Respiratórias na Infância"),
    (r"desidratacao|diarreia aguda|terapia de reidratacao", "Diarreia e Desidratação"),
    (r"desnutricao|obesidade infantil|nutrologia|alimentacao", "Nutrição Infantil"),
    (r"kawasaki", "Doença de Kawasaki"),
    (r"maus-?tratos|violencia (contra|na) (crianca|infancia)", "Maus-Tratos na Infância"),
    (r"intoxica|toxicologia", "Intoxicações"),
    (r"emergencias pediatricas|pals", "Emergências Pediátricas"),
    (r"adolesc", "Saúde do Adolescente"),
    (r"erros inatos|imunodeficiencia|imunologia", "Imunodeficiências"),
    # Preventiva
    (r"epidemiolog|estudos? (de coorte|caso-controle|transversais?|ecologicos)|medidas de associacao|bioestatistica|estatistica|testes diagnosticos|metodos diagnosticos|vies|medidas de frequencia", "Epidemiologia"),
    (r"\bsus\b|politicas de saude|atencao primaria|estrategia (de )?saude da familia|legislacao|financiamento", "SUS e Políticas de Saúde"),
    (r"vigilancia|notificacao|epidemia|endemia|pandemia|sistemas de informacao", "Vigilância em Saúde"),
    (r"saude do trabalhador|\bnr\s?\d+|normas regulamentadoras|acidente de trabalho|ocupacional", "Saúde do Trabalhador"),
    (r"etica|bioetica|codigo de etica|atestado|declaracao de obito", "Ética e Documentos Médicos"),
    (r"medicina de familia|mfc|abordagem familiar|genograma", "Medicina de Família"),
    (r"rastreamento|prevencao (primaria|quaternaria)|niveis de prevencao", "Prevenção e Rastreamento"),
    (r"transicao demografica|indicadores de saude|mortalidade", "Indicadores de Saúde"),
    # Derma / Oftalmo / Otorrino / Ortopedia
    (r"dermatos|dermatite|dermatolog|eczem|eritemato|psoriase|pele|melanoma|carcinoma basocelular|farmacodermia|acne|micoses superficiais", "Dermatologia"),
    (r"glaucoma|catarata|retin|olho vermelho|conjuntiv|cornea|cristalino|orbita|palpebra|uveite|estrabismo|oftalmo|acuidade visual", "Oftalmologia"),
    (r"otite|rinite|rinossinusite|sinusite|faringotonsilite|surdez|presbiacusia|vertigem|laringe|otorrino|\\botolog|\\brinolog|\\bfaringo", "Otorrinolaringologia"),
    (r"fratura|luxacao|ortoped|quadril|coluna|lombalgia|osteomielite|osteoarticular|osteomioarticular|tumores osseos|metabolismo osseo|pe torto|escoliose|joelho|ombro", "Ortopedia"),
    # Intensiva / Emergência
    (r"sedacao|analgesia|delirium na uti|intensiv|\buti\b", "Medicina Intensiva"),
    (r"envelhecimento|idoso|geriatr|fragilidade|quedas|polifarmacia|imobilizacao", "Geriatria"),
    (r"anafilaxia|urticaria|alergia", "Alergia e Anafilaxia"),
    (r"neoplasias em pediatria|oncologia pediatrica|tumores (solidos )?na infancia", "Oncologia Pediátrica"),
    (r"artrite idiopatica juvenil|\baij\b", "Artrite Idiopática Juvenil"),
    (r"acessos? venos|instrumentacao|paramentacao|videolaparoscopia|procedimentos (abdominais|toracicos)|retalhos|acesso cirurgico|via(s)? aerea(s)?$|cirurgia toracica", "Técnica Cirúrgica e Procedimentos"),
    (r"hemocromatose|wilson|hepatopatia|funcao hepatica|abscessos hepaticos|cistos e abscessos|hepatoesplenomegalia", "Hepatopatias"),
    (r"hemograma|pancitopenia|baco|neutropenia", "Hematologia Geral"),
    (r"intoxicac", "Intoxicações"),
]
TEMAS_RE = [(re.compile(p), t) for p, t in TEMAS]


def canonical_tema(*texts):
    for text in texts:
        if not text:
            continue
        n = norm(text)
        for rx, tema in TEMAS_RE:
            if rx.search(n):
                return tema
    return None


def process(item):
    segs = [s.strip() for s in item["conteudo"].split("›")]
    name, folders = segs[-1], segs[:-1]
    stem, ext = split_ext(name)
    stem = re.sub(r"_linearized$", "", stem)

    # Pasta de assunto mais próxima (ignora pastas estruturais).
    topic_seg, specialty = None, None
    for seg in reversed(folders):
        if STRUCTURAL.match(seg.strip()):
            continue
        topic_seg = seg
        break
    for seg in folders:
        _, sp = expand_code(seg)
        if sp:
            specialty = sp
            break
    topic, subtitle = clean_topic(topic_seg) if topic_seg else (None, None)
    code_topic, code_specialty = expand_code(re.sub(r"^\d+\s*[-.)]?\s*", "", topic_seg.strip())) if topic_seg else (None, None)
    topic_is_code = bool(code_specialty) and not re.search(r"-\s*\S", topic_seg or "")
    area_label = re.sub(r"\s*-\s*(Extensivo|Intensivo).*$", "", item["area"]).strip()
    context = topic or area_label

    tipo = KIND_BY_EXT.get(ext, "Material")
    titulo = None
    in_questoes = any(re.match(r"(?i)quest", s) for s in folders)

    g = generic_kind(stem)
    code = code_file(stem)
    if code:
        kind, val = code
        if kind == "id":
            if tipo == "Imagem":
                tipo, titulo = "Imagem de questão", f"{context} — imagem de questão {val}"
            else:
                tipo = "Resolução de questão" if in_questoes or tipo == "Videoaula" else tipo
                titulo = f"{context} — {'resolução de questão' if tipo == 'Resolução de questão' else 'arquivo'} {val}"
        elif kind == "apostila":
            tipo, titulo = "Apostila", f"{context} — Apostila{' (v' + val + ')' if val else ''}"
        elif kind == "sbp":
            label, n = val
            tipo = "Caso clínico" if label == "Caso clínico" else "Videoaula"
            titulo = f"{context}" if topic else f"{area_label} — {label} {n}"
        elif kind == "rev":
            tipo, titulo = "Videoaula", fix_accents(smart_title(val.strip()))
            topic, subtitle = titulo, None
        elif kind == "bonus":
            tipo, titulo = "Material bônus", f"{context} — material bônus"
        elif kind == "apendice":
            sigla, n = val
            nome = CODES.get(sigla.upper(), sigla.title())
            tipo, titulo = "Apêndice", f"Apêndice — {nome}{' ' + n if n else ''}"
    elif g:
        kind, num = g
        if kind == "Parte":
            titulo = f"{context} — {'Aula' if tipo == 'Videoaula' else 'Parte'} {num}"
        else:
            tipo = kind if not (kind == "Videoaula" and tipo != "Videoaula") else tipo
            titulo = f"{context} — {kind}{' ' + num if num else ''}"
    else:
        # Nome já descritivo: limpa numeração, duração e marcações de tipo.
        clean = stem
        m = re.search(r"\((Cap[ií]tulo de Livro|Mapa Mental)\)\s*$", clean, re.I)
        if m:
            tipo = "Capítulo de livro" if m.group(1).lower().startswith("cap") else "Mapa mental"
            clean = clean[: m.start()].strip().lstrip("_")
            clean = f"{clean} — {tipo}"
        clean = re.sub(r"^\d+\s*[-.)]?\s*", "", clean)
        clean = re.sub(r"\s*-\s*\d{2}h\d{1,2}m\s*$", "", clean)
        clean = re.sub(r"_anota[cç][aã]o$", " (slides anotados)", clean, flags=re.I)
        clean = clean.replace("_", " ").strip()
        titulo = fix_accents(smart_title(clean)) if clean else context
        if re.search(r"(?i)caso cl[ií]nico", clean):
            tipo = "Caso clínico"
        if item["curso"].startswith("PROVAS") and tipo == "PDF":
            tipo = "Banco de questões" if "Banco" in item["area"] else "Prova"
        if tipo == "PDF":
            tipo = "Apostila" if re.search(r"(?i)apostila|livro|tratado|volume", clean) else "PDF"

    descriptive = not g and not code
    if descriptive:
        code_name, _ = expand_code(titulo)
        if code_name:
            titulo = code_name
    # Tema canônico: do mais específico (título descritivo, pasta) para o mais geral.
    tema = canonical_tema(titulo if descriptive else None, topic, subtitle, *reversed(folders))
    # Título descritivo porém vago ("Diagnóstico e tratamento"): prefixa o assunto da pasta.
    if descriptive and topic and not canonical_tema(titulo) and norm(topic) not in norm(titulo) and len(titulo.split()) <= 5:
        titulo = f"{topic} — {titulo}"
    subtema = topic if topic and topic != tema else subtitle
    if not tema and topic_is_code:
        # Pasta só com o código do módulo ("CAR 2"): tema = especialidade.
        tema, subtema = code_specialty, f"{topic} ({item['curso'].split()[0].title()})"
    if not tema:
        tema = topic or (specialty if specialty else None) or area_label
    if subtema and norm(subtema) == norm(tema):
        subtema = subtitle
    return {"titulo": titulo, "tipo": tipo, "tema": tema, **({"subtema": subtema} if subtema else {})}


def main():
    items = json.loads(FILE.read_text(encoding="utf-8"))
    for it in items:
        for k in ("titulo", "tipo", "tema", "subtema"):
            it.pop(k, None)
        it.update(process(it))
    FILE.write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    temas = Counter(it["tema"] for it in items)
    cursos_por_tema = defaultdict(set)
    for it in items:
        cursos_por_tema[it["tema"]].add(it["curso"])
    print(f"{len(items)} arquivos -> {FILE.relative_to(ROOT)} ({FILE.stat().st_size / 1e6:.1f} MB)")
    print(f"{len(temas)} temas; {sum(1 for t in temas if len(cursos_por_tema[t]) > 1)} reúnem mais de um curso")
    if "--report" in sys.argv:
        for t, n in temas.most_common():
            print(f"{n:5d}  {len(cursos_por_tema[t])}c  {t}")


if __name__ == "__main__":
    sys.exit(main())
