"""
Quality gate for CV extraction.

The goal is to prevent a rich original attachment from being accepted as a
successful processing result when the structured Mongo fields are sparse.
"""
import re
import unicodedata


EXPERIENCE_HEADINGS = [
    "experiencia profissional",
    "experiencias profissionais",
    "historico profissional",
    "trajetoria profissional",
    "atuacao profissional",
    "professional experience",
    "work experience",
]

STOP_HEADINGS = [
    "formacao",
    "formacao academica",
    "educacao",
    "cursos",
    "certificacoes",
    "conhecimentos tecnicos",
    "conhecimento tecnico",
    "habilidades",
    "skills",
    "idiomas",
    "languages",
    "informacoes adicionais",
    "dados pessoais",
]

DETAIL_MARKERS = [
    "atividade",
    "atividades",
    "rotina",
    "rotinas",
    "responsavel",
    "responsabilidades",
    "projeto",
    "projetos",
    "tecnologia",
    "tecnologias",
    "resultado",
    "resultados",
    "implantacao",
    "implementacao",
    "desenvolvimento",
    "sustentacao",
    "manutencao",
    "gestao",
    "lideranca",
]


def _sanitize(value):
    text = str(value or "")
    text = re.sub(r"[\ud800-\udfff]", "", text)
    text = text.replace("\r", "\n")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _normalize(value):
    normalized = unicodedata.normalize("NFD", str(value or ""))
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _line_key(value):
    return _normalize(value)


def _is_heading(line, aliases):
    key = _line_key(line)
    if not key or len(key) > 90:
        return False
    return any(key == alias or key.startswith(f"{alias} ") for alias in aliases)


def _extract_experience_section(text):
    lines = [_sanitize(line) for line in str(text or "").splitlines()]
    lines = [line for line in lines if line]
    collecting = False
    parts = []

    for line in lines:
        if _is_heading(line, EXPERIENCE_HEADINGS):
            collecting = True
            remainder = re.sub(r"^[^:|\-]{3,90}[:|\-]\s*", "", line).strip()
            if remainder and _normalize(remainder) != _normalize(line):
                parts.append(remainder)
            continue

        if collecting and _is_heading(line, STOP_HEADINGS):
            break

        if collecting:
            parts.append(line)

    return "\n".join(parts).strip()


def _count_bullets(text):
    return len(re.findall(r"(?:^|\n)\s*(?:[•\-*]|\d+[.)])\s+", str(text or "")))


def _count_detail_markers(text):
    normalized = _normalize(text)
    return sum(1 for marker in DETAIL_MARKERS if marker in normalized)


def _count_company_period_markers(text):
    return len(re.findall(
        r"\b(?:19|20)\d{2}\b|"
        r"\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[/\s-]*(?:19|20)?\d{2}\b|"
        r"\b(?:empresa|company|cargo|cliente|consultor|analista|gerente|coordenador|desenvolvedor)\b",
        _normalize(text),
    ))


def _metrics(candidate_data):
    original_text = _sanitize(candidate_data.get("Texto_Integral_Original", ""))
    structured_experience = _sanitize(candidate_data.get("Experiencia_Profissional", ""))
    experience_section = _extract_experience_section(original_text) or original_text

    return {
        "original_chars": len(original_text),
        "source_experience_chars": len(experience_section),
        "source_bullets": _count_bullets(experience_section),
        "source_detail_markers": _count_detail_markers(experience_section),
        "source_company_period_markers": _count_company_period_markers(experience_section),
        "structured_experience_chars": len(structured_experience),
        "structured_bullets": _count_bullets(structured_experience),
        "structured_detail_markers": _count_detail_markers(structured_experience),
        "structured_company_period_markers": _count_company_period_markers(structured_experience),
    }


def _is_source_rich(metrics):
    return (
        metrics["source_experience_chars"] >= 1800
        or metrics["source_bullets"] >= 8
        or (
            metrics["source_detail_markers"] >= 4
            and metrics["source_company_period_markers"] >= 8
            and metrics["source_experience_chars"] >= 900
        )
    )


def _is_structured_sparse(metrics):
    return (
        metrics["structured_experience_chars"] < 900
        or (
            metrics["structured_bullets"] < 4
            and metrics["structured_detail_markers"] < 4
            and metrics["structured_company_period_markers"] < 6
        )
    )


def validate_cv_quality(candidate_data):
    """
    Return a dict with pass/fail, issues and metrics.

    The gate fails only when there is enough original text to prove that the CV
    has rich experience content and the extracted structured experience is too
    sparse to be trusted.
    """
    metrics = _metrics(candidate_data)
    issues = []
    warnings = []

    if metrics["original_chars"] < 300:
        warnings.append("texto_integral_original_indisponivel_ou_curto")

    source_rich = _is_source_rich(metrics)
    structured_sparse = _is_structured_sparse(metrics)

    if source_rich and structured_sparse:
        issues.append("experiencia_profissional_incompleta_frente_ao_anexo_original")

    if (
        source_rich
        and metrics["source_experience_chars"] > 0
        and metrics["structured_experience_chars"] < metrics["source_experience_chars"] * 0.25
    ):
        issues.append("experiencia_profissional_menor_que_25_porcento_da_fonte")

    if (
        metrics["source_detail_markers"] >= 5
        and metrics["structured_detail_markers"] <= 1
        and metrics["structured_experience_chars"] < 1400
    ):
        issues.append("detalhes_de_atividade_rotina_projeto_ou_tecnologia_nao_preservados")

    passed = not issues
    return {
        "passed": passed,
        "status": "ok" if passed else "erro_qualidade_cv",
        "issues": sorted(set(issues)),
        "warnings": sorted(set(warnings)),
        "metrics": metrics,
    }
