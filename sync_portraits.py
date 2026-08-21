# 리소스팩 최신본에서 캐릭터 초상화를 가져와 client/Resource/character 에 "없는 파일만" 추가.
# 기존 파일은 절대 덮어쓰지 않는다 — 사이트는 0.png 등 일부를 본섭과 다른 이미지로 쓰기 때문.
import os, zipfile

PACK = r"C:\Users\a4san\Desktop\서버\자비스\resourcepack\_texture_veryHigh.zip"
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "client", "Resource", "character")
PREFIX = "assets/gcb/textures/item/icon/"

z = zipfile.ZipFile(PACK)
added = 0
for name in z.namelist():
    if not (name.startswith(PREFIX) and name.endswith(".png")):
        continue
    fname = name[len(PREFIX):]
    if "/" in fname:
        continue
    out = os.path.join(DEST, fname)
    if os.path.exists(out):
        continue
    with open(out, "wb") as f:
        f.write(z.read(name))
    print("+", fname)
    added += 1
print(f"done: {added} added (existing files untouched)")
