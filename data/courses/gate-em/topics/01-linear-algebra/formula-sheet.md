# Linear Algebra — Formula Sheet

> Quick reference for GATE exam | Print and memorize

---

## Determinants

| Formula | Description |
|---------|------------|
| $\det(AB) = \det(A)\det(B)$ | Product rule |
| $\det(A^T) = \det(A)$ | Transpose preserves det |
| $\det(kA) = k^n\det(A)$ | Scalar scaling (n×n matrix) |
| $\det(A^{-1}) = 1/\det(A)$ | Inverse determinant |
| $\det(A) = \prod \lambda_i$ | Product of eigenvalues |

---

## Rank and Systems

| Formula | Description |
|---------|------------|
| $\text{rank}(A) + \text{nullity}(A) = n$ | Rank-Nullity theorem |
| $\text{rank}(AB) \le \min(\text{rank}(A), \text{rank}(B))$ | Rank inequality |
| Consistent iff $\rho(A) = \rho([A\|b])$ | Rouché-Capelli |
| Unique soln iff $\rho(A) = \rho([A\|b]) = n$ | Uniqueness condition |
| Infinite solns if $\rho(A) = \rho([A\|b]) < n$ | # free vars = $n - \rho$ |

---

## Eigenvalues & Eigenvectors

| Formula | Description |
|---------|------------|
| $\det(A - \lambda I) = 0$ | Characteristic equation |
| $\sum \lambda_i = \text{tr}(A)$ | Sum of eigenvalues = trace |
| $\prod \lambda_i = \det(A)$ | Product of eigenvalues = det |
| Eigenvalue of $A^k$ is $\lambda^k$ | Power rule |
| Eigenvalue of $A^{-1}$ is $1/\lambda$ | Inverse rule |
| Eigenvalue of $A + cI$ is $\lambda + c$ | Shift rule |
| Eigenvalue of $A^T$ same as $A$ | Transpose rule |

---

## Special Matrices

| Matrix | Definition | Eigenvalue property |
|--------|-----------|-------------------|
| Symmetric | $A^T = A$ | Real eigenvalues |
| Skew-symmetric | $A^T = -A$ | Pure imaginary or 0 |
| Orthogonal | $A^T A = I$ | $|\lambda| = 1$ |
| Idempotent | $A^2 = A$ | $\lambda \in \{0, 1\}$ |
| Nilpotent | $A^k = 0$ | All $\lambda = 0$ |

---

## Cayley-Hamilton

$$p(\lambda) = \det(A - \lambda I) \implies p(A) = 0$$

**For 2×2:** If $p(\lambda) = \lambda^2 - (\text{tr}\, A)\lambda + \det A$, then:
$$A^2 = (\text{tr}\, A)A - (\det A)I$$

---

## Vector Spaces

| Concept | Formula |
|---------|---------|
| Dimension of null space | $n - \text{rank}(A)$ |
| Column space dimension | $\text{rank}(A)$ |
| Row space dimension | $\text{rank}(A)$ |

---

## Inverse (2×2)

$$A = \begin{pmatrix} a & b \\ c & d \end{pmatrix} \implies A^{-1} = \frac{1}{ad-bc}\begin{pmatrix} d & -b \\ -c & a \end{pmatrix}$$

---

## Quadratic Forms

$Q = \mathbf{x}^T A \mathbf{x}$ is:
- **Positive definite** if all eigenvalues > 0
- **Positive semi-definite** if all eigenvalues ≥ 0
- **Negative definite** if all eigenvalues < 0
- **Indefinite** if eigenvalues have mixed signs

---

*EduGenius GATE EM | Linear Algebra Formula Sheet*
