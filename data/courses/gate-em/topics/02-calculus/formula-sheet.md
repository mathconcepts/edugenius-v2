# Calculus — Formula Sheet

> Quick reference for GATE exam

---

## Standard Limits

| Limit | Value |
|-------|-------|
| $\lim_{x\to 0}\frac{\sin x}{x}$ | $1$ |
| $\lim_{x\to 0}\frac{e^x-1}{x}$ | $1$ |
| $\lim_{x\to 0}\frac{\ln(1+x)}{x}$ | $1$ |
| $\lim_{x\to\infty}(1+1/x)^x$ | $e$ |
| $\lim_{x\to 0}(1+x)^{1/x}$ | $e$ |

---

## Key Derivatives

| $f(x)$ | $f'(x)$ |
|--------|---------|
| $x^n$ | $nx^{n-1}$ |
| $e^{ax}$ | $ae^{ax}$ |
| $\ln x$ | $1/x$ |
| $\sin x$ | $\cos x$ |
| $\cos x$ | $-\sin x$ |
| $\tan x$ | $\sec^2 x$ |
| $\sin^{-1}x$ | $1/\sqrt{1-x^2}$ |
| $\cos^{-1}x$ | $-1/\sqrt{1-x^2}$ |
| $\tan^{-1}x$ | $1/(1+x^2)$ |

---

## Maclaurin Series

$$e^x = \sum_{n=0}^{\infty}\frac{x^n}{n!} = 1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+\cdots$$

$$\sin x = x - \frac{x^3}{3!}+\frac{x^5}{5!}-\cdots$$

$$\cos x = 1 - \frac{x^2}{2!}+\frac{x^4}{4!}-\cdots$$

$$\ln(1+x) = x-\frac{x^2}{2}+\frac{x^3}{3}-\cdots \quad |x|\le 1$$

$$(1+x)^n = 1+nx+\frac{n(n-1)}{2!}x^2+\cdots$$

---

## Standard Integrals

| $\int f(x)\,dx$ | Result |
|----------------|--------|
| $x^n$ | $x^{n+1}/(n+1)$ |
| $1/x$ | $\ln|x|$ |
| $e^{ax}$ | $e^{ax}/a$ |
| $\sin ax$ | $-\cos ax/a$ |
| $\cos ax$ | $\sin ax/a$ |
| $1/\sqrt{a^2-x^2}$ | $\sin^{-1}(x/a)$ |
| $1/(a^2+x^2)$ | $\frac{1}{a}\tan^{-1}(x/a)$ |

---

## Special Definite Integrals

$$\int_0^{\pi/2}\sin^n x\,dx = \int_0^{\pi/2}\cos^n x\,dx = \frac{(n-1)!!}{n!!}\times\begin{cases}\pi/2 & n \text{ even}\\1 & n \text{ odd}\end{cases}$$

$$\int_{-a}^{a}f(x)\,dx = \begin{cases}2\int_0^a f(x)\,dx & f \text{ even}\\0 & f \text{ odd}\end{cases}$$

$$\int_0^\infty e^{-ax^2}\,dx = \frac{1}{2}\sqrt{\frac{\pi}{a}}$$

$$\int_0^\infty x^n e^{-x}\,dx = \Gamma(n+1) = n!$$

---

## Multivariable

**Chain Rule:** $\frac{df}{dt} = \frac{\partial f}{\partial x}\dot{x} + \frac{\partial f}{\partial y}\dot{y}$

**Jacobian:** $J = \frac{\partial(u,v)}{\partial(x,y)} = \begin{vmatrix}u_x & u_y\\v_x & v_y\end{vmatrix}$

**D-test for critical pts of f(x,y):**
$D = f_{xx}f_{yy} - f_{xy}^2$

| Condition | Type |
|-----------|------|
| $D>0, f_{xx}>0$ | Local min |
| $D>0, f_{xx}<0$ | Local max |
| $D<0$ | Saddle point |

---

## MVT & Rolle's Theorem

- **MVT:** $\exists\, c\in(a,b): f'(c)=\frac{f(b)-f(a)}{b-a}$
- **Rolle's:** If $f(a)=f(b)$, then $\exists\, c: f'(c)=0$

---

*EduGenius GATE EM | Calculus Formula Sheet*
