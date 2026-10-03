import json
import re
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape

BASE_URL = "https://www.skateparks-new-york.online"
DATA_FILE = Path("data/skateparks.json")

def slugify(value):
    value = str(value).strip().lower()

    # Convert accented characters to plain ASCII
    value = value.encode("ascii", "ignore").decode()

    # Match your JavaScript slugify() behavior
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")

with DATA_FILE.open(encoding="utf-8") as file:
    parks = json.load(file)

urls = [
    f"{BASE_URL}/",
    f"{BASE_URL}/legal.html",
    f"{BASE_URL}/privacy.html",
]

for park in parks:
    if "park_name" not in park:
        continue

    slug = slugify(park["park_name"])
    url = f"{BASE_URL}/detail.html?park={quote(slug)}"
    urls.append(url)

xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
"""

for url in urls:
    xml += f"  <url>\n    <loc>{escape(url)}</loc>\n  </url>\n"

xml += "</urlset>\n"

Path("sitemap.xml").write_text(xml, encoding="utf-8")

print(f"Created sitemap.xml with {len(urls)} URLs.")
print(f"Found {len(urls) - 3} park pages.")

