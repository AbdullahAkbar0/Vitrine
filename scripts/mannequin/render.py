"""Renders the glossy black mannequins to transparent PNGs using headless Chrome.

Usage: python3 scripts/mannequin/render.py [name ...]
Outputs go to public/mannequins/ (and scripts/mannequin/out/ for logo parts).
"""
import asyncio, base64, json, math, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PUB = ROOT / 'public' / 'mannequins'
OUT = HERE / 'out'

# Full-figure frame: x from -0.42 to 0.42 m, y from -0.05 to 1.93 m (same for every mannequin,
# so garments placed as percentages line up on every body).
FRAME = [-0.42, 0.42, -0.05, 1.93]
W = 680
H = round(W * (FRAME[3] - FRAME[2]) / (FRAME[1] - FRAME[0]))

JOBS = {
    'female-front': dict(female=1, yaw=0.0),
    'female-back': dict(female=1, yaw=math.pi),
    'male-front': dict(female=0, yaw=0.0),
    'male-back': dict(female=0, yaw=math.pi),
    'test-f': dict(female=1, yaw=0.0, width=240, height=566, samples=1),
    'test-m': dict(female=0, yaw=0.0, width=240, height=566, samples=1),
    'test-b': dict(female=1, yaw=math.pi, width=240, height=566, samples=1),
    'shade-female-front': dict(female=1, yaw=0.0, shade=1, inflate=0.018, base=0, samples=2),
    'shade-female-back': dict(female=1, yaw=math.pi, shade=1, inflate=0.018, base=0, samples=2),
    'shade-male-front': dict(female=0, yaw=0.0, shade=1, inflate=0.018, base=0, samples=2),
    'shade-male-back': dict(female=0, yaw=math.pi, shade=1, inflate=0.018, base=0, samples=2),
    'bust': dict(female=0.45, yaw=0.22, frame=[-0.3, 0.3, 1.14, 1.9], width=800, height=1013, base=0, samples=3),
}


async def main(names):
    PUB.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(
            executable_path='/usr/bin/google-chrome',
            args=['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
        )
        page = await b.new_page()
        page.set_default_timeout(0)
        await page.goto((HERE / 'render.html').as_uri())
        for name in names:
            job = dict(JOBS[name])
            opts = {
                'width': job.pop('width', W),
                'height': job.pop('height', H),
                'frame': job.pop('frame', FRAME),
                'samples': int(job.pop('samples', 3)),
                **job,
            }
            t = time.time()
            url = await page.evaluate('(o) => window.renderMannequin(o)', opts)
            data = base64.b64decode(url.split(',', 1)[1])
            target = (OUT if name == 'bust' or name.startswith('test') else PUB) / f'{name}.png'
            target.write_bytes(data)
            print(f'{name}: {opts["width"]}x{opts["height"]} in {time.time() - t:.0f}s -> {target}', flush=True)
        await b.close()


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:] or list(JOBS)))
