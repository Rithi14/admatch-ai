from bs4 import BeautifulSoup

def extract_page_content(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    for element in soup(["script", "style", "noscript", "svg", "template"]):
        element.decompose()
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    headings = [node.get_text(" ", strip=True) for node in soup.find_all(["h1", "h2", "h3"]) if node.get_text(" ", strip=True)]
    main = soup.find("main") or soup.find("article") or soup.body or soup
    text = " ".join(main.stripped_strings)
    text = " ".join(text.split())
    return {"title": title, "headings": headings[:80], "text": text}
