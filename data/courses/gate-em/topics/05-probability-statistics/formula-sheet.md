# Probability & Statistics — Formula Sheet

> Quick reference for GATE exam

---

## Probability Rules

| Rule | Formula |
|------|---------|
| Complement | $P(A') = 1 - P(A)$ |
| Addition | $P(A\cup B)=P(A)+P(B)-P(A\cap B)$ |
| Multiplication | $P(A\cap B)=P(A|B)\cdot P(B)$ |
| Independence | $P(A\cap B)=P(A)\cdot P(B)$ |
| Conditional | $P(A|B)=P(A\cap B)/P(B)$ |

**Total Probability:**
$$P(A) = \sum_i P(A|B_i)P(B_i)$$

**Bayes' Theorem:**
$$P(B_k|A) = \frac{P(A|B_k)P(B_k)}{\sum_i P(A|B_i)P(B_i)}$$

---

## Discrete Distributions

| Distribution | PMF | Mean | Var |
|-------------|-----|------|-----|
| Bernoulli(p) | $P(1)=p$ | $p$ | $p(1-p)$ |
| Binomial(n,p) | $\binom{n}{k}p^k(1-p)^{n-k}$ | $np$ | $np(1-p)$ |
| Poisson(λ) | $e^{-\lambda}\lambda^k/k!$ | $\lambda$ | $\lambda$ |
| Geometric(p) | $(1-p)^{k-1}p$ | $1/p$ | $(1-p)/p^2$ |

---

## Continuous Distributions

| Distribution | PDF | Mean | Var |
|-------------|-----|------|-----|
| Uniform(a,b) | $\frac{1}{b-a}$ | $\frac{a+b}{2}$ | $\frac{(b-a)^2}{12}$ |
| Exponential(λ) | $\lambda e^{-\lambda x}, x\ge 0$ | $1/\lambda$ | $1/\lambda^2$ |
| Normal(μ,σ²) | $\frac{1}{\sigma\sqrt{2\pi}}e^{-(x-\mu)^2/2\sigma^2}$ | $\mu$ | $\sigma^2$ |

---

## Expectation & Variance

$$E[aX+b] = aE[X]+b$$

$$\text{Var}(aX+b) = a^2\text{Var}(X)$$

$$\text{Var}(X) = E[X^2]-(E[X])^2$$

$$E[X+Y] = E[X]+E[Y] \text{ (always)}$$

$$\text{Var}(X+Y) = \text{Var}(X)+\text{Var}(Y) \text{ (if independent)}$$

---

## Normal Distribution

Standard form: $Z = (X-\mu)/\sigma \sim N(0,1)$

Key values of $\Phi(z)$ = P(Z ≤ z):

| z | Φ(z) |
|---|------|
| 1.0 | 0.8413 |
| 1.5 | 0.9332 |
| 1.96 | 0.9750 |
| 2.0 | 0.9772 |

$P(|Z|\le 1) \approx 0.683$, $P(|Z|\le 2) \approx 0.954$

---

## Covariance & Correlation

$$\text{Cov}(X,Y)=E[XY]-E[X]E[Y]$$

$$\rho = \frac{\text{Cov}(X,Y)}{\sigma_X\sigma_Y}, \quad -1\le\rho\le 1$$

---

## Central Limit Theorem

$$\bar{X}\sim N\!\left(\mu,\frac{\sigma^2}{n}\right) \quad \text{(large } n\text{)}$$

---

*EduGenius GATE EM | Probability & Statistics Formula Sheet*
