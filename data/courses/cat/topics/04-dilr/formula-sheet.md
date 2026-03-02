# DILR Formula Sheet & Quick Reference — CAT

## Data Interpretation Formulas

### Percentage & Ratio
| Formula | Expression |
|---------|-----------|
| % Change | `(New − Old) / Old × 100` |
| % of Total | `Part / Total × 100` |
| Part from % | `% / 100 × Total` |
| Ratio A:B | `A/B` (simplify by HCF) |
| Combined Ratio | If A:B = m:n and B:C = p:q → A:B:C = mp:np:nq |

### Growth & Index
| Formula | Expression |
|---------|-----------|
| CAGR | `(Final/Initial)^(1/n) − 1` |
| Simple % growth | `(End − Start) / Start × 100` |
| Index number | `(Current / Base) × 100` |

### Average & Weighted Average
| Formula | Expression |
|---------|-----------|
| Simple average | `Sum / Count` |
| Weighted average | `Σ(wᵢ × xᵢ) / Σwᵢ` |
| If average increases by k after adding item x | `x = old_avg + k × (n+1)` |

### Pie Chart
| Quantity | Formula |
|----------|---------|
| Central angle from % | `% × 3.6` |
| % from central angle | `angle / 3.6` |
| Actual value from % | `% / 100 × Total` |

---

## Logical Reasoning Frameworks

### Linear Arrangement Checklist
```
1. List all entities (A, B, C...)
2. Draw n boxes (n = number of positions)
3. Apply absolute constraints first (A is at position 1)
4. Apply relative constraints (B is 2 places right of C)
5. Apply negative constraints last (A is not adjacent to D)
6. Verify with all constraints before answering
```

### Circular Arrangement
```
- Fix one person (usually the reference in the clue) to eliminate rotational symmetry
- Clockwise ≠ anticlockwise — read carefully
- "Immediate left/right" = adjacent in that direction
- "Facing centre" vs "facing away" changes left/right interpretation
```

### Grouping Template
| Entity | Property 1 | Property 2 | Property 3 |
|--------|-----------|-----------|-----------|
| A | | | |
| B | | | |

```
Constraint types:
- Inclusion: A → B (if A, then B)
- Exclusion: A → ¬B (if A, then not B)  
- Either/Or: A ∨ B (at least one of A, B)
- Neither: ¬A ∧ ¬B
Contradiction check: if A → B and A → ¬B → A can never be in the group
```

### Scheduling Grid
```
Rows = people/items
Columns = time slots/days
Fill in known cells first, then eliminate by constraint propagation
```

### Set Theory (3 Sets)
```
A ∪ B ∪ C = A + B + C − (A∩B) − (B∩C) − (A∩C) + (A∩B∩C)

Exactly 1 set  = A + B + C − 2(A∩B) − 2(B∩C) − 2(A∩C) + 3(A∩B∩C)
Exactly 2 sets = (A∩B) + (B∩C) + (A∩C) − 3(A∩B∩C)
Exactly 3 sets = A∩B∩C
At least 2 sets = Exactly 2 + Exactly 3
```

---

## Approximation Tricks for DI

### Quick Division Benchmarks
| Fraction | Decimal |
|----------|---------|
| 1/3 | 0.333 |
| 1/6 | 0.167 |
| 1/7 | 0.143 |
| 1/8 | 0.125 |
| 1/9 | 0.111 |
| 1/11 | 0.0909 |
| 1/12 | 0.0833 |

### Percentage Benchmarks
| % | Fraction |
|---|---------|
| 12.5% | 1/8 |
| 16.67% | 1/6 |
| 33.33% | 1/3 |
| 37.5% | 3/8 |
| 62.5% | 5/8 |
| 66.67% | 2/3 |
| 83.33% | 5/6 |

### Mental Math Shortcuts
- `a% of b = b% of a` (swap to get easier calculation)
- `X% increase then Y% decrease`: net = `X - Y - XY/100` (use for compound changes)
- To find 15% quickly: find 10%, halve to get 5%, add both
- To compare fractions: cross multiply (no need to find LCD)

---

## Set Selection Decision Framework

```
Rate each set 1–5 on:
  + Familiar format (table/arrangement vs novel type)
  + Low constraint count (≤5 constraints = easier)
  + Simple arithmetic (no square roots, no 4-digit multiplications)

Do first: highest total score
Skip: sets with unfamiliar format AND complex arithmetic
TITA questions in a set: bonus — attempt if you're in the set anyway
```

---

## Direction & Distance Quick Reference
```
N
W   E
S

Clockwise turns: N→E→S→W→N
Left turn from North = West
Right turn from North = East

Shadow problems:
- Morning (East sun) → shadow falls West
- Evening (West sun) → shadow falls East
- Noon → shadow falls North (in India)
```

## Blood Relation Shortcuts
```
Paternal side: Father's {father/mother/brother/sister}
Maternal side: Mother's {father/mother/brother/sister}

"X is the only son of Y's father" → X is Y's brother
"X is the son of Y's grandfather" → X is Y's parent (or uncle)
Generation diagram: always draw before solving
```
