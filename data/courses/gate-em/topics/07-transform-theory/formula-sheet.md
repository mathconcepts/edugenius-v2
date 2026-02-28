# Transform Theory — Formula Sheet

## Laplace Transform

| $f(t)$ | $F(s)$ |
|--------|--------|
| $1$ | $1/s$ |
| $t^n$ | $n!/s^{n+1}$ |
| $e^{at}$ | $1/(s-a)$ |
| $\sin\omega t$ | $\omega/(s^2+\omega^2)$ |
| $\cos\omega t$ | $s/(s^2+\omega^2)$ |
| $te^{at}$ | $1/(s-a)^2$ |
| $\delta(t)$ | $1$ |
| $u(t)$ | $1/s$ |

**Key Properties:**
- $\mathcal{L}\{e^{at}f(t)\} = F(s-a)$ (first shift)
- $\mathcal{L}\{f(t-a)u(t-a)\} = e^{-as}F(s)$ (second shift)
- $\mathcal{L}\{f'\} = sF(s) - f(0)$
- $\mathcal{L}\{f''\} = s^2F(s) - sf(0) - f'(0)$
- $\mathcal{L}\{f*g\} = F(s)\cdot G(s)$

## Fourier Transform

$$F(\omega) = \int_{-\infty}^{\infty} f(t)e^{-j\omega t}dt \quad \leftrightarrow \quad f(t) = \frac{1}{2\pi}\int_{-\infty}^{\infty}F(\omega)e^{j\omega t}d\omega$$

| $f(t)$ | $F(\omega)$ |
|--------|-------------|
| $\text{rect}(t/\tau)$ | $\tau\,\text{sinc}(\omega\tau/2)$ |
| $e^{-a\|t\|}$ | $2a/(a^2+\omega^2)$ |
| $\delta(t)$ | $1$ |
| Gaussian $e^{-at^2}$ | $\sqrt{\pi/a}\,e^{-\omega^2/4a}$ |

**Parseval:** $\int\|f\|^2\,dt = \frac{1}{2\pi}\int\|F\|^2\,d\omega$

## Fourier Series (Period $T$, $\omega_0=2\pi/T$)

$$f(t) = \frac{a_0}{2} + \sum_{n=1}^{\infty}[a_n\cos n\omega_0 t + b_n\sin n\omega_0 t]$$

$$a_n = \frac{2}{T}\int_0^T f(t)\cos n\omega_0 t\,dt, \quad b_n = \frac{2}{T}\int_0^T f(t)\sin n\omega_0 t\,dt$$

## Z-Transform

$$X(z) = \sum_{n=-\infty}^{\infty}x[n]z^{-n}$$

| $x[n]$ | $X(z)$ | ROC |
|--------|---------|-----|
| $\delta[n]$ | $1$ | All $z$ |
| $u[n]$ | $z/(z-1)$ | $\|z\|>1$ |
| $a^nu[n]$ | $z/(z-a)$ | $\|z\|>\|a\|$ |
| $nu[n]$ | $z/(z-1)^2$ | $\|z\|>1$ |
