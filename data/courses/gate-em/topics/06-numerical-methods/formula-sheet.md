# Numerical Methods — Formula Sheet

> Quick reference for GATE exam

---

## Root Finding

**Bisection:** $c = (a+b)/2$; error after $n$ steps $\le (b-a)/2^n$

**Newton-Raphson:**
$$x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}$$
Convergence: Quadratic

**Secant:**
$$x_{n+1} = x_n - f(x_n)\frac{x_n-x_{n-1}}{f(x_n)-f(x_{n-1})}$$
Convergence: Order ≈ 1.618

**False Position:**
$$x = \frac{af(b)-bf(a)}{f(b)-f(a)}$$

**Convergence speed:** NR > Secant > Bisection

---

## Numerical Integration ($h = (b-a)/n$)

**Trapezoidal Rule:**
$$\int_a^b f\,dx \approx \frac{h}{2}[f_0+2f_1+\cdots+2f_{n-1}+f_n]$$
Error: $O(h^2)$, exact for deg ≤ 1

**Simpson's 1/3 Rule** (n even):
$$\int_a^b f\,dx \approx \frac{h}{3}[f_0+4f_1+2f_2+4f_3+\cdots+4f_{n-1}+f_n]$$
Error: $O(h^4)$, exact for deg ≤ 3

Pattern: **1, 4, 2, 4, 2, ..., 4, 1**

**Simpson's 3/8 Rule** (n mult. of 3):
$$\int_a^b f\,dx \approx \frac{3h}{8}[f_0+3f_1+3f_2+2f_3+3f_4+\cdots+f_n]$$

Pattern: **1, 3, 3, 2, 3, 3, 2, ..., 1**

---

## Numerical ODE Methods: $y'=f(x,y),\ y(x_0)=y_0$

**Euler's Method:**
$$y_{n+1} = y_n + h\cdot f(x_n,y_n)$$
Error: $O(h)$

**Modified Euler (Heun's):**
$$y_{n+1} = y_n + \frac{h}{2}[f(x_n,y_n)+f(x_{n+1},y_n+hf(x_n,y_n))]$$

**Runge-Kutta 4 (RK4):**
$$y_{n+1} = y_n + \frac{h}{6}(k_1+2k_2+2k_3+k_4)$$

$$k_1=f(x_n,y_n)$$
$$k_2=f\!\left(x_n+\tfrac{h}{2},y_n+\tfrac{h}{2}k_1\right)$$
$$k_3=f\!\left(x_n+\tfrac{h}{2},y_n+\tfrac{h}{2}k_2\right)$$
$$k_4=f(x_n+h,y_n+hk_3)$$

Error: $O(h^4)$

---

## Interpolation

**Lagrange (2 points):**
$$P(x)=y_0\frac{x-x_1}{x_0-x_1}+y_1\frac{x-x_0}{x_1-x_0}$$

**Newton's Forward Difference:**
$$P(x)=y_0+u\Delta y_0+\frac{u(u-1)}{2!}\Delta^2 y_0+\cdots$$
where $u=(x-x_0)/h$

---

## Method Comparison

| Method | Order | Guaranteed? |
|--------|-------|-------------|
| Bisection | 1 (linear) | Yes |
| Newton-Raphson | 2 (quadratic) | Near root |
| Trapezoidal rule | $O(h^2)$ | Yes |
| Simpson's 1/3 | $O(h^4)$ | Yes |
| Euler's ODE | $O(h)$ | Yes |
| RK4 | $O(h^4)$ | Yes |

---

*EduGenius GATE EM | Numerical Methods Formula Sheet*
