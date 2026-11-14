"""Renders the mannequin pictures and body-shading maps with headless Chrome + three.js.

Setup (once), in a work folder WORK:
    git clone --depth 1 https://github.com/makehumancommunity/makehuman WORK/makehuman   (CC0 assets)
    cd WORK && npm install three three-subdivide
    python3 scripts/mannequin/mesh.py WORK/makehuman/makehuman/data WORK/build
    cp scripts/mannequin/render3d.html WORK/ && (cd WORK && python3 -m http.server 8765 &)
Then:
    python3 scripts/mannequin/render3d.py [name ...]
    python3 scripts/mannequin/rig.py WORK/build
"""
import asyncio, base64, math, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).parent.parent.parent
PUB = ROOT / 'public' / 'mannequins'
FRAME = [-0.45, 0.45, -0.05, 1.95]
W, H = 972, 2160

JOBS = {}
for g in ('female', 'male'):
    for view, yaw in (('front', 0.0), ('back', math.pi)):
        JOBS[f'{g}-{view}'] = dict(url=f'/build/{g}.json', yaw=yaw, samples=110, ss=2, exposure=1.45)
        JOBS[f'shade-{g}-{view}'] = dict(url=f'/build/{g}.json', yaw=yaw, samples=64, ss=1, mode='shade', inflate=0.016, exposure=2.2)


async def main(names):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'])
        page = await b.new_page()
        page.set_default_timeout(0)
        await page.goto('http://localhost:8765/render3d.html')
        await page.wait_for_timeout(1500)
        for name in names:
            t = time.time()
            o = dict(width=W, height=H, frame=FRAME, subdivide=1, **JOBS[name])
            url = await page.evaluate('(o) => window.renderFigure(o)', o)
            (PUB / f'{name}.png').write_bytes(base64.b64decode(url.split(',', 1)[1]))
            print(name, f'{time.time() - t:.0f}s', flush=True)
        await b.close()


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:] or list(JOBS)))
