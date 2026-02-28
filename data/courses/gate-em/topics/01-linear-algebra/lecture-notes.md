# Linear Algebra — Lecture Notes

> GATE Engineering Mathematics | Topic 1 | Weightage: 12–15%

---

## 1. Introduction

Linear Algebra is the **highest-weightage topic** in GATE Engineering Mathematics. Questions appear across all engineering streams and test understanding of matrices, determinants, eigenvalues, and vector spaces.

**Why it matters for GATE:**
- 3–4 marks in almost every GATE paper
- Direct formula application questions (time-efficient)
- Foundation for Control Systems, Networks, Signals, and Machine Learning

**What GATE tests:**
- Finding rank, eigenvalues, eigenvectors
- Consistency of linear systems
- Cayley-Hamilton applications
- Properties of special matrices

---

## 2. Core Concepts

### 2.1 Types of Matrices

| Type | Definition | Property |
|------|-----------|---------|
| Square | m = n | Has determinant |
| Symmetric | A = Aᵀ | Eigenvalues are real |
| Skew-symmetric | A = −Aᵀ | Diagonal elements = 0 |
| Orthogonal | AᵀA = I | Eigenvalues: ±1 |
| Diagonal | aᵢⱼ = 0 for i ≠ j | Eigenvalues on diagonal |
| Identity | I | All eigenvalues = 1 |
| Nilpotent | Aᵏ = 0 for some k | All eigenvalues = 0 |
| Idempotent | A² = A | Eigenvalues: 0 or 1 |

### 2.2 Determinant Properties

For an n×n matrix A:

$$\det(AB) = \det(A)\cdot\det(B)$$

$$\det(A^T) = \det(A)$$

$$\det(kA) = k^n \det(A)$$

$$\det(A^{-1}) = \frac{1}{\det(A)}$$

**Row operations and determinant:**
- Swapping two rows: multiplies det by −1
- Multiplying a row by k: multiplies det by k
- Adding multiple of one row to another: det unchanged

### 2.3 Rank of a Matrix

The **rank** of matrix A is the maximum number of linearly independent rows (or columns).

$$\text{rank}(A) = r \iff \text{largest non-zero minor has order } r$$

**Rank-Nullity Theorem:**
$$\text{rank}(A) + \text{nullity}(A) = n \quad \text{(number of columns)}$$

where nullity = number of free variables = dim(null space).

**Computing rank:**
1. Perform row reduction to echelon form
2. Count non-zero rows → that's the rank

### 2.4 System of Linear Equations

For system Ax = b where A is m×n:

**Augmented matrix:** [A | b]

**Rouché-Capelli Theorem:**
- System is **consistent** iff rank(A) = rank([A|b])
- If consistent and rank(A) = n: **unique solution**
- If consistent and rank(A) < n: **infinite solutions** (n − rank(A) free variables)
- If rank(A) ≠ rank([A|b]): **no solution** (inconsistent)

---

## 3. Eigenvalues and Eigenvectors

### 3.1 Definitions

For matrix A, scalar λ is an **eigenvalue** if:
$$Ax = \lambda x \quad \text{for some non-zero vector } x$$

Vector x is the corresponding **eigenvector**.

**Characteristic equation:**
$$\det(A - \lambda I) = 0$$

The polynomial p(λ) = det(A − λI) is the **characteristic polynomial**.

### 3.2 Properties of Eigenvalues

For an n×n matrix A with eigenvalues λ₁, λ₂, ..., λₙ:

$$\sum_{i=1}^n \lambda_i = \text{trace}(A) = \sum_{i=1}^n a_{ii}$$

$$\prod_{i=1}^n \lambda_i = \det(A)$$

**Important results:**
- If A has eigenvalue λ, then Aᵏ has eigenvalue λᵏ
- If A is invertible with eigenvalue λ, then A⁻¹ has eigenvalue 1/λ
- Eigenvalues of A and Aᵀ are the same
- For a triangular matrix, eigenvalues = diagonal entries
- For a symmetric matrix, eigenvalues are always **real**
- For an orthogonal matrix, |λᵢ| = 1 for all eigenvalues

### 3.3 Cayley-Hamilton Theorem

**Every matrix satisfies its own characteristic equation.**

If the characteristic polynomial of A is:
$$p(\lambda) = \lambda^n + c_{n-1}\lambda^{n-1} + \cdots + c_1\lambda + c_0$$

Then:
$$p(A) = A^n + c_{n-1}A^{n-1} + \cdots + c_1A + c_0I = 0$$

**Application:** Used to find A⁻¹ and powers of A without direct computation.

### 3.4 Diagonalization

Matrix A is **diagonalizable** if there exists invertible P such that:
$$P^{-1}AP = D = \text{diag}(\lambda_1, \lambda_2, \ldots, \lambda_n)$$

where columns of P are eigenvectors of A.

**Condition:** A is diagonalizable iff it has n linearly independent eigenvectors.
- Symmetric matrices are always diagonalizable
- Distinct eigenvalues → automatically diagonalizable

---

## 4. Key Theorems and Methods

### 4.1 Gaussian Elimination

Convert [A|b] to row echelon form:
1. Find leftmost non-zero column
2. Create pivot (leading 1) using row scaling
3. Eliminate all other entries in that column
4. Repeat for submatrix

### 4.2 Finding Inverse via Augmented Matrix

$$[A | I] \xrightarrow{\text{row reduce}} [I | A^{-1}]$$

A⁻¹ exists iff det(A) ≠ 0 iff rank(A) = n.

### 4.3 LU Decomposition

Any matrix A = LU where L is lower triangular, U is upper triangular.
Used for efficient solving of Ax = b.

---

## 5. Worked Examples

### Example 1: Finding Eigenvalues

**Problem:** Find the eigenvalues of $A = \begin{pmatrix} 4 & 1 \\ 2 & 3 \end{pmatrix}$

**Solution:**

Characteristic equation: det(A − λI) = 0

$$\det\begin{pmatrix} 4-\lambda & 1 \\ 2 & 3-\lambda \end{pmatrix} = 0$$

$$(4-\lambda)(3-\lambda) - (1)(2) = 0$$

$$12 - 7\lambda + \lambda^2 - 2 = 0$$

$$\lambda^2 - 7\lambda + 10 = 0$$

$$(\lambda - 5)(\lambda - 2) = 0$$

$$\boxed{\lambda_1 = 5, \quad \lambda_2 = 2}$$

**Verification:** trace(A) = 4 + 3 = 7 = 5 + 2 ✓, det(A) = 12 − 2 = 10 = 5 × 2 ✓

---

### Example 2: Consistency Check

**Problem:** Check if the system is consistent and find solution:
$$x + y + z = 6, \quad 2x + y - z = 1, \quad x + 2y + 3z = 14$$

**Solution:**

Write augmented matrix [A|b]:
$$\begin{pmatrix} 1 & 1 & 1 & | & 6 \\ 2 & 1 & -1 & | & 1 \\ 1 & 2 & 3 & | & 14 \end{pmatrix}$$

R₂ → R₂ − 2R₁, R₃ → R₃ − R₁:
$$\begin{pmatrix} 1 & 1 & 1 & | & 6 \\ 0 & -1 & -3 & | & -11 \\ 0 & 1 & 2 & | & 8 \end{pmatrix}$$

R₃ → R₃ + R₂:
$$\begin{pmatrix} 1 & 1 & 1 & | & 6 \\ 0 & -1 & -3 & | & -11 \\ 0 & 0 & -1 & | & -3 \end{pmatrix}$$

rank(A) = rank([A|b]) = 3 = n → **unique solution**.

Back-substitute: z = 3, y = 11 − 3(3) = 2, x = 6 − 2 − 3 = 1.

$$\boxed{x = 1, \quad y = 2, \quad z = 3}$$

---

### Example 3: Cayley-Hamilton Application

**Problem:** If $A = \begin{pmatrix} 1 & 2 \\ 0 & 3 \end{pmatrix}$, find A⁵ using Cayley-Hamilton.

**Solution:**

Characteristic polynomial: det(A − λI) = (1−λ)(3−λ) = 0
$$\lambda^2 - 4\lambda + 3 = 0$$

By Cayley-Hamilton: A² − 4A + 3I = 0, so **A² = 4A − 3I**

Therefore:
- A³ = A·A² = A(4A − 3I) = 4A² − 3A = 4(4A − 3I) − 3A = 13A − 12I
- A⁴ = A·A³ = A(13A − 12I) = 13A² − 12A = 13(4A−3I) − 12A = 40A − 39I
- A⁵ = A·A⁴ = A(40A − 39I) = 40A² − 39A = 40(4A−3I) − 39A = **121A − 120I**

$$A^5 = 121\begin{pmatrix} 1 & 2 \\ 0 & 3 \end{pmatrix} - 120\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix} = \begin{pmatrix} 1 & 242 \\ 0 & 243 \end{pmatrix}$$

$$\boxed{A^5 = \begin{pmatrix} 1 & 242 \\ 0 & 243 \end{pmatrix}}$$

---

## 6. Common GATE Traps

### ⚠️ Trap 1: Zero Eigenvalue vs. Singular Matrix
A matrix with eigenvalue 0 is **singular** (non-invertible). This is a two-way equivalence:
- λ = 0 is an eigenvalue ↔ det(A) = 0 ↔ A is singular ↔ Ax = 0 has non-trivial solutions.

### ⚠️ Trap 2: Rank vs. Number of Non-zero Rows
After row reduction, **count pivots (leading entries)**, NOT just non-zero rows. A row like [0 0 1] is non-zero but only has one pivot.

### ⚠️ Trap 3: Eigenvalues of A² vs. (eigenvalues of A)²
These ARE equal: if λ is eigenvalue of A, then λ² is eigenvalue of A². But **eigenvectors of A and A² are the same**!

### ⚠️ Trap 4: Trace and Determinant Shortcuts
In MCQs, use trace = sum of eigenvalues and det = product of eigenvalues to **verify answers quickly** without full computation.

### ⚠️ Trap 5: Homogeneous System
Ax = 0 always has the trivial solution x = 0. It has **non-trivial** solutions only when rank(A) < n (i.e., when A is singular).

### ⚠️ Trap 6: Orthogonal ≠ Symmetric
Don't confuse orthogonal matrices (AᵀA = I) with symmetric matrices (A = Aᵀ). A matrix can be both (like the identity) or neither.

---

## 7. Summary

| Concept | Key Formula/Fact |
|---------|----------------|
| Characteristic eq. | det(A − λI) = 0 |
| Trace | Sum of eigenvalues = sum of diagonal |
| Determinant | Product of eigenvalues |
| Rank-Nullity | rank + nullity = n |
| Cayley-Hamilton | p(A) = 0 |
| Consistency | rank(A) = rank([A\|b]) |
| Unique solution | rank(A) = rank([A\|b]) = n |
| Infinite solutions | rank(A) = rank([A\|b]) < n |

**GATE strategy:** For eigenvalue MCQs, always compute trace and det first — it often eliminates 2–3 options immediately, saving computation time.

---

*EduGenius GATE EM | Linear Algebra Notes | Difficulty: Medium*
