# Probability & Statistics — Lecture Notes

> GATE Engineering Mathematics | Topic 5 | Weightage: 10–12%

---

## 1. Introduction

Probability is one of the most **consistently tested** topics in GATE. Questions range from basic conditional probability to distribution computations. Statistics tests estimation and hypothesis basics.

**GATE Focus:**
- Bayes' theorem (almost every year)
- Poisson and Normal distributions
- Conditional probability
- Expectation and variance calculations

---

## 2. Probability Foundations

### 2.1 Basic Definitions

- **Sample Space S:** Set of all possible outcomes
- **Event A:** Subset of S
- **Probability:** P(A) ∈ [0,1], P(S) = 1

**Axioms (Kolmogorov):**
1. P(A) ≥ 0
2. P(S) = 1
3. For mutually exclusive A, B: P(A∪B) = P(A) + P(B)

**Complement:** P(A') = 1 − P(A)

**Addition rule:** P(A∪B) = P(A) + P(B) − P(A∩B)

### 2.2 Conditional Probability

$$P(A|B) = \frac{P(A \cap B)}{P(B)}, \quad P(B) > 0$$

**Independence:** A and B are independent iff:
$$P(A \cap B) = P(A) \cdot P(B)$$

### 2.3 Total Probability Theorem

For partition {B₁, B₂, ..., Bₙ} of S:
$$P(A) = \sum_{i=1}^n P(A|B_i) \cdot P(B_i)$$

### 2.4 Bayes' Theorem

$$P(B_k|A) = \frac{P(A|B_k)\cdot P(B_k)}{\sum_{i=1}^n P(A|B_i)\cdot P(B_i)}$$

**Terminology:**
- P(Bₖ) = **prior probability**
- P(A|Bₖ) = **likelihood**
- P(Bₖ|A) = **posterior probability**

---

## 3. Random Variables

### 3.1 Discrete Random Variables

**Probability Mass Function (PMF):** P(X = x)

**Expected Value:** $E[X] = \sum_x x \cdot P(X=x)$

**Variance:** $\text{Var}(X) = E[X^2] - (E[X])^2$

**Useful shortcut:** $E[aX+b] = aE[X]+b$, $\text{Var}(aX+b) = a^2\text{Var}(X)$

### 3.2 Key Discrete Distributions

| Distribution | PMF | Mean | Variance |
|-------------|-----|------|---------|
| **Bernoulli(p)** | $P(X=1)=p, P(X=0)=1-p$ | $p$ | $p(1-p)$ |
| **Binomial(n,p)** | $\binom{n}{k}p^k(1-p)^{n-k}$ | $np$ | $np(1-p)$ |
| **Poisson(λ)** | $\frac{e^{-\lambda}\lambda^k}{k!}$ | $\lambda$ | $\lambda$ |
| **Geometric(p)** | $(1-p)^{k-1}p$ | $1/p$ | $(1-p)/p^2$ |

**Poisson approximation to Binomial:** When n is large, p is small, and np = λ is moderate, Binomial(n,p) ≈ Poisson(λ).

### 3.3 Continuous Random Variables

**Probability Density Function (PDF):** f(x) ≥ 0, ∫f(x)dx = 1

$$P(a \le X \le b) = \int_a^b f(x)\,dx$$

**CDF:** $F(x) = P(X \le x) = \int_{-\infty}^x f(t)\,dt$

**Relationship:** f(x) = F'(x)

### 3.4 Key Continuous Distributions

| Distribution | PDF | Mean | Variance |
|-------------|-----|------|---------|
| **Uniform(a,b)** | $\frac{1}{b-a}$ on $[a,b]$ | $\frac{a+b}{2}$ | $\frac{(b-a)^2}{12}$ |
| **Exponential(λ)** | $\lambda e^{-\lambda x}$, $x\ge 0$ | $1/\lambda$ | $1/\lambda^2$ |
| **Normal(μ,σ²)** | $\frac{1}{\sigma\sqrt{2\pi}}e^{-(x-\mu)^2/2\sigma^2}$ | $\mu$ | $\sigma^2$ |

**Standard Normal:** Z ~ N(0,1). P(Z ≤ z) = Φ(z).

**Standardization:** If X ~ N(μ, σ²), then Z = (X−μ)/σ ~ N(0,1)

**Memoryless property:** Exponential distribution satisfies:
$$P(X > s+t | X > s) = P(X > t)$$

---

## 4. Statistics

### 4.1 Sample Statistics

For sample x₁, x₂, ..., xₙ:

**Sample mean:** $\bar{x} = \frac{1}{n}\sum_{i=1}^n x_i$

**Sample variance:** $s^2 = \frac{1}{n-1}\sum_{i=1}^n (x_i - \bar{x})^2$

### 4.2 Central Limit Theorem

If X₁, X₂, ..., Xₙ are i.i.d. with mean μ and variance σ²:
$$\bar{X} = \frac{1}{n}\sum X_i \xrightarrow{d} N\left(\mu, \frac{\sigma^2}{n}\right) \quad \text{as } n \to \infty$$

### 4.3 Correlation and Covariance

$$\text{Cov}(X,Y) = E[XY] - E[X]E[Y]$$

$$\rho_{XY} = \frac{\text{Cov}(X,Y)}{\sigma_X \sigma_Y}, \quad -1 \le \rho \le 1$$

---

## 5. Worked Examples

### Example 1: Bayes' Theorem

**Problem:** A factory has three machines A, B, C producing 50%, 30%, 20% of total output. Their defect rates are 2%, 3%, 5% respectively. A product is found defective. What is the probability it came from machine B?

**Solution:**

Let events: M_A, M_B, M_C = from machine A, B, C; D = defective.

P(M_A) = 0.5, P(M_B) = 0.3, P(M_C) = 0.2
P(D|M_A) = 0.02, P(D|M_B) = 0.03, P(D|M_C) = 0.05

**Total probability of defect:**
P(D) = P(D|M_A)·P(M_A) + P(D|M_B)·P(M_B) + P(D|M_C)·P(M_C)
= (0.02)(0.5) + (0.03)(0.3) + (0.05)(0.2)
= 0.010 + 0.009 + 0.010 = 0.029

**Bayes' theorem:**
$$P(M_B|D) = \frac{P(D|M_B)\cdot P(M_B)}{P(D)} = \frac{0.03 \times 0.3}{0.029} = \frac{0.009}{0.029} \approx 0.310$$

$$\boxed{P(M_B|D) \approx 31\%}$$

---

### Example 2: Poisson Distribution

**Problem:** Emails arrive at an average rate of 3 per hour. What is the probability of receiving exactly 2 emails in one hour?

**Solution:**

X ~ Poisson(λ = 3)

$$P(X = 2) = \frac{e^{-3} \cdot 3^2}{2!} = \frac{e^{-3} \cdot 9}{2} = 4.5 e^{-3}$$

$$\approx 4.5 \times 0.0498 \approx 0.224$$

$$\boxed{P(X=2) \approx 22.4\%}$$

---

### Example 3: Normal Distribution

**Problem:** Heights of students follow N(170, 25) (in cm). What fraction of students are taller than 175 cm?

**Solution:**

Standardize: Z = (175 − 170)/√25 = 5/5 = 1

P(X > 175) = P(Z > 1) = 1 − Φ(1) = 1 − 0.8413 = **0.1587**

$$\boxed{P(X > 175) \approx 15.87\%}$$

Using standard normal table: Φ(1) ≈ 0.8413, so about 15.9% of students are taller than 175 cm.

---

## 6. Common GATE Traps

### ⚠️ Trap 1: Bayes vs. Total Probability
Bayes gives P(cause|effect); Total Probability gives P(effect). Set up clearly which one is asked.

### ⚠️ Trap 2: Variance of Sum ≠ Sum of Variances (dependent variables)
For INDEPENDENT X, Y: Var(X+Y) = Var(X) + Var(Y). For dependent variables, include covariance terms.

### ⚠️ Trap 3: Poisson Mean vs. Rate
λ in Poisson is the average **for the given time period**. If rate is 3/hour and you want 2-hour probability, use λ = 6.

### ⚠️ Trap 4: P(A∩B) vs. P(A)·P(B)
P(A∩B) = P(A)·P(B) only if A and B are **independent**. Never assume independence without checking.

### ⚠️ Trap 5: Sample Variance Denominator
Population variance uses n; sample variance uses (n−1) as denominator (unbiased estimator). GATE usually specifies which.

---

## 7. Summary

| Concept | Formula |
|---------|---------|
| Bayes' theorem | $P(B|A)=P(A|B)P(B)/P(A)$ |
| Binomial mean | $np$ |
| Binomial variance | $np(1-p)$ |
| Poisson: mean=variance | $\lambda$ |
| Exponential memoryless | $P(X>s+t\|X>s)=P(X>t)$ |
| CLT | $\bar{X}\sim N(\mu,\sigma^2/n)$ |

---

*EduGenius GATE EM | Probability & Statistics Notes | Difficulty: Easy-Medium*
