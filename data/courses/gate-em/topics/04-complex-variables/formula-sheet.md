# Complex Variables — Formula Sheet

> Quick reference for GATE exam

---

## Complex Number Forms

| Form | Expression |
|------|-----------|
| Rectangular | $z = x + iy$ |
| Polar | $z = re^{i\theta} = r(\cos\theta+i\sin\theta)$ |
| Modulus | $|z| = \sqrt{x^2+y^2}$ |
| Conjugate | $\bar{z} = x - iy$ |
| Argument | $\theta = \text{arg}(z) = \tan^{-1}(y/x)$ |

**Euler:** $e^{i\theta}=\cos\theta+i\sin\theta$

**De Moivre:** $(e^{i\theta})^n = e^{in\theta}$

---

## Cauchy-Riemann Equations

For $f(z)=u+iv$ to be analytic:
$$u_x = v_y \quad \text{and} \quad u_y = -v_x$$

Polar form: $u_r = \frac{1}{r}v_\theta$, $v_r = -\frac{1}{r}u_\theta$

**Derivative:** $f'(z) = u_x + iv_x$

---

## Key Theorems

**Cauchy's Theorem:** If $f$ analytic in simply-connected domain D:
$$\oint_C f(z)\,dz = 0$$

**Cauchy's Integral Formula:**
$$f(z_0) = \frac{1}{2\pi i}\oint_C\frac{f(z)}{z-z_0}dz$$

$$f^{(n)}(z_0) = \frac{n!}{2\pi i}\oint_C\frac{f(z)}{(z-z_0)^{n+1}}dz$$

**Residue Theorem:**
$$\oint_C f(z)\,dz = 2\pi i\sum_k\text{Res}(f,z_k)$$

---

## Computing Residues

**Simple pole at $z_0$:**
$$\text{Res}(f,z_0) = \lim_{z\to z_0}(z-z_0)f(z)$$

**For $f=p/q$, simple pole:**
$$\text{Res}(f,z_0) = \frac{p(z_0)}{q'(z_0)}$$

**Pole of order $m$:**
$$\text{Res}(f,z_0) = \frac{1}{(m-1)!}\lim_{z\to z_0}\frac{d^{m-1}}{dz^{m-1}}[(z-z_0)^m f(z)]$$

---

## Singularity Types

| Type | Laurent Series | Example |
|------|---------------|---------|
| Removable | No negative powers | $\frac{\sin z}{z}$ at 0 |
| Pole order $m$ | Finite neg. powers to $(z-z_0)^{-m}$ | $\frac{1}{z^m}$ |
| Essential | Infinite neg. powers | $e^{1/z}$ at 0 |

---

## Laurent Series

$$f(z) = \sum_{n=-\infty}^{\infty}a_n(z-z_0)^n, \quad a_{-1}=\text{Res}(f,z_0)$$

---

## Useful Results

- $\oint_{|z|=1}\frac{1}{z}\,dz = 2\pi i$
- $\oint_{|z|=r} z^n\,dz = 0$ for $n\ne -1$
- If $f$ analytic, $u$ and $v$ are harmonic ($\nabla^2 u=0$)

---

*EduGenius GATE EM | Complex Variables Formula Sheet*
