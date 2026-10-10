
import re
from bs4 import BeautifulSoup


def extract_page_content(html: str) -> dict:
    soup = BeautifulSoup(html or "", "html.parser")

    for element in soup(
        ["script", "style", "noscript", "svg", "template"]
    ):
        element.decompose()

    title = soup.title.get_text(" ", strip=True) if soup.title else ""

    main = soup.find("main") or soup.find("article") or soup.body or soup

    headings = [
        node.get_text(" ", strip=True)
        for node in main.find_all(["h1", "h2", "h3"])
        if node.get_text(" ", strip=True)
    ][:80]

    sections = []
    current_name = "Main content"
    current_parts = []

    def save_section(name, parts):
        text = " ".join(" ".join(parts).split())
        if text:
            sections.append({
                "name": name,
                "text": text,
                "sentences": [
                    sentence.strip()
                    for sentence in re.split(r"(?<=[.!?])\s+", text)
                    if sentence.strip()
                ],
            })

    for element in main.find_all(
        ["h1", "h2", "h3", "p", "li"],
        recursive=True,
    ):
        text = element.get_text(" ", strip=True)
        if not text:
            continue

        if element.name in ["h1", "h2", "h3"]:
            save_section(current_name, current_parts)
            current_name = text
            current_parts = []
        else:
            current_parts.append(text)

    save_section(current_name, current_parts)

    text = " ".join(main.stripped_strings)
    text = " ".join(text.split())

    if not sections and text:
        sections = [{
            "name": "Main content",
            "text": text,
            "sentences": [
                sentence.strip()
                for sentence in re.split(r"(?<=[.!?])\s+", text)
                if sentence.strip()
            ],
        }]

    return {
        "title": title,
        "headings": headings,
        "text": text,
        "sections": sections[:100],
    }