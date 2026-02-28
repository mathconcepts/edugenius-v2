# Discrete Mathematics — Formula Sheet

## Logic

| Operation | Symbol | Key Rule |
|-----------|--------|----------|
| AND | $p \land q$ | Both true |
| OR | $p \lor q$ | At least one true |
| NOT | $\lnot p$ | Opposite |
| IMPLIES | $p \to q$ | $\equiv \lnot p \lor q$ |
| IFF | $p \leftrightarrow q$ | Same truth value |

**De Morgan's:** $\lnot(p \land q) \equiv \lnot p \lor \lnot q$ and $\lnot(p \lor q) \equiv \lnot p \land \lnot q$

**Tautologies:** $p \lor \lnot p$ (always true), $p \land \lnot p$ (always false — contradiction)

## Set Theory

$$|A \cup B| = |A| + |B| - |A \cap B|$$
$$|A \cup B \cup C| = |A|+|B|+|C| - |A\cap B| - |B\cap C| - |A\cap C| + |A\cap B\cap C|$$
$$|\mathcal{P}(A)| = 2^{|A|}$$

## Combinatorics

$$P(n,r) = \frac{n!}{(n-r)!} \quad \text{(ordered)}$$
$$C(n,r) = \binom{n}{r} = \frac{n!}{r!(n-r)!} \quad \text{(unordered)}$$
$$(x+y)^n = \sum_{k=0}^{n}\binom{n}{k}x^{n-k}y^k$$

**Pigeonhole:** $n+1$ objects, $n$ boxes → at least one box has $\geq 2$ objects.

## Counting Functions ($|A|=m$, $|B|=n$)

| Type | Count |
|------|-------|
| Total | $n^m$ |
| Injective | $P(n,m) = n!/(n-m)!$ |
| Bijective ($m=n$) | $n!$ |

## Relations

| Property | Condition |
|----------|-----------|
| Reflexive | $(a,a) \in R$ ∀a |
| Symmetric | $(a,b) \in R \Rightarrow (b,a) \in R$ |
| Transitive | $(a,b),(b,c) \in R \Rightarrow (a,c) \in R$ |
| Antisymmetric | $(a,b),(b,a) \in R \Rightarrow a=b$ |

**Equivalence relation** = Reflexive + Symmetric + Transitive

**Partial order** = Reflexive + Antisymmetric + Transitive
