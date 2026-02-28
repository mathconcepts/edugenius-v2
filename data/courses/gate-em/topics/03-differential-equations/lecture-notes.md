# Differential Equations — Lecture Notes

> GATE Engineering Mathematics | Topic 3 | Weightage: 8–10%

---

## 1. Introduction

Differential equations model physical systems: electric circuits, heat conduction, mechanical vibrations. GATE tests your ability to **classify** and **solve** ODEs/PDEs using standard methods.

**GATE Focus:**
- First-order linear ODEs (integrating factor)
- Second-order homogeneous ODEs (characteristic roots)
- Initial Value Problem (IVP) solutions
- PDE classification (elliptic/parabolic/hyperbolic)

---

## 2. First-Order ODEs

### 2.1 Separable Equations

Form: $\frac{dy}{dx} = f(x) \cdot g(y)$

**Method:** Separate variables and integrate:
$$\int \frac{dy}{g(y)} = \int f(x)\,dx + C$$

### 2.2 Linear First-Order ODE

**Standard form:** $\frac{dy}{dx} + P(x)y = Q(x)$

**Integrating Factor:** $\mu(x) = e^{\int P(x)\,dx}$

**Solution:** $y \cdot \mu(x) = \int Q(x)\cdot\mu(x)\,dx + C$

Or equivalently: $\frac{d}{dx}[\mu(x)\cdot y] = \mu(x)\cdot Q(x)$

### 2.3 Exact Equations

Form: $M(x,y)\,dx + N(x,y)\,dy = 0$

**Exact condition:** $\frac{\partial M}{\partial y} = \frac{\partial N}{\partial x}$

If exact, find F(x,y) such that ∂F/∂x = M and ∂F/∂y = N.
Solution: F(x,y) = C.

### 2.4 Bernoulli Equation

Form: $\frac{dy}{dx} + P(x)y = Q(x)y^n$

**Substitution:** v = y^(1−n) → reduces to linear ODE.

---

## 3. Second-Order Linear ODEs

### 3.1 Homogeneous with Constant Coefficients

**Form:** $ay'' + by' + cy = 0$

**Characteristic equation:** $ar^2 + br + c = 0$

**Solutions based on roots:**

| Roots | Solution |
|-------|---------|
| Real distinct: $r_1, r_2$ | $y = c_1 e^{r_1 x} + c_2 e^{r_2 x}$ |
| Real repeated: $r_1 = r_2 = r$ | $y = (c_1 + c_2 x)e^{rx}$ |
| Complex: $r = \alpha \pm \beta i$ | $y = e^{\alpha x}(c_1\cos\beta x + c_2\sin\beta x)$ |

### 3.2 Non-Homogeneous ODEs

**Form:** $ay'' + by' + cy = f(x)$

**General solution:** $y = y_h + y_p$

where $y_h$ is homogeneous solution and $y_p$ is a **particular solution**.

**Method of Undetermined Coefficients** (for polynomial, exponential, sinusoidal f(x)):

| f(x) form | Assumed $y_p$ |
|-----------|--------------|
| $Ke^{ax}$ | $Ae^{ax}$ (if not a root) |
| $K\sin(bx)$ or $K\cos(bx)$ | $A\cos(bx) + B\sin(bx)$ |
| $K x^n$ | $A_n x^n + \cdots + A_0$ |
| Modification | Multiply by x if f(x) form is already in $y_h$ |

**Variation of Parameters:** General method for any f(x):
$$y_p = -y_1\int\frac{y_2 f}{W}\,dx + y_2\int\frac{y_1 f}{W}\,dx$$

where W = Wronskian = $y_1 y_2' - y_2 y_1'$.

### 3.3 Euler-Cauchy Equation

**Form:** $x^2 y'' + ax y' + by = 0$

**Substitution:** x = e^t (or t = ln x) → converts to constant-coefficient ODE.

Alternatively, try $y = x^m$:
$$m(m-1) + am + b = 0 \quad \text{(indicial equation)}$$

---

## 4. Partial Differential Equations (PDEs)

### 4.1 Classification

General second-order PDE: $Au_{xx} + Bu_{xy} + Cu_{yy} + \cdots = 0$

**Discriminant:** $\Delta = B^2 - 4AC$

| Δ | Type | Example |
|---|------|---------|
| < 0 | Elliptic | Laplace: $u_{xx} + u_{yy} = 0$ |
| = 0 | Parabolic | Heat: $u_t = \alpha^2 u_{xx}$ |
| > 0 | Hyperbolic | Wave: $u_{tt} = c^2 u_{xx}$ |

### 4.2 Important PDEs

**Heat Equation (Parabolic):**
$$\frac{\partial u}{\partial t} = \alpha^2 \frac{\partial^2 u}{\partial x^2}$$

**Wave Equation (Hyperbolic):**
$$\frac{\partial^2 u}{\partial t^2} = c^2 \frac{\partial^2 u}{\partial x^2}$$

**Laplace Equation (Elliptic):**
$$\frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} = 0$$

**Poisson Equation:** $\nabla^2 u = f(x,y)$

### 4.3 Method of Separation of Variables

Assume $u(x,t) = X(x)\cdot T(t)$.

For heat equation:
$$\frac{T'}{T} = \alpha^2 \frac{X''}{X} = -\lambda^2 \text{ (separation constant)}$$

This gives two ODEs:
- $T' + \alpha^2\lambda^2 T = 0 \implies T = e^{-\alpha^2\lambda^2 t}$
- $X'' + \lambda^2 X = 0 \implies X = A\cos\lambda x + B\sin\lambda x$

Apply boundary conditions to find λ values (eigenvalues).

---

## 5. Worked Examples

### Example 1: First-Order Linear ODE

**Problem:** Solve $\frac{dy}{dx} - \frac{y}{x} = x^2$

**Solution:**

Standard form: $y' + P(x)y = Q(x)$ with P(x) = −1/x, Q(x) = x².

Integrating factor: $\mu = e^{\int P\,dx} = e^{\int(-1/x)\,dx} = e^{-\ln x} = \frac{1}{x}$

Multiply both sides by μ = 1/x:
$$\frac{d}{dx}\left[\frac{y}{x}\right] = x$$

Integrate:
$$\frac{y}{x} = \frac{x^2}{2} + C$$

$$\boxed{y = \frac{x^3}{2} + Cx}$$

---

### Example 2: Second-Order Homogeneous ODE with IVP

**Problem:** Solve $y'' - 5y' + 6y = 0$ with y(0) = 1, y'(0) = 4.

**Solution:**

Characteristic equation: r² − 5r + 6 = 0 → (r−2)(r−3) = 0

Roots: r₁ = 2, r₂ = 3 (real, distinct)

General solution: $y = c_1 e^{2x} + c_2 e^{3x}$

Apply initial conditions:

y(0) = 1: $c_1 + c_2 = 1$ ... (i)

y'(x) = 2c₁e^{2x} + 3c₂e^{3x}, so y'(0) = 4: $2c_1 + 3c_2 = 4$ ... (ii)

From (ii) − 2×(i): c₂ = 2, then c₁ = −1.

$$\boxed{y = -e^{2x} + 2e^{3x}}$$

---

### Example 3: Non-Homogeneous ODE

**Problem:** Solve $y'' + 4y = \sin 2x$

**Solution:**

**Homogeneous solution:** r² + 4 = 0 → r = ±2i

$y_h = c_1\cos 2x + c_2\sin 2x$

**Particular solution:** Since sin 2x is part of $y_h$, we use modification:

$y_p = x(A\cos 2x + B\sin 2x)$

$y_p' = (A\cos 2x + B\sin 2x) + x(-2A\sin 2x + 2B\cos 2x)$

$y_p'' = 2(-2A\sin 2x + 2B\cos 2x) + x(-4A\cos 2x - 4B\sin 2x)$

$y_p'' + 4y_p = -4A\sin 2x + 4B\cos 2x = \sin 2x$

Comparing: $-4A = 1 \implies A = -\frac{1}{4}$, $4B = 0 \implies B = 0$

$y_p = -\frac{x}{4}\cos 2x$

$$\boxed{y = c_1\cos 2x + c_2\sin 2x - \frac{x}{4}\cos 2x}$$

---

## 6. Common GATE Traps

### ⚠️ Trap 1: Resonance in Non-Homogeneous ODE
If f(x) matches the homogeneous solution form, **multiply by x** (or x² if needed). Forgetting this leads to wrong particular solutions.

### ⚠️ Trap 2: PDE Classification
For $Bu_{xy}$ terms: the discriminant is $B^2 - 4AC$, **not** $B^2 - AC$. Many students forget the factor of 4.

### ⚠️ Trap 3: Complex Roots
For roots α ± βi, the solution uses cos and sin with coefficient **β**, not the full complex number. The e^{αx} factor must be included.

### ⚠️ Trap 4: Integrating Factor Sign
The integrating factor for $y' + Py = Q$ is $e^{\int P\,dx}$. If the equation is $y' - Py = Q$, then P is negative — don't flip the sign.

### ⚠️ Trap 5: Particular Solution for Polynomial
If f(x) = $kx^n$, the particular solution is a polynomial of degree n (not n+1, unless resonance applies).

---

## 7. Summary

| Method | When to Use |
|--------|------------|
| Separable | $dy/dx = f(x)g(y)$ |
| Integrating factor | Linear first-order |
| Characteristic eq. | Constant-coeff. ODE |
| Undetermined coeff. | f(x) is exp/poly/trig |
| Variation of params | Any f(x), more general |
| Separation of vars | PDEs with BC |

**Quick PDE classification:**
- Laplace ↔ Elliptic (steady state)
- Heat ↔ Parabolic (diffusion)
- Wave ↔ Hyperbolic (propagation)

---

*EduGenius GATE EM | Differential Equations Notes | Difficulty: Medium-Hard*
