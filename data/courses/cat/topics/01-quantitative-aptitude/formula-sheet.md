# Quantitative Aptitude — CAT Formula Sheet

## Number Systems

| Concept | Formula / Rule |
|---------|---------------|
| HCF × LCM | = Product of two numbers (two numbers only) |
| Number of factors | N = pᵃqᵇrᶜ → factors = (a+1)(b+1)(c+1) |
| Sum of factors | (p^(a+1)-1)/(p-1) × (q^(b+1)-1)/(q-1) × ... |
| Units digit cycle | 2,3,7,9 → cycle of 4; 4,9 → cycle of 2; 0,1,5,6 → constant |
| Remainder theorem | aⁿ mod m: use cyclicity or Fermat's Little Theorem |
| Fermat's | aᵖ⁻¹ ≡ 1 (mod p), p prime, gcd(a,p)=1 |

### Divisibility Quick Rules
- **2**: Last digit even
- **3**: Sum of digits divisible by 3
- **4**: Last 2 digits divisible by 4
- **8**: Last 3 digits divisible by 8
- **9**: Sum of digits divisible by 9
- **11**: Alternating sum of digits divisible by 11
- **7**: Double last digit, subtract from rest; repeat

---

## Arithmetic

### Percentages — Fraction Equivalents
| % | Fraction | % | Fraction |
|---|---------|---|---------|
| 10% | 1/10 | 12.5% | 1/8 |
| 20% | 1/5 | 16.67% | 1/6 |
| 25% | 1/4 | 33.33% | 1/3 |
| 50% | 1/2 | 11.11% | 1/9 |
| 75% | 3/4 | 8.33% | 1/12 |

### Profit & Loss
- SP = CP × (1 + P%/100) or CP × (1 - L%/100)
- Profit% = (Profit/CP) × 100
- Successive discounts d₁%, d₂%: Net = 100 × (1-d₁/100)(1-d₂/100)
- Mark-up then discount: Net% change = m - d - md/100

### Simple & Compound Interest
- SI = P × N × R / 100
- CI (annual) = P(1 + R/100)ⁿ - P
- CI (half-yearly): R → R/2, n → 2n
- Difference CI-SI for 2 years = P(R/100)²

### Time & Work
- If A does work in 'a' days, rate = 1/a per day
- Combined rate = 1/a + 1/b
- Time together = ab/(a+b)
- **Trick**: Assume total work = LCM(a, b, c...)

### Time, Speed & Distance
- D = S × T
- Average speed (equal distances) = 2S₁S₂/(S₁+S₂) (harmonic mean)
- Relative speed (same direction) = |S₁ - S₂|
- Relative speed (opposite direction) = S₁ + S₂
- Train crossing pole: T = Length/Speed
- Train crossing train: T = (L₁+L₂)/Relative Speed
- Boats: Downstream = u+v; Upstream = u-v; Still water = avg; Current = half-difference

### Mixture & Alligation
```
  C₁           C₂
    \          /
     \  Mean  /
      \  Cm  /
  (Cm-C₁):(C₂-Cm)  ← ratio of second to first
```

### Ratio & Proportion
- a:b = c:d → ad = bc (cross multiply)
- Compounded ratio of a:b and c:d = ac:bd
- Partnership: Profit ∝ Capital × Time

---

## Algebra

### Quadratic Equations ax² + bx + c = 0
- Sum of roots = -b/a
- Product of roots = c/a
- Discriminant Δ = b²-4ac; Δ>0 real distinct, Δ=0 real equal, Δ<0 complex

### Progressions
| Type | Nth term | Sum |
|------|----------|-----|
| AP | a + (n-1)d | n/2 × [2a + (n-1)d] or n/2 × (a + l) |
| GP | arⁿ⁻¹ | a(rⁿ-1)/(r-1) for r≠1 |
| Infinite GP | — | a/(1-r), \|r\|<1 |

### Logarithms
- logₐ(xy) = logₐx + logₐy
- logₐ(x/y) = logₐx - logₐy
- logₐ(xⁿ) = n·logₐx
- Change of base: logₐb = log b / log a
- log₁₀2 ≈ 0.301, log₁₀3 ≈ 0.477, log₁₀7 ≈ 0.845

### Inequalities
- AM ≥ GM ≥ HM (for positive numbers)
- AM-GM: (a+b)/2 ≥ √(ab), equality when a=b
- |x| < k → -k < x < k
- |x| > k → x < -k or x > k

---

## Geometry & Mensuration

### Triangles
- Area = ½ × base × height = √[s(s-a)(s-b)(s-c)] (Heron's)
- s = semi-perimeter = (a+b+c)/2
- Pythagoras: a²+b²=c² (common triples: 3-4-5, 5-12-13, 8-15-17, 7-24-25)
- Area = ½ ab sinC = abc/4R (R = circumradius)
- Inradius r = Area/s

### Circles
- Area = πr²; Circumference = 2πr
- Arc length = (θ/360) × 2πr
- Sector area = (θ/360) × πr²
- Tangent from external point: both tangents equal length
- Angle in semicircle = 90°
- Tangent-chord angle = inscribed angle in alternate segment

### Quadrilaterals
- Parallelogram: Area = base × height; diagonals bisect each other
- Rhombus: Area = (d₁ × d₂)/2
- Trapezium: Area = ½(a+b) × h

### 3D Mensuration
| Shape | Volume | Surface Area |
|-------|--------|-------------|
| Cube (side a) | a³ | 6a² |
| Cuboid | l×b×h | 2(lb+bh+lh) |
| Cylinder | πr²h | 2πr(r+h) |
| Cone | ⅓πr²h | πr(r+l), l=slant |
| Sphere | 4/3 πr³ | 4πr² |
| Hemisphere | 2/3 πr³ | 3πr² |

---

## Modern Math

### Permutations & Combinations
- nPr = n!/(n-r)!
- nCr = n!/[r!(n-r)!]
- nCr = nC(n-r)
- Circular permutations = (n-1)!
- Arrangements with repetition: n! / (p!q!r!...)
- Distributing n distinct objects into r distinct groups = rⁿ

### Probability
- P(A) = Favourable/Total outcomes
- P(A') = 1 - P(A)
- P(A∪B) = P(A) + P(B) - P(A∩B)
- P(A∩B) = P(A) × P(B|A)
- Independent: P(A∩B) = P(A) × P(B)

### Sets (Inclusion-Exclusion)
- |A∪B| = |A| + |B| - |A∩B|
- |A∪B∪C| = |A|+|B|+|C| - |A∩B| - |B∩C| - |A∩C| + |A∩B∩C|

---

## CAT-Specific Shortcuts

1. **Speed calculation**: Convert km/h to m/s → multiply by 5/18
2. **% increase then decrease**: Net = +a-b-ab/100
3. **Digits in n!**: Use Legendre's formula for prime factor count
4. **Last two digits**: Work modulo 100
5. **Quick squares**: (a±b)² = a²±2ab+b² — use 50±x trick: 47²= (50-3)² = 2500-300+9=2209
