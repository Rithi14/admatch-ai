"""Server-side URL and SSRF guardrails. Revalidates each redirect target."""
import ipaddress
import socket
from urllib.parse import urlparse
import httpx

class UnsafeURLError(ValueError):
    pass

def validate_public_http_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeURLError("Only http and https URLs are supported.")
    if not parsed.hostname:
        raise UnsafeURLError("A valid hostname is required.")
    if parsed.username or parsed.password:
        raise UnsafeURLError("URLs containing credentials are not allowed.")
    host = parsed.hostname.lower().rstrip(".")
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".localhost") or host.endswith(".local"):
        raise UnsafeURLError("Local and private network destinations are not allowed.")
    try:
        addresses = {ipaddress.ip_address(host)}
    except ValueError:
        try:
            addresses = {ipaddress.ip_address(item[4][0]) for item in socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)}
        except socket.gaierror:
            # Permit fictional .example domains only for dataset lookup; actual fetch will fail safely.
            if host.endswith(".example"):
                return url
            raise UnsafeURLError("The hostname could not be resolved.")
    if not addresses or any(not address.is_global for address in addresses):
        raise UnsafeURLError("Private, loopback, link-local, and reserved IP addresses are not allowed.")
    return url

async def fetch_public_page(url: str, timeout: float, max_bytes: int) -> str:
    current = url
    for _ in range(4):
        validate_public_http_url(current)
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout, headers={"User-Agent": "AdMatchAI/1.0 (message-match audit)"}) as client:
            async with client.stream("GET", current) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise UnsafeURLError("The page redirected without a destination.")
                    from urllib.parse import urljoin
                    current = urljoin(current, location)
                    continue
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").lower()
                if "text/html" not in content_type and "text/plain" not in content_type:
                    raise UnsafeURLError("The URL did not return an HTML or text page.")
                chunks, total = [], 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > max_bytes:
                        raise UnsafeURLError("The landing page is larger than the allowed size.")
                    chunks.append(chunk)
                return b"".join(chunks).decode(response.encoding or "utf-8", errors="replace")
    raise UnsafeURLError("Too many redirects.")
