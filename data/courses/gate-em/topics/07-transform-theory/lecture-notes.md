# Transform Theory — GATE Engineering Mathematics

## Introduction

Transform methods convert differential equations and complex operations into algebraic problems in a transformed domain. The three key transforms in GATE EM are **Laplace**, **Fourier**, and **Z-transforms**.

GATE weightage: ~8–10% (5–7 marks)

---

## 1. Laplace Transform

### Definition

$$\mathcal{L}\{f(t)\} = F(s) = \int_0^{\infty} f(t) e^{-st} \, dt, \quad \text{Re}(s) > \sigma_0$$

Exists when the integral converges for some $s$.

### Standard Laplace Transforms

| $f(t)$ | $F(s) = \mathcal{L}\{f(t)\}$ |
|--------|-------------------------------|
| $1$ | $\dfrac{1}{s}$ |
| $t^n$ | $\dfrac{n!}{s^{n+1}}$ |
| $e^{at}$ | $\dfrac{1}{s-a}$ |
| $\sin(\omega t)$ | $\dfrac{\omega}{s^2+\omega^2}$ |
| $\cos(\omega t)$ | $\dfrac{s}{s^2+\omega^2}$ |
| $t \cdot e^{at}$ | $\dfrac{1}{(s-a)^2}$ |
| $\delta(t)$ | $1$ |
| $u(t)$ | $\dfrac{1}{s}$ |

### Key Properties

**Linearity:**
$$\mathcal{L}\{af(t) + bg(t)\} = aF(s) + bG(s)$$

**First Shifting (s-domain):**
$$\mathcal{L}\{e^{at}f(t)\} = F(s-a)$$

**Second Shifting (t-domain):**
$$\mathcal{L}\{f(t-a)u(t-a)\} = e^{-as}F(s)$$

**Differentiation:**
$$\mathcal{L}\{f'(t)\} = sF(s) - f(0)$$
$$\mathcal{L}\{f''(t)\} = s^2F(s) - sf(0) - f'(0)$$

**Integration:**
$$\mathcal{L}\left\{\int_0^t f(\tau)d\tau\right\} = \frac{F(s)}{s}$$

**Convolution:**
$$\mathcal{L}\{f * g\} = F(s) \cdot G(s)$$

### Inverse Laplace Transform

Use partial fractions to decompose $F(s)$, then apply standard tables.

**Example:** Find $\mathcal{L}^{-1}\left\{\dfrac{1}{(s+1)(s+2)}\right\}$

Partial fractions: $\dfrac{1}{(s+1)(s+2)} = \dfrac{1}{s+1} - \dfrac{1}{s+2}$

$$\mathcal{L}^{-1} = e^{-t} - e^{-2t}$$

---

## 2. Fourier Transform

### Definition

$$F(\omega) = \mathcal{F}\{f(t)\} = \int_{-\infty}^{\infty} f(t) e^{-j\omega t} \, dt$$

$$f(t) = \mathcal{F}^{-1}\{F(\omega)\} = \frac{1}{2\pi}\int_{-\infty}^{\infty} F(\omega) e^{j\omega t} \, d\omega$$

### Key Fourier Transform Pairs

| $f(t)$ | $F(\omega)$ |
|--------|-------------|
| $\text{rect}(t/\tau)$ | $\tau \cdot \text{sinc}(\omega\tau/2)$ |
| $e^{-a|t|}$ | $\dfrac{2a}{a^2+\omega^2}$ |
| $\delta(t)$ | $1$ |
| $1$ | $2\pi\delta(\omega)$ |
| $e^{j\omega_0 t}$ | $2\pi\delta(\omega - \omega_0)$ |
| $\text{sinc}(Wt)$ | $\text{rect}(\omega/2W)$ |

### Parseval's Theorem

$$\int_{-\infty}^{\infty} |f(t)|^2 \, dt = \frac{1}{2\pi}\int_{-\infty}^{\infty} |F(\omega)|^2 \, d\omega$$

Energy in time domain = Energy in frequency domain.

### Fourier Series

For periodic function $f(t)$ with period $T$:

$$f(t) = \frac{a_0}{2} + \sum_{n=1}^{\infty}[a_n\cos(n\omega_0 t) + b_n\sin(n\omega_0 t)]$$

where $\omega_0 = 2\pi/T$ and:

$$a_n = \frac{2}{T}\int_0^T f(t)\cos(n\omega_0 t)\,dt, \quad b_n = \frac{2}{T}\int_0^T f(t)\sin(n\omega_0 t)\,dt$$

**Dirichlet Conditions:** $f(t)$ must be piecewise smooth with finite discontinuities.

---

## 3. Z-Transform

### Definition

$$X(z) = \mathcal{Z}\{x[n]\} = \sum_{n=-\infty}^{\infty} x[n] z^{-n}$$

### Standard Z-Transforms

| $x[n]$ | $X(z)$ | ROC |
|--------|---------|-----|
| $u[n]$ | $\dfrac{z}{z-1}$ | $|z|>1$ |
| $a^n u[n]$ | $\dfrac{z}{z-a}$ | $|z|>|a|$ |
| $n \cdot u[n]$ | $\dfrac{z}{(z-1)^2}$ | $|z|>1$ |
| $\delta[n]$ | $1$ | All $z$ |

### Region of Convergence (ROC)

- **Causal sequences:** ROC is exterior of a circle ($|z| > r$)
- **Anti-causal:** ROC is interior ($|z| < r$)
- **Two-sided:** ROC is an annulus

---

## 4. Worked Examples

### Example 1: Solve ODE using Laplace Transform

Solve: $y'' + 3y' + 2y = 0$, $y(0) = 1$, $y'(0) = 0$

Taking Laplace: $(s^2Y - s) + 3(sY - 1) + 2Y = 0$

$(s^2 + 3s + 2)Y = s + 3$

$Y = \dfrac{s+3}{(s+1)(s+2)} = \dfrac{2}{s+1} - \dfrac{1}{s+2}$

**Solution:** $y(t) = 2e^{-t} - e^{-2t}$

### Example 2: Fourier Transform of Gaussian

$f(t) = e^{-at^2}$ has FT: $F(\omega) = \sqrt{\pi/a} \cdot e^{-\omega^2/4a}$

The Fourier transform of a Gaussian is also a Gaussian — wide in time → narrow in frequency.

### Example 3: Z-Transform

Find the Z-transform of $x[n] = (0.5)^n u[n]$:

$$X(z) = \sum_{n=0}^{\infty} (0.5)^n z^{-n} = \sum_{n=0}^{\infty} (0.5/z)^n = \frac{1}{1-0.5/z} = \frac{z}{z-0.5}, \quad |z|>0.5$$

---

## 5. Common GATE Traps

1. **Shifting theorem confusion:** First shift is in $s$-domain ($e^{at}$ multiplication), second shift is in $t$-domain (time delay). Don't mix them.

2. **Initial conditions in Laplace:** $\mathcal{L}\{f''\} = s^2F - sf(0) - f'(0)$ — always include initial conditions.

3. **ROC in Z-transform:** Same $X(z)$ expression can correspond to different signals depending on ROC. ROC determines causal vs. anti-causal.

4. **Fourier vs Laplace:** Laplace works for $t \geq 0$ (causal); Fourier works for all $t \in (-\infty, \infty)$.

5. **Parseval's theorem:** Energy computation — remember the $1/2\pi$ factor on the frequency side.

---

## Summary

| Transform | Domain | Best For |
|-----------|--------|----------|
| Laplace | $s = \sigma + j\omega$ | Causal ODEs, control systems |
| Fourier | $j\omega$ | Spectral analysis, periodic signals |
| Z-transform | $z$ | Discrete-time systems |

All three convert differential/difference equations → algebraic equations.
