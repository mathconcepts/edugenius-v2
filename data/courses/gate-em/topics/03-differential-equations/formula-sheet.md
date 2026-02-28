# Differential Equations — Formula Sheet

> Quick reference for GATE exam

---

## First-Order ODEs

**Separable:** $\frac{dy}{dx}=f(x)g(y)$ → $\int\frac{dy}{g(y)}=\int f(x)dx$

**Linear:** $y'+P(x)y=Q(x)$
- IF: $\mu=e^{\int P\,dx}$
- Solution: $y\mu = \int Q\mu\,dx + C$

**Exact:** $M\,dx + N\,dy=0$ exact iff $M_y = N_x$

**Bernoulli:** $y'+Py=Qy^n$ → let $v=y^{1-n}$

---

## Second-Order: $ay''+by'+cy=0$

Characteristic equation: $ar^2+br+c=0$

| Root type | Solution |
|-----------|----------|
| Real distinct $r_1\ne r_2$ | $y=c_1e^{r_1x}+c_2e^{r_2x}$ |
| Repeated $r_1=r_2=r$ | $y=(c_1+c_2x)e^{rx}$ |
| Complex $\alpha\pm\beta i$ | $y=e^{\alpha x}(c_1\cos\beta x+c_2\sin\beta x)$ |

---

## Non-Homogeneous: $y''+py'+qy=f(x)$

$y = y_h + y_p$

**Undetermined Coefficients:**

| $f(x)$ | Trial $y_p$ |
|--------|------------|
| $Ke^{ax}$ | $Ae^{ax}$ |
| $K\sin bx$ or $K\cos bx$ | $A\cos bx+B\sin bx$ |
| $Kx^n$ | $A_nx^n+\cdots+A_0$ |
| Resonance case | Multiply trial by $x$ |

**Wronskian:** $W = y_1y_2'-y_2y_1'$

**Variation of Parameters:**
$$y_p = -y_1\int\frac{y_2f}{W}\,dx + y_2\int\frac{y_1f}{W}\,dx$$

---

## Euler-Cauchy: $x^2y''+axy'+by=0$

Try $y=x^m$: $m(m-1)+am+b=0$

---

## PDE Classification: $Au_{xx}+Bu_{xy}+Cu_{yy}+\ldots=0$

| $\Delta=B^2-4AC$ | Type | Example |
|-----------------|------|---------|
| $<0$ | Elliptic | $u_{xx}+u_{yy}=0$ (Laplace) |
| $=0$ | Parabolic | $u_t=\alpha^2u_{xx}$ (Heat) |
| $>0$ | Hyperbolic | $u_{tt}=c^2u_{xx}$ (Wave) |

---

## Important PDEs

- **Heat:** $u_t = \alpha^2 u_{xx}$ (Parabolic)
- **Wave:** $u_{tt} = c^2 u_{xx}$ (Hyperbolic)
- **Laplace:** $u_{xx}+u_{yy}=0$ (Elliptic)

---

## General ODE Form Reference

$$\frac{d^ny}{dx^n}+p_1\frac{d^{n-1}y}{dx^{n-1}}+\cdots+p_ny=0$$

Order = highest derivative; Degree = power of highest derivative (when polynomial in derivatives).

---

*EduGenius GATE EM | Differential Equations Formula Sheet*
