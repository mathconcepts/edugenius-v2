# Numerical Methods — Lecture Notes

> GATE Engineering Mathematics | Topic 6 | Weightage: 6–8%

---

## 1. Introduction

Numerical Methods provide computational techniques to solve mathematical problems that lack closed-form analytical solutions. GATE focuses on understanding algorithms and analyzing errors/convergence.

**GATE Focus:**
- Newton-Raphson method (convergence rate, formula)
- Trapezoidal and Simpson's rules
- Euler's method for ODEs
- Runge-Kutta (RK4) formula application
- Error analysis and convergence

---

## 2. Root Finding Methods

### 2.1 Bisection Method

**Algorithm:**
1. Start with interval [a,b] where f(a)·f(b) < 0
2. Midpoint: c = (a+b)/2
3. If f(c) = 0, done. Else update: replace a or b with c (keeping sign change)
4. Repeat

**Convergence:** Linear (slow but guaranteed)
- After n iterations, error ≤ (b−a)/2ⁿ
- Number of iterations for error < ε: n ≥ log₂[(b−a)/ε]

**Property:** Always converges if initial bracket contains a root.

### 2.2 Newton-Raphson Method

**Formula:**
$$x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}$$

**Convergence:** Quadratic (very fast near the root)
- Error at step n+1: $e_{n+1} \approx \frac{f''(x^*)}{2f'(x^*)} e_n^2$

**Geometric interpretation:** Find x-intercept of tangent line at (xₙ, f(xₙ)).

**Fails when:**
- f'(xₙ) = 0 (horizontal tangent)
- Starting point is far from root (may diverge or oscillate)
- Root has even multiplicity (convergence slows)

### 2.3 Secant Method

**Formula:**
$$x_{n+1} = x_n - f(x_n)\cdot\frac{x_n - x_{n-1}}{f(x_n) - f(x_{n-1})}$$

Like Newton-Raphson but **approximates f'(xₙ)** using finite difference.
Convergence order: ≈ 1.618 (superlinear, between linear and quadratic).

### 2.4 False Position (Regula Falsi)

$$x_{n+1} = \frac{a\cdot f(b) - b\cdot f(a)}{f(b) - f(a)}$$

Combines bisection (bracketing) with secant approach. Guaranteed convergence.

---

## 3. Interpolation

### 3.1 Lagrange Interpolation

For n+1 data points (x₀,y₀), (x₁,y₁), ..., (xₙ,yₙ):

$$P(x) = \sum_{i=0}^{n} y_i L_i(x)$$

$$L_i(x) = \prod_{j=0, j\neq i}^{n} \frac{x - x_j}{x_i - x_j}$$

**For two points** (linear):
$$P(x) = y_0\frac{x-x_1}{x_0-x_1} + y_1\frac{x-x_0}{x_1-x_0}$$

### 3.2 Newton's Forward Difference

For equally spaced x₀, x₁ = x₀+h, ..., xₙ = x₀+nh:

$$P(x) = y_0 + u\Delta y_0 + \frac{u(u-1)}{2!}\Delta^2 y_0 + \cdots$$

where $u = (x-x_0)/h$ and $\Delta^k y_i = \Delta^{k-1}y_{i+1} - \Delta^{k-1}y_i$.

---

## 4. Numerical Integration

### 4.1 Trapezoidal Rule

$$\int_a^b f(x)\,dx \approx \frac{h}{2}\left[f(x_0) + 2f(x_1) + 2f(x_2) + \cdots + 2f(x_{n-1}) + f(x_n)\right]$$

where h = (b−a)/n.

**Error:** $O(h^2)$ — exact for polynomials of degree ≤ 1.

### 4.2 Simpson's 1/3 Rule

**Requires n even:**
$$\int_a^b f(x)\,dx \approx \frac{h}{3}\left[f(x_0) + 4f(x_1) + 2f(x_2) + 4f(x_3) + \cdots + 4f(x_{n-1}) + f(x_n)\right]$$

Pattern: **1, 4, 2, 4, 2, ..., 4, 1** (alternating 4,2 in the middle)

**Error:** $O(h^4)$ — exact for polynomials of degree ≤ 3.

### 4.3 Simpson's 3/8 Rule

**Requires n divisible by 3:**
$$\int_a^b f(x)\,dx \approx \frac{3h}{8}\left[f_0 + 3f_1 + 3f_2 + 2f_3 + 3f_4 + 3f_5 + 2f_6 + \cdots + f_n\right]$$

Pattern: **1, 3, 3, 2, 3, 3, 2, ...** 

**Error:** $O(h^4)$ — exact for polynomials of degree ≤ 3.

---

## 5. Numerical ODE Methods

### 5.1 Euler's Method

For y' = f(x, y), y(x₀) = y₀:

$$y_{n+1} = y_n + h \cdot f(x_n, y_n)$$

**Error:** $O(h)$ — first-order method (local truncation error O(h²)).

**Simple but inaccurate** for large h.

### 5.2 Runge-Kutta 4th Order (RK4)

$$y_{n+1} = y_n + \frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4)$$

where:
$$k_1 = f(x_n, y_n)$$
$$k_2 = f\!\left(x_n + \frac{h}{2},\, y_n + \frac{h}{2}k_1\right)$$
$$k_3 = f\!\left(x_n + \frac{h}{2},\, y_n + \frac{h}{2}k_2\right)$$
$$k_4 = f(x_n + h,\, y_n + h k_3)$$

**Error:** $O(h^4)$ — fourth-order method (much more accurate than Euler).

---

## 6. Worked Examples

### Example 1: Newton-Raphson Application

**Problem:** Use Newton-Raphson to find a root of f(x) = x³ − x − 2, starting at x₀ = 1.5.

**Solution:**

f(x) = x³ − x − 2, f'(x) = 3x² − 1

**Iteration 1:**
$$x_1 = x_0 - \frac{f(x_0)}{f'(x_0)} = 1.5 - \frac{(1.5)^3 - 1.5 - 2}{3(1.5)^2 - 1} = 1.5 - \frac{3.375 - 3.5}{6.75 - 1} = 1.5 - \frac{-0.125}{5.75}$$

$$x_1 = 1.5 + 0.0217 \approx 1.5217$$

**Iteration 2:**
f(1.5217) ≈ 3.527 − 1.5217 − 2 = 0.005 (very close to 0)

After 2 iterations: x ≈ 1.5213... The actual root is x = 1.5214 (verify: 1.5214³ ≈ 3.524).

$$\boxed{x^* \approx 1.5214}$$

---

### Example 2: Simpson's 1/3 Rule

**Problem:** Evaluate $\int_0^1 e^x\,dx$ using Simpson's 1/3 rule with n = 4 subintervals.

**Solution:**

h = (1−0)/4 = 0.25

| xᵢ | f(xᵢ) = eˣⁱ |
|----|------------|
| 0 | 1.0000 |
| 0.25 | 1.2840 |
| 0.5 | 1.6487 |
| 0.75 | 2.1170 |
| 1.0 | 2.7183 |

Simpson's 1/3: Coefficients 1, 4, 2, 4, 1

$$\int_0^1 e^x\,dx \approx \frac{0.25}{3}\left[1.0000 + 4(1.2840) + 2(1.6487) + 4(2.1170) + 2.7183\right]$$

$$= \frac{0.25}{3}\left[1.0000 + 5.1360 + 3.2974 + 8.4680 + 2.7183\right]$$

$$= \frac{0.25}{3} \times 20.6197 = \frac{5.1549}{3} \approx 1.7183$$

Exact value: $e^1 - e^0 = e - 1 \approx 1.7183$ ✓

$$\boxed{\approx 1.7183}$$

---

### Example 3: Euler's Method for ODE

**Problem:** Solve y' = y + x, y(0) = 1 using Euler's method for x = 0 to 0.2 with h = 0.1.

**Solution:**

f(x, y) = y + x

**Step 1 (x₀=0, y₀=1):**
$$y_1 = y_0 + h\cdot f(0, 1) = 1 + 0.1\cdot(1+0) = 1 + 0.1 = 1.1$$

**Step 2 (x₁=0.1, y₁=1.1):**
$$y_2 = y_1 + h\cdot f(0.1, 1.1) = 1.1 + 0.1\cdot(1.1+0.1) = 1.1 + 0.12 = 1.22$$

$$\boxed{y(0.2) \approx 1.22}$$

(Exact solution y = 2eˣ − x − 1 gives y(0.2) = 2e^{0.2} − 1.2 ≈ 2(1.2214) − 1.2 = 1.2428 — Euler's method gives ~1.6% error here.)

---

## 7. Common GATE Traps

### ⚠️ Trap 1: Simpson's 1/3 Rule Requires Even Number of Subintervals
If n is odd, Simpson's 1/3 doesn't apply directly. Use a combination or switch to 3/8 rule.

### ⚠️ Trap 2: Newton-Raphson Formula Direction
It's xₙ₊₁ = xₙ **minus** f/f'. Students sometimes write plus or invert the fraction.

### ⚠️ Trap 3: Convergence Order
Bisection → linear, Secant → 1.618 order, Newton-Raphson → quadratic. GATE often asks which is "faster."

### ⚠️ Trap 4: RK4 k₂ and k₃ Use Half-Step
The arguments for k₂ and k₃ use (xₙ + h/2), not (xₙ + h). This is a common computation error.

### ⚠️ Trap 5: Trapezoidal Error vs. Simpson's Error
Trapezoidal: O(h²); Simpson's: O(h⁴). Simpson's is much more accurate for smooth functions.

---

## 8. Summary

| Method | Type | Order | Notes |
|--------|------|-------|-------|
| Bisection | Root-finding | Linear | Guaranteed convergence |
| Newton-Raphson | Root-finding | Quadratic | Fast, may diverge |
| Trapezoidal | Integration | O(h²) | Simple, less accurate |
| Simpson's 1/3 | Integration | O(h⁴) | n must be even |
| Euler | ODE | O(h) | Simple, poor accuracy |
| RK4 | ODE | O(h⁴) | Standard practical method |

---

*EduGenius GATE EM | Numerical Methods Notes | Difficulty: Medium*
