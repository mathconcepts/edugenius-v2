# Complex Variables — Lecture Notes

> GATE Engineering Mathematics | Topic 4 | Weightage: 6–8%

---

## 1. Introduction

Complex analysis is a beautiful and powerful area of mathematics with deep engineering applications in signal processing, control theory, and electromagnetism. GATE questions focus on analytic functions, contour integration, and residues.

**GATE Focus:**
- Cauchy-Riemann equations (check analyticity)
- Laurent series and residues
- Contour integrals using Cauchy's theorem
- Singularity classification

---

## 2. Complex Number Fundamentals

### 2.1 Representation

A complex number z = x + iy where x = Re(z), y = Im(z).

**Modulus:** $|z| = \sqrt{x^2 + y^2}$

**Argument:** $\arg(z) = \theta = \tan^{-1}(y/x)$ (adjusted for quadrant)

**Polar form:** $z = r e^{i\theta} = r(\cos\theta + i\sin\theta)$

**Euler's formula:** $e^{i\theta} = \cos\theta + i\sin\theta$

### 2.2 De Moivre's Theorem

$$(\cos\theta + i\sin\theta)^n = \cos n\theta + i\sin n\theta$$

$$e^{in\theta} = \cos n\theta + i\sin n\theta$$

**n-th roots of unity:** $z = e^{2\pi i k/n}$ for k = 0, 1, ..., n−1

---

## 3. Analytic Functions

### 3.1 Cauchy-Riemann Equations

f(z) = u(x,y) + iv(x,y) is **analytic** (holomorphic) at a point iff:

$$\frac{\partial u}{\partial x} = \frac{\partial v}{\partial y} \quad \text{and} \quad \frac{\partial u}{\partial y} = -\frac{\partial v}{\partial x}$$

**In polar form (r, θ):**
$$\frac{\partial u}{\partial r} = \frac{1}{r}\frac{\partial v}{\partial \theta}, \quad \frac{\partial v}{\partial r} = -\frac{1}{r}\frac{\partial u}{\partial \theta}$$

If C-R equations hold and partial derivatives are continuous, f is analytic.

### 3.2 Harmonic Functions

If f = u + iv is analytic, then u and v are **harmonic**:
$$\nabla^2 u = \frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} = 0$$

u and v are **harmonic conjugates** — given u, find v by integrating C-R equations.

### 3.3 Derivative of Analytic Function

$$f'(z) = \frac{\partial u}{\partial x} + i\frac{\partial v}{\partial x} = \frac{\partial v}{\partial y} - i\frac{\partial u}{\partial y}$$

---

## 4. Complex Integration

### 4.1 Cauchy's Integral Theorem

If f is analytic inside and on a simple closed contour C:
$$\oint_C f(z)\,dz = 0$$

### 4.2 Cauchy's Integral Formula

If f is analytic inside and on C, and z₀ is inside C:
$$f(z_0) = \frac{1}{2\pi i}\oint_C \frac{f(z)}{z - z_0}\,dz$$

**Generalized form (for derivatives):**
$$f^{(n)}(z_0) = \frac{n!}{2\pi i}\oint_C \frac{f(z)}{(z-z_0)^{n+1}}\,dz$$

### 4.3 Singularities

A point z₀ where f is not analytic:

| Type | Description | Example |
|------|------------|---------|
| **Removable** | Laurent series has no negative powers | $\sin z/z$ at z=0 |
| **Pole of order m** | Laurent series has finite negative powers (up to (z-z₀)^{-m}) | $1/(z-z₀)^m$ |
| **Simple pole** | Pole of order 1 | $1/(z-1)$ |
| **Essential** | Laurent series has infinite negative powers | $e^{1/z}$ at z=0 |

### 4.4 Residue Theorem

$$\oint_C f(z)\,dz = 2\pi i \sum_k \text{Res}(f, z_k)$$

where the sum is over all poles z_k inside C.

**Computing Residues:**

**Simple pole at z₀:**
$$\text{Res}(f, z_0) = \lim_{z \to z_0} (z - z_0)f(z)$$

**Pole of order m at z₀:**
$$\text{Res}(f, z_0) = \frac{1}{(m-1)!}\lim_{z \to z_0}\frac{d^{m-1}}{dz^{m-1}}\left[(z-z_0)^m f(z)\right]$$

**For f(z) = p(z)/q(z)** with simple pole at z₀:
$$\text{Res}(f, z_0) = \frac{p(z_0)}{q'(z_0)}$$

---

## 5. Power Series

### 5.1 Taylor Series

Around z = z₀ (in region of analyticity):
$$f(z) = \sum_{n=0}^{\infty} \frac{f^{(n)}(z_0)}{n!}(z-z_0)^n$$

### 5.2 Laurent Series

In an annulus $0 < |z - z_0| < R$:
$$f(z) = \sum_{n=-\infty}^{\infty} a_n(z-z_0)^n$$

The residue = coefficient of (z − z₀)^{-1} = $a_{-1}$.

---

## 6. Worked Examples

### Example 1: Checking Analyticity Using C-R Equations

**Problem:** Is $f(z) = z^2$ analytic everywhere?

**Solution:**

Write f(z) = (x+iy)² = (x²−y²) + 2xyi

So u = x² − y², v = 2xy.

Verify C-R:
$$\frac{\partial u}{\partial x} = 2x, \quad \frac{\partial v}{\partial y} = 2x \quad ✓$$

$$\frac{\partial u}{\partial y} = -2y, \quad -\frac{\partial v}{\partial x} = -2y \quad ✓$$

C-R equations hold everywhere, partial derivatives are continuous → **f(z) = z² is analytic (entire function).**

$$f'(z) = \frac{\partial u}{\partial x} + i\frac{\partial v}{\partial x} = 2x + 2iy = 2(x+iy) = 2z \quad ✓$$

---

### Example 2: Cauchy's Integral Formula

**Problem:** Evaluate $\oint_{|z|=2} \frac{e^z}{z-1}\,dz$

**Solution:**

The integrand $\frac{e^z}{z-1}$ has a simple pole at z = 1, which is inside $|z| = 2$.

Using Cauchy's Integral Formula with f(z) = eˢ, z₀ = 1:
$$\oint_{|z|=2}\frac{e^z}{z-1}\,dz = 2\pi i \cdot f(1) = 2\pi i \cdot e^1 = 2\pi i e$$

$$\boxed{2\pi i e}$$

---

### Example 3: Residue Computation

**Problem:** Evaluate $\oint_{|z|=3} \frac{z^2+1}{(z-1)(z+2)}\,dz$

**Solution:**

Poles at z = 1 and z = −2, both inside |z| = 3.

**Residue at z = 1:**
$$\text{Res}(f,1) = \lim_{z\to 1}(z-1)\cdot\frac{z^2+1}{(z-1)(z+2)} = \frac{1+1}{1+2} = \frac{2}{3}$$

**Residue at z = −2:**
$$\text{Res}(f,-2) = \lim_{z\to -2}(z+2)\cdot\frac{z^2+1}{(z-1)(z+2)} = \frac{4+1}{-2-1} = \frac{5}{-3} = -\frac{5}{3}$$

By Residue Theorem:
$$\oint f\,dz = 2\pi i\left(\frac{2}{3} - \frac{5}{3}\right) = 2\pi i\left(-1\right) = -2\pi i$$

$$\boxed{-2\pi i}$$

---

## 7. Common GATE Traps

### ⚠️ Trap 1: C-R Equations are Necessary but Not Always Sufficient
C-R equations being satisfied at a point doesn't guarantee analyticity — the partial derivatives must also be continuous. For most GATE problems, the functions are smooth enough that this caveat doesn't apply.

### ⚠️ Trap 2: Check if Pole is Inside or Outside Contour
Before applying Cauchy's theorem, always check whether the singularity lies **inside** the contour. If outside, the integral = 0 (Cauchy's theorem for analytic regions).

### ⚠️ Trap 3: Pole Order Determination
For $f(z) = 1/(z-a)^3$, it's a **pole of order 3**. For $f(z) = \sin(z)/(z-\pi)^2$, expand sin(z) around z=π to check if the zero of numerator cancels a pole.

### ⚠️ Trap 4: Residue ≠ Just the Coefficient
Residue is specifically the coefficient of $(z-z_0)^{-1}$ in the Laurent expansion, **not** any other negative power coefficient.

### ⚠️ Trap 5: |z| = r Means Contour, Not Interior
$|z| = 2$ is a circle of radius 2 (contour), while $|z| < 2$ is its interior. The contour integral encloses the disk $|z| \le 2$.

---

## 8. Summary

| Concept | Key Formula |
|---------|------------|
| C-R equations | $u_x = v_y$, $u_y = -v_x$ |
| Cauchy integral | $f(z_0) = \frac{1}{2\pi i}\oint\frac{f(z)}{z-z_0}dz$ |
| Residue (simple pole) | $\lim_{z\to z_0}(z-z_0)f(z)$ |
| Residue theorem | $\oint f\,dz = 2\pi i\sum\text{Res}$ |
| Laurent residue | Coefficient of $(z-z_0)^{-1}$ |

---

*EduGenius GATE EM | Complex Variables Notes | Difficulty: Hard*
