# Discrete Mathematics — GATE Engineering Mathematics

## Introduction

Discrete Mathematics covers logic, set theory, combinatorics, and relations. It's foundational for both GATE EM and CS. GATE weightage: ~6–8%.

---

## 1. Mathematical Logic

### Propositional Logic

| Connective | Symbol | Truth condition |
|------------|--------|-----------------|
| AND (Conjunction) | $p \land q$ | Both true |
| OR (Disjunction) | $p \lor q$ | At least one true |
| NOT (Negation) | $\lnot p$ | Opposite |
| IMPLIES | $p \to q$ | False only when p=T, q=F |
| IFF (Biconditional) | $p \leftrightarrow q$ | Same truth value |

### Important Tautologies

- $p \lor \lnot p$ — Law of Excluded Middle
- $\lnot(p \land \lnot p)$ — Law of Non-contradiction
- $p \to q \equiv \lnot p \lor q$ — Implication equivalence
- $\lnot(p \to q) \equiv p \land \lnot q$ — Negation of implication
- $(p \to q) \land (q \to r) \to (p \to r)$ — Hypothetical syllogism

### De Morgan's Laws

$$\lnot(p \land q) \equiv \lnot p \lor \lnot q$$
$$\lnot(p \lor q) \equiv \lnot p \land \lnot q$$

---

## 2. Set Theory

### Basic Operations

- **Union:** $A \cup B = \{x : x \in A \text{ or } x \in B\}$
- **Intersection:** $A \cap B = \{x : x \in A \text{ and } x \in B\}$
- **Complement:** $A^c = \{x : x \notin A\}$
- **Difference:** $A - B = \{x : x \in A, x \notin B\}$
- **Symmetric Difference:** $A \triangle B = (A-B) \cup (B-A)$

### Inclusion-Exclusion Principle

$$|A \cup B| = |A| + |B| - |A \cap B|$$

$$|A \cup B \cup C| = |A| + |B| + |C| - |A \cap B| - |B \cap C| - |A \cap C| + |A \cap B \cap C|$$

### Power Set

The power set $\mathcal{P}(A)$ has $2^n$ elements when $|A| = n$.

---

## 3. Combinatorics

### Fundamental Counting

- **Rule of Product:** If task 1 has $m$ ways and task 2 has $n$ ways (independent), total = $m \times n$
- **Rule of Sum:** If task 1 has $m$ ways OR task 2 has $n$ ways (mutually exclusive), total = $m + n$

### Permutations and Combinations

$$P(n,r) = \frac{n!}{(n-r)!} \quad \text{(ordered selection)}$$

$$C(n,r) = \binom{n}{r} = \frac{n!}{r!(n-r)!} \quad \text{(unordered selection)}$$

### Binomial Theorem

$$(x+y)^n = \sum_{k=0}^{n} \binom{n}{k} x^{n-k} y^k$$

Key identities:
- $\binom{n}{r} = \binom{n}{n-r}$
- $\binom{n}{r} + \binom{n}{r+1} = \binom{n+1}{r+1}$ (Pascal's identity)

### Pigeonhole Principle

If $n+1$ objects are placed in $n$ boxes, at least one box contains $\geq 2$ objects.

**Generalized:** If $kn+1$ objects → $n$ boxes, some box has $\geq k+1$ objects.

---

## 4. Relations

### Properties of Relations on Set A

| Property | Definition |
|----------|------------|
| **Reflexive** | $(a,a) \in R$ for all $a \in A$ |
| **Irreflexive** | $(a,a) \notin R$ for all $a \in A$ |
| **Symmetric** | $(a,b) \in R \Rightarrow (b,a) \in R$ |
| **Antisymmetric** | $(a,b) \in R$ and $(b,a) \in R \Rightarrow a=b$ |
| **Transitive** | $(a,b) \in R$ and $(b,c) \in R \Rightarrow (a,c) \in R$ |

### Equivalence Relation

A relation that is **reflexive + symmetric + transitive**.

Equivalence relations partition a set into **equivalence classes**.

### Partial Order

A relation that is **reflexive + antisymmetric + transitive**.

A **total order** is a partial order where every pair is comparable.

---

## 5. Functions

### Types of Functions

- **Injective (one-to-one):** $f(a)=f(b) \Rightarrow a=b$
- **Surjective (onto):** Every element of codomain is in range
- **Bijective:** Both injective and surjective

### Counting Functions

From $A$ ($|A|=m$) to $B$ ($|B|=n$):
- Total functions: $n^m$
- Injective (requires $n \geq m$): $P(n,m) = n!/(n-m)!$
- Surjective: Use inclusion-exclusion
- Bijective (requires $n=m$): $n!$

---

## 6. Worked Examples

### Example 1: Inclusion-Exclusion

In a class of 100 students, 60 study Maths, 50 study Physics, 20 study both. How many study neither?

$|M \cup P| = 60 + 50 - 20 = 90$. Neither = $100 - 90 = 10$.

### Example 2: Counting Functions

How many onto functions exist from a 3-element set to a 2-element set?

Total functions: $2^3 = 8$. Non-onto (all to one element): $2$. Onto: $8-2=6$.

### Example 3: Pigeonhole

In any group of 13 people, at least 2 share a birth month.

12 months = 12 boxes. 13 people → pigeonhole gives $\geq 2$ in one box.

---

## 7. Common GATE Traps

1. **Tautology vs. Contradiction:** A tautology is always true; a contradiction is always false. $p \lor \lnot p$ is a tautology; $p \land \lnot p$ is a contradiction.

2. **Implication:** $p \to q$ is FALSE only when $p$ is TRUE and $q$ is FALSE. When $p$ is false, the implication is vacuously true.

3. **Antisymmetric ≠ Not Symmetric:** The empty relation is both symmetric and antisymmetric.

4. **Surjective counting:** Carefully apply inclusion-exclusion — don't confuse with bijection count.

5. **Power set size:** $|\mathcal{P}(A)| = 2^{|A|}$, including the empty set.

---

## Summary

| Topic | Key Formula/Concept |
|-------|---------------------|
| Logic | De Morgan's, implication as disjunction |
| Sets | Inclusion-exclusion: $\|A \cup B\| = \|A\| + \|B\| - \|A \cap B\|$ |
| Combinations | $\binom{n}{r} = n!/r!(n-r)!$ |
| Relations | Equivalence = reflexive + symmetric + transitive |
| Functions | Bijective count = $n!$ (same size sets) |
