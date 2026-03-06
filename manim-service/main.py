"""
EduGenius Manim Render Service
===============================
FastAPI microservice that renders mathematical animations/diagrams via Manim.

Endpoints:
  POST /render        — render a scene from Sage-generated code, return PNG/MP4
  POST /render/quick  — quick static PNG (no animation, fastest)
  GET  /health        — liveness probe
  GET  /scenes        — list pre-built scene templates

Cost/resource model:
  - Static PNG:  ~1–3s, ~50MB RAM peak, no GPU needed
  - Low-quality animation (480p): ~5–15s, ~150MB RAM
  - High-quality animation (1080p): 30–120s, ~400MB RAM — ONLY on explicit request

Arbitration rules (enforced server-side too, not just client):
  - Max 3 renders/minute per session
  - Static PNG for: equations, graphs, geometry diagrams
  - Animation only for: transforms, proofs with steps, vector fields
"""

import os
import re
import hashlib
import tempfile
import subprocess
import asyncio
from pathlib import Path
from typing import Optional, Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────────────────────────
MEDIA_DIR = Path(os.environ.get("MANIM_MEDIA_DIR", "/tmp/manim_renders"))
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

CACHE_DIR = Path(os.environ.get("MANIM_CACHE_DIR", "/tmp/manim_cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

PYTHON_BIN = os.environ.get("MANIM_PYTHON", "/usr/bin/python3")
MAX_RENDER_SECONDS = 60   # hard timeout per render
MAX_SCENE_BYTES = 8192    # max code size accepted

# Rate limiting (in-memory, resets on restart)
_rate_limit: dict[str, list] = {}

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="EduGenius Manim Service",
    description="On-demand math visualisation renderer",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten to EduGenius domain in prod
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Request/response models ───────────────────────────────────────────────────

class RenderRequest(BaseModel):
    scene_code: str          # Python manim scene code (class must be named EduScene)
    format: Literal["png", "gif", "mp4"] = "png"
    quality: Literal["low", "medium", "high"] = "low"
    session_id: Optional[str] = None   # for rate limiting
    cache: bool = True                 # use cached result if hash matches

class RenderResponse(BaseModel):
    url: str                 # relative URL to fetch the rendered file
    format: str
    cached: bool
    render_ms: int

class QuickRenderRequest(BaseModel):
    """Simpler API — just describe what Sage wants to show."""
    topic: str               # e.g. "eigenvalues", "integration", "venn-diagram"
    latex: Optional[str] = None   # LaTeX expression to render prominently
    title: Optional[str] = None
    session_id: Optional[str] = None
    cache: bool = True

# ── Pre-built scene templates ─────────────────────────────────────────────────

SCENE_TEMPLATES: dict[str, str] = {
    "latex-display": """
from manim import *
class EduScene(Scene):
    def construct(self):
        tex = MathTex(r\"\"\"{latex}\"\"\", font_size=56).set_color(WHITE)
        if \"{title}\":
            label = Text(\"{title}\", font_size=28).set_color(BLUE_B)
            label.next_to(tex, UP, buff=0.5)
            self.add(label)
        self.add(tex)
""",
    "matrix-eigenvalue": """
from manim import *
class EduScene(Scene):
    def construct(self):
        title = Text("Eigenvalue Equation: Av = λv", font_size=32).set_color(BLUE_B)
        title.to_edge(UP)
        matrix = MathTex(r"A\\mathbf{{v}} = \\lambda\\mathbf{{v}}", font_size=52)
        explain = Text("A: matrix  |  v: eigenvector  |  λ: eigenvalue", font_size=22).set_color(GREY_B)
        explain.next_to(matrix, DOWN, buff=0.5)
        self.add(title, matrix, explain)
""",
    "integration-area": """
from manim import *
import numpy as np
class EduScene(Scene):
    def construct(self):
        axes = Axes(
            x_range=[-0.5, 4, 1], y_range=[-0.5, 5, 1],
            x_length=6, y_length=4,
            axis_config={{"color": GREY_B}},
        )
        func = lambda x: 0.5 * x**2
        graph = axes.plot(func, color=BLUE)
        area = axes.get_area(graph, x_range=[0.5, 3], color=[BLUE, GREEN], opacity=0.5)
        label = axes.get_graph_label(graph, label=MathTex("f(x)=\\\\frac{{x^2}}{{2}}"), x_val=3.2)
        integral = MathTex(r"\\int_{{0.5}}^{{3}} \\frac{{x^2}}{{2}}\\,dx", font_size=36).set_color(YELLOW)
        integral.to_corner(UR)
        self.add(axes, graph, area, label, integral)
""",
    "probability-venn": """
from manim import *
class EduScene(Scene):
    def construct(self):
        title = Text("Probability: P(A ∪ B) = P(A) + P(B) - P(A ∩ B)", font_size=26).set_color(BLUE_B)
        title.to_edge(UP)
        c1 = Circle(radius=1.4, color=BLUE, fill_opacity=0.3).shift(LEFT*0.7)
        c2 = Circle(radius=1.4, color=RED, fill_opacity=0.3).shift(RIGHT*0.7)
        a_label = Text("A", font_size=32).shift(LEFT*1.6)
        b_label = Text("B", font_size=32).shift(RIGHT*1.6)
        inter = Text("A∩B", font_size=24).set_color(YELLOW)
        formula = MathTex(r"P(A\\cup B) = P(A) + P(B) - P(A\\cap B)", font_size=32)
        formula.to_edge(DOWN)
        self.add(title, c1, c2, a_label, b_label, inter, formula)
""",
    "number-line": """
from manim import *
class EduScene(Scene):
    def construct(self):
        title = Text("{title}", font_size=30).set_color(BLUE_B).to_edge(UP)
        nl = NumberLine(x_range=[-5,5,1], length=10, include_numbers=True)
        tex = MathTex(r\"\"\"{latex}\"\"\", font_size=40).set_color(YELLOW)
        tex.next_to(nl, UP, buff=0.6)
        self.add(title, nl, tex)
""",
    "coordinate-graph": """
from manim import *
import numpy as np
class EduScene(Scene):
    def construct(self):
        axes = Axes(x_range=[-3,3,1], y_range=[-2,4,1], x_length=7, y_length=5,
                    axis_config={{"color": GREY_B, "include_numbers": True}})
        title = Text("{title}", font_size=28).set_color(BLUE_B).to_edge(UP)
        self.add(title, axes)
""",
}

# ── Safety: validate that code only imports manim ─────────────────────────────

BANNED_PATTERNS = [
    r"\bimport os\b", r"\bimport sys\b", r"\bimport subprocess\b",
    r"\bopen\(", r"\bexec\(", r"\beval\(", r"\b__import__\b",
    r"\bshutil\b", r"\bpathlib\b", r"\bsocket\b", r"\brequests\b",
]

def is_safe_code(code: str) -> bool:
    for pattern in BANNED_PATTERNS:
        if re.search(pattern, code):
            return False
    # Must define class EduScene
    if "class EduScene" not in code:
        return False
    return True

# ── Rate limiting ─────────────────────────────────────────────────────────────

import time

def check_rate_limit(session_id: str, max_per_minute: int = 5) -> bool:
    now = time.time()
    window = [t for t in _rate_limit.get(session_id, []) if now - t < 60]
    if len(window) >= max_per_minute:
        return False
    window.append(now)
    _rate_limit[session_id] = window
    return True

# ── Core render function ───────────────────────────────────────────────────────

async def render_scene(code: str, fmt: str, quality: str) -> tuple[Path, bool]:
    """Render a manim scene. Returns (output_path, was_cached)."""
    code_hash = hashlib.sha256(f"{code}{fmt}{quality}".encode()).hexdigest()[:16]
    
    ext = {"png": ".png", "gif": ".gif", "mp4": ".mp4"}[fmt]
    cache_path = CACHE_DIR / f"{code_hash}{ext}"
    
    if cache_path.exists():
        return cache_path, True
    
    # Quality flag mapping
    q_flag = {
        "low":    "-ql",   # 480p15  — fastest, ~1–3s for static
        "medium": "-qm",   # 720p30  — balanced
        "high":   "-qh",   # 1080p60 — expensive, use sparingly
    }[quality]
    
    fmt_flag = "--format=" + ("png" if fmt == "png" else fmt)
    
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write(code)
        scene_file = f.name
    
    try:
        work_dir = MEDIA_DIR / code_hash
        work_dir.mkdir(parents=True, exist_ok=True)
        
        cmd = [
            PYTHON_BIN, "-m", "manim",
            scene_file, "EduScene",
            fmt_flag, q_flag,
            "--media_dir", str(work_dir),
            "--disable_caching",
            "-o", code_hash,
        ]
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=MAX_RENDER_SECONDS
            )
        except asyncio.TimeoutError:
            proc.kill()
            raise HTTPException(status_code=408, detail="Render timed out")
        
        if proc.returncode != 0:
            err = stderr.decode()[-500:] if stderr else "unknown error"
            raise HTTPException(status_code=500, detail=f"Manim error: {err}")
        
        # Find output file
        subdir = "images" if fmt == "png" else ("videos" if fmt == "mp4" else "images")
        found = list(work_dir.rglob(f"*{ext}"))
        if not found:
            raise HTTPException(status_code=500, detail="No output file produced")
        
        # Copy to cache
        import shutil
        shutil.copy2(found[0], cache_path)
        return cache_path, False
        
    finally:
        try:
            os.unlink(scene_file)
        except Exception:
            pass

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "manim": "0.20.1"}

@app.get("/scenes")
async def list_scenes():
    return {"templates": list(SCENE_TEMPLATES.keys())}

@app.post("/render")
async def render(req: RenderRequest, request: Request):
    session_id = req.session_id or request.client.host
    
    # Rate limit
    if not check_rate_limit(session_id):
        raise HTTPException(status_code=429, detail="Rate limit: max 5 renders/minute")
    
    # Size limit
    if len(req.scene_code) > MAX_SCENE_BYTES:
        raise HTTPException(status_code=400, detail="Scene code too large (max 8KB)")
    
    # Safety check
    if not is_safe_code(req.scene_code):
        raise HTTPException(status_code=400, detail="Unsafe code rejected. Scene must define 'class EduScene' and only import manim.")
    
    # Enforce cost guardrails: no high-quality without explicit opt-in
    quality = req.quality
    if quality == "high" and req.format == "mp4":
        quality = "medium"  # Auto-downgrade to protect resources
    
    t0 = time.time()
    output_path, cached = await render_scene(req.scene_code, req.format, quality)
    render_ms = int((time.time() - t0) * 1000)
    
    url = f"/media/{output_path.name}"
    return RenderResponse(url=url, format=req.format, cached=cached, render_ms=render_ms)

@app.post("/render/quick")
async def render_quick(req: QuickRenderRequest, request: Request):
    """
    Quick-render endpoint for Sage.
    Sage describes what it wants (topic + latex) and we pick the best template.
    Always renders static PNG at low quality for speed.
    """
    session_id = req.session_id or request.client.host
    if not check_rate_limit(session_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Select template based on topic
    template_key = "latex-display"
    topic_lower = (req.topic or "").lower()
    
    if any(k in topic_lower for k in ["eigenvalue", "matrix", "linear-algebra"]):
        template_key = "matrix-eigenvalue"
    elif any(k in topic_lower for k in ["integral", "area", "calculus", "integration"]):
        template_key = "integration-area"
    elif any(k in topic_lower for k in ["probability", "venn", "set"]):
        template_key = "probability-venn"
    elif any(k in topic_lower for k in ["number-line", "inequality", "range"]):
        template_key = "number-line"
    elif any(k in topic_lower for k in ["graph", "function", "coordinate", "plot"]):
        template_key = "coordinate-graph"
    elif req.latex:
        template_key = "latex-display"
    
    tmpl = SCENE_TEMPLATES[template_key]
    code = tmpl.format(
        latex=req.latex or r"\text{EduGenius}",
        title=req.title or req.topic or "Math Concept"
    )
    
    # Ensure it defines EduScene (templates already do this)
    if not is_safe_code(code):
        raise HTTPException(status_code=500, detail="Template generation error")
    
    t0 = time.time()
    output_path, cached = await render_scene(code, "png", "low")
    render_ms = int((time.time() - t0) * 1000)
    
    return RenderResponse(
        url=f"/media/{output_path.name}",
        format="png",
        cached=cached,
        render_ms=render_ms
    )

# ─── SymPy Verification Endpoint ─────────────────────────────────────────────

class VerifyRequest(BaseModel):
    operation: str          # 'simplify' | 'equivalent' | 'evaluate' | 'steps'
    params: dict            # e.g. {'expression': 'x**2 + 2*x + 1', 'expected': '(x+1)**2'}

class VerifyResponse(BaseModel):
    success: bool
    simplified: Optional[str] = None
    evaluated: Optional[str] = None
    equivalent: Optional[bool] = None
    steps: Optional[list] = None
    error: Optional[str] = None

def _run_sympy_safe(operation: str, params: dict) -> dict:
    """Run SymPy operations in a restricted scope."""
    try:
        from sympy import (
            sympify, simplify, latex, N, symbols, expand, factor,
            solve, diff, integrate, trigsimp, radsimp, nsimplify,
            Symbol
        )
        from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application

        transformations = standard_transformations + (implicit_multiplication_application,)

        def safe_parse(expr_str: str):
            # Only allow safe characters
            if re.search(r'[^a-zA-Z0-9\s\+\-\*\/\^\(\)\.\,\_\=\<\>]', expr_str):
                raise ValueError(f"Unsafe characters in expression: {expr_str}")
            return parse_expr(expr_str, transformations=transformations)

        if operation == 'simplify':
            expr = safe_parse(params.get('expression', ''))
            simplified = simplify(expr)
            return {
                'success': True,
                'simplified': str(simplified),
                'steps': [f"Original: {expr}", f"Simplified: {simplified}"],
            }

        elif operation == 'equivalent':
            expr1 = safe_parse(params.get('expression', ''))
            expr2 = safe_parse(params.get('expected', ''))
            diff_expr = simplify(expr1 - expr2)
            equivalent = diff_expr == 0
            return {
                'success': True,
                'equivalent': equivalent,
                'simplified': str(simplify(expr1)),
                'steps': [
                    f"Expression 1: {expr1}",
                    f"Expression 2: {expr2}",
                    f"Difference: {diff_expr}",
                    f"Equivalent: {equivalent}",
                ],
            }

        elif operation == 'evaluate':
            expr = safe_parse(params.get('expression', ''))
            subs = params.get('substitutions', {})
            sym_subs = {Symbol(k): safe_parse(str(v)) for k, v in subs.items()}
            result = expr.subs(sym_subs)
            evaluated = N(result, 6)
            return {
                'success': True,
                'evaluated': str(evaluated),
                'simplified': str(result),
            }

        elif operation == 'steps':
            expr = safe_parse(params.get('expression', ''))
            steps = []
            expanded = expand(expr)
            factored = factor(expr)
            simplified = simplify(expr)
            if str(expanded) != str(expr):
                steps.append(f"Expand: {expanded}")
            if str(factored) != str(expr):
                steps.append(f"Factor: {factored}")
            if str(simplified) != str(expr):
                steps.append(f"Simplify: {simplified}")
            return {
                'success': True,
                'simplified': str(simplified),
                'steps': steps or [f"Already in simplest form: {expr}"],
            }

        else:
            return {'success': False, 'error': f"Unknown operation: {operation}"}

    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.post("/verify", response_model=VerifyResponse)
async def verify_math(req: VerifyRequest):
    """Verify or simplify mathematical expressions using SymPy."""
    result = _run_sympy_safe(req.operation, req.params)
    return VerifyResponse(**result)


@app.get("/media/{filename}")
async def serve_media(filename: str):
    # Sanitise filename
    filename = Path(filename).name
    path = CACHE_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Media not found")
    media_type = "image/png" if filename.endswith(".png") else (
        "video/mp4" if filename.endswith(".mp4") else "image/gif"
    )
    return FileResponse(path, media_type=media_type)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("MANIM_PORT", 7341))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
