import re
from dataclasses import dataclass


ALIASES: dict[str, set[str]] = {
    "java": {"java", "core java"},
    "rest api": {"rest api", "rest apis", "restful api", "restful apis"},
    "sql": {"sql", "mysql", "dbms", "database concepts", "database"},
    "spring": {"spring boot", "spring framework", "spring"},
    "git": {"git", "github", "version control"},
    "javascript": {"javascript", "js"},
    "react": {"react", "react.js", "reactjs"},
    "node.js": {"node", "node.js"},
    "express": {"express", "express.js"},
    "oop": {"oop", "oops", "object-oriented programming", "object oriented programming"},
    "jpa": {"jpa", "hibernate", "orm"},
    "jdbc": {"jdbc"},
    "python": {"python"},
    "typescript": {"typescript", "ts"},
    "mongodb": {"mongodb", "mongo db"},
    "postgresql": {"postgresql", "postgres"},
    "docker": {"docker"},
    "aws": {"aws", "amazon web services"},
    "html": {"html"},
    "css": {"css"},
    "fastapi": {"fastapi"},
    "django": {"django"},
    "flask": {"flask"},
}

RELATED: dict[str, set[str]] = {
    "jpa": {"jdbc", "sql", "java", "spring"},
    "spring": {"java", "rest api"},
    "rest api": {"express", "node.js", "spring", "fastapi", "django", "flask"},
    "sql": {"jdbc", "jpa", "postgresql", "mongodb"},
    "react": {"javascript", "typescript", "html", "css"},
    "node.js": {"javascript", "express", "rest api"},
    "express": {"node.js", "javascript", "rest api"},
}

PARTIAL_WEIGHTS: dict[str, dict[str, float]] = {
    "jpa": {"spring": 0.72, "jdbc": 0.62, "sql": 0.58, "java": 0.40},
    "spring": {"java": 0.52, "rest api": 0.45},
    "rest api": {"spring": 0.60, "express": 0.55, "node.js": 0.50, "fastapi": 0.55, "django": 0.50, "flask": 0.50},
    "sql": {"jdbc": 0.70, "jpa": 0.60, "postgresql": 0.70, "mongodb": 0.35},
    "react": {"javascript": 0.55, "typescript": 0.55, "html": 0.35, "css": 0.35},
    "node.js": {"javascript": 0.45, "express": 0.70, "rest api": 0.50},
    "express": {"node.js": 0.70, "javascript": 0.45, "rest api": 0.55},
}


@dataclass
class SkillMatchResult:
    requiredSkill: str
    resumeSkill: str
    matchType: str
    score: float


def _variants() -> dict[str, str]:
    return {alias: canonical for canonical, aliases in ALIASES.items() for alias in aliases}


def canonical_label(skill: str) -> str:
    return {
        "java": "Java",
        "rest api": "REST APIs",
        "sql": "SQL / Database Concepts",
        "spring": "Spring",
        "git": "Git / Version Control",
        "javascript": "JavaScript",
        "react": "React",
        "node.js": "Node.js",
        "express": "Express",
        "oop": "OOP",
        "jpa": "Hibernate / JPA",
        "jdbc": "JDBC",
        "python": "Python",
        "typescript": "TypeScript",
        "mongodb": "MongoDB",
        "postgresql": "PostgreSQL",
        "docker": "Docker",
        "aws": "AWS",
        "html": "HTML",
        "css": "CSS",
        "fastapi": "FastAPI",
        "django": "Django",
        "flask": "Flask",
    }.get(skill, skill.title())


def extract_skills(text: str) -> list[str]:
    lowered = text.lower()
    found: set[str] = set()
    for alias, canonical in _variants().items():
        pattern = rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])"
        if re.search(pattern, lowered):
            found.add(canonical)
    return sorted(found)


def match_required_skills(required: list[str], resume: list[str]) -> tuple[list[SkillMatchResult], list[str], list[SkillMatchResult]]:
    resume_set = set(resume)
    matched: list[SkillMatchResult] = []
    partial: list[SkillMatchResult] = []
    missing: list[str] = []

    for required_skill in required:
        if required_skill in resume_set:
            matched.append(SkillMatchResult(required_skill, required_skill, "exact", 1.0))
            continue

        related = RELATED.get(required_skill, set()) & resume_set
        if related:
            weighted = sorted(
                ((skill, PARTIAL_WEIGHTS.get(required_skill, {}).get(skill, 0.45)) for skill in related),
                key=lambda item: item[1],
                reverse=True,
            )
            resume_skill, score = weighted[0]
            partial.append(SkillMatchResult(required_skill, resume_skill, "partial", score))
            missing.append(required_skill)
        else:
            missing.append(required_skill)

    return matched, missing, partial
