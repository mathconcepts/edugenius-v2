# Calculus — Lecture Notes

> GATE Engineering Mathematics | Topic 2 | Weightage: 8–10%

---

## 1. Introduction

Calculus underpins nearly all of engineering mathematics. In GATE, calculus questions test your ability to evaluate limits, apply differentiation rules, compute integrals, and work with multivariable functions.

**GATE Focus Areas:**
- Taylor/Maclaurin series expansions
- Definite integrals using substitution and special formulas
- Partial derivatives and Jacobians
- Maxima/minima and saddle points
- Mean Value Theorem applications

---

## 2. Limits and Continuity

### 2.1 Standard Limits

$$\lim_{x \to 0} \frac{\sin x}{x} = 1$$

$$\lim_{x \to 0} \frac{e^x - 1}{x} = 1$$

$$\lim_{x \to 0} \frac{\ln(1+x)}{x} = 1$$

$$\lim_{x \to \infty} \left(1 + \frac{1}{x}\right)^x = e$$

$$\lim_{x \to 0} \frac{(1+x)^n - 1}{x} = n$$

### 2.2 L'Hôpital's Rule

For 0/0 or ∞/∞ forms:
$$\lim_{x \to a} \frac{f(x)}{g(x)} = \lim_{x \to a} \frac{f'(x)}{g'(x)}$$

**Applicable only when** the original limit is indeterminate (0/0 or ∞/∞).

### 2.3 Continuity

f(x) is continuous at x = a if:
1. f(a) is defined
2. lim_{x→a} f(x) exists
3. lim_{x→a} f(x) = f(a)

---

## 3. Differential Calculus

### 3.1 Key Differentiation Rules

| Function | Derivative |
|---------|-----------|
| $x^n$ | $nx^{n-1}$ |
| $e^x$ | $e^x$ |
| $\ln x$ | $1/x$ |
| $\sin x$ | $\cos x$ |
| $\cos x$ | $-\sin x$ |
| $\tan x$ | $\sec^2 x$ |
| $\sin^{-1} x$ | $1/\sqrt{1-x^2}$ |
| $\tan^{-1} x$ | $1/(1+x^2)$ |

### 3.2 Mean Value Theorem (MVT)

If f is continuous on [a,b] and differentiable on (a,b), then:
$$\exists\, c \in (a,b) : f'(c) = \frac{f(b) - f(a)}{b - a}$$

**Rolle's Theorem** (special case): If f(a) = f(b), then ∃ c ∈ (a,b) with f'(c) = 0.

### 3.3 Taylor and Maclaurin Series

**Taylor series** around x = a:
$$f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n$$

**Maclaurin series** (a = 0) — the ones GATE loves:

$$e^x = 1 + x + \frac{x^2}{2!} + \frac{x^3}{3!} + \cdots$$

$$\sin x = x - \frac{x^3}{3!} + \frac{x^5}{5!} - \cdots$$

$$\cos x = 1 - \frac{x^2}{2!} + \frac{x^4}{4!} - \cdots$$

$$\ln(1+x) = x - \frac{x^2}{2} + \frac{x^3}{3} - \cdots \quad (|x| \le 1)$$

$$(1+x)^n = 1 + nx + \frac{n(n-1)}{2!}x^2 + \cdots$$

### 3.4 Maxima, Minima, and Saddle Points

For f(x): critical points where f'(x) = 0.
- f''(c) > 0: local minimum
- f''(c) < 0: local maximum
- f''(c) = 0: inconclusive (check higher derivatives)

---

## 4. Multivariable Calculus

### 4.1 Partial Derivatives

$$\frac{\partial f}{\partial x} \bigg|_{y=\text{const}} : \text{differentiate w.r.t. } x, \text{ treat } y \text{ as constant}$$

**Chain rule** for f(x(t), y(t)):
$$\frac{df}{dt} = \frac{\partial f}{\partial x}\frac{dx}{dt} + \frac{\partial f}{\partial y}\frac{dy}{dt}$$

### 4.2 Jacobian

For transformation (x,y) → (u,v):
$$J = \frac{\partial(u,v)}{\partial(x,y)} = \begin{vmatrix} \frac{\partial u}{\partial x} & \frac{\partial u}{\partial y} \\ \frac{\partial v}{\partial x} & \frac{\partial v}{\partial y} \end{vmatrix}$$

Used for change of variables in multiple integrals.

### 4.3 Maxima/Minima of f(x,y)

At critical point (a,b) where ∂f/∂x = ∂f/∂y = 0:

Let D = f_{xx}f_{yy} - (f_{xy})² (discriminant)

- D > 0 and f_{xx} > 0: **local minimum**
- D > 0 and f_{xx} < 0: **local maximum**
- D < 0: **saddle point**
- D = 0: **inconclusive**

### 4.4 Double Integrals

$$\iint_R f(x,y)\,dA = \int_a^b \int_{g_1(x)}^{g_2(x)} f(x,y)\,dy\,dx$$

**Polar coordinates:** x = r cosθ, y = r sinθ
$$\iint_R f\,dA = \int_0^{2\pi}\int_0^R f(r\cos\theta, r\sin\theta)\cdot r\,dr\,d\theta$$

---

## 5. Integral Calculus

### 5.1 Standard Integrals

$$\int x^n\,dx = \frac{x^{n+1}}{n+1} + C \quad (n \neq -1)$$

$$\int \frac{1}{x}\,dx = \ln|x| + C$$

$$\int e^{ax}\,dx = \frac{e^{ax}}{a} + C$$

$$\int \sin x\,dx = -\cos x + C, \quad \int \cos x\,dx = \sin x + C$$

### 5.2 Important Definite Integral Results (GATE favorites)

$$\int_0^{\pi/2} \sin^n x\,dx = \int_0^{\pi/2} \cos^n x\,dx$$

$$\int_{-a}^{a} f(x)\,dx = \begin{cases} 2\int_0^a f(x)\,dx & \text{if } f \text{ is even} \\ 0 & \text{if } f \text{ is odd} \end{cases}$$

$$\int_0^{\infty} e^{-ax^2}\,dx = \frac{1}{2}\sqrt{\frac{\pi}{a}}$$

$$\int_0^{\infty} x^n e^{-x}\,dx = n! \quad \text{(Gamma function: } \Gamma(n+1) = n!\text{)}$$

---

## 6. Worked Examples

### Example 1: Taylor Series Application

**Problem:** Find the first three non-zero terms of the Maclaurin series for $f(x) = e^{x}\sin x$.

**Solution:**

$$e^x = 1 + x + \frac{x^2}{2} + \frac{x^3}{6} + \cdots$$

$$\sin x = x - \frac{x^3}{6} + \cdots$$

Multiply:
$$e^x \sin x = \left(1 + x + \frac{x^2}{2} + \frac{x^3}{6}\right)\left(x - \frac{x^3}{6}\right) + O(x^5)$$

$$= x - \frac{x^3}{6} + x^2 - \frac{x^4}{6} + \frac{x^3}{2} + \frac{x^4}{2} + \cdots$$

$$= x + x^2 + \left(-\frac{1}{6} + \frac{1}{2}\right)x^3 + \cdots$$

$$\boxed{e^x\sin x = x + x^2 + \frac{x^3}{3} + \cdots}$$

---

### Example 2: Definite Integral with Substitution

**Problem:** Evaluate $\int_0^1 \frac{x^3}{\sqrt{1-x^2}}\,dx$

**Solution:**

Let x = sin θ, dx = cos θ dθ.
- When x = 0: θ = 0
- When x = 1: θ = π/2

$$\int_0^{\pi/2} \frac{\sin^3\theta}{\sqrt{1-\sin^2\theta}}\cos\theta\,d\theta = \int_0^{\pi/2} \frac{\sin^3\theta}{\cos\theta}\cos\theta\,d\theta = \int_0^{\pi/2}\sin^3\theta\,d\theta$$

$$\int_0^{\pi/2}\sin^3\theta\,d\theta = \int_0^{\pi/2}(1-\cos^2\theta)\sin\theta\,d\theta$$

Let u = cos θ, du = −sin θ dθ:
$$= \int_1^0 (1-u^2)(-du) = \int_0^1(1-u^2)\,du = \left[u - \frac{u^3}{3}\right]_0^1 = 1 - \frac{1}{3} = \frac{2}{3}$$

$$\boxed{\int_0^1 \frac{x^3}{\sqrt{1-x^2}}\,dx = \frac{2}{3}}$$

---

### Example 3: Partial Derivatives and Critical Points

**Problem:** Find and classify critical points of $f(x,y) = x^3 + y^3 - 3xy$.

**Solution:**

First derivatives:
$$f_x = 3x^2 - 3y = 0 \implies x^2 = y$$
$$f_y = 3y^2 - 3x = 0 \implies y^2 = x$$

From x² = y: x⁴ = y² = x → x(x³ − 1) = 0 → x = 0 or x = 1.

Critical points: **(0,0)** and **(1,1)**

Second derivatives:
$$f_{xx} = 6x, \quad f_{yy} = 6y, \quad f_{xy} = -3$$

$$D = f_{xx}f_{yy} - f_{xy}^2 = 36xy - 9$$

At (0,0): D = 0 − 9 = −9 < 0 → **saddle point**

At (1,1): D = 36 − 9 = 27 > 0 and f_{xx} = 6 > 0 → **local minimum**

$$f(1,1) = 1 + 1 - 3 = -1 \text{ (minimum value)}$$

$$\boxed{\text{Saddle at }(0,0);\text{ Local min at }(1,1)\text{ with value }-1}$$

---

## 7. Common GATE Traps

### ⚠️ Trap 1: L'Hôpital's Rule Overuse
Only apply L'Hôpital when the limit is 0/0 or ∞/∞. For 0·∞, rewrite as ratio first.

### ⚠️ Trap 2: Integration Limits under Substitution
When substituting in definite integrals, **always change the limits** to match the new variable — or convert back to original variable.

### ⚠️ Trap 3: Odd/Even Function Integration
Quick check: Is f(−x) = f(x) (even) or f(−x) = −f(x) (odd)? If odd and symmetric limits → integral = 0.

### ⚠️ Trap 4: Maclaurin Series Truncation
GATE often asks for a specific coefficient. Write enough terms — at least one beyond what you think you need.

### ⚠️ Trap 5: Partial Derivative Order
For most functions, f_{xy} = f_{yx} (Clairaut's theorem). But verify continuity before assuming this.

---

## 8. Summary

| Concept | Key Fact |
|---------|---------|
| L'Hôpital | Only for 0/0 or ∞/∞ |
| Taylor series | Expand around a = 0 for Maclaurin |
| MVT | ∃c: f'(c) = [f(b)−f(a)]/(b−a) |
| Critical points | Set f_x = f_y = 0, use D-test |
| Even/odd symmetry | Saves computation in definite integrals |
| Jacobian | Change of variables in multiple integrals |

---

*EduGenius GATE EM | Calculus Notes | Difficulty: Medium*
