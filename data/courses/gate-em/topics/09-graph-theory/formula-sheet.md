# Graph Theory — Formula Sheet

## Key Formulas

**Handshaking Lemma:** $\sum_{v} \deg(v) = 2|E|$

**Complete graph $K_n$:** $|E| = n(n-1)/2$, each vertex degree $= n-1$

**Tree:** $n$ vertices → exactly $n-1$ edges

**Cayley's formula:** Number of labeled spanning trees of $K_n$ = $n^{n-2}$

**Euler's formula (planar):** $V - E + F = 2$

**Planar graph bound:** $E \leq 3V - 6$ (simple, $V \geq 3$)

**Bipartite planar:** $E \leq 2V - 4$

## Eulerian Graphs

| Condition | Result |
|-----------|--------|
| All vertices even degree, connected | Eulerian circuit exists |
| Exactly 2 odd-degree vertices | Eulerian path (not circuit) |
| More than 2 odd-degree vertices | No Eulerian path |

## Graph Types

| Type | Property |
|------|----------|
| Simple | No loops, no parallel edges |
| $K_n$ | Complete — every pair connected |
| Bipartite | Two-color partition |
| Tree | Connected + acyclic, $n-1$ edges |
| Planar | Drawable without crossings |

## Chromatic Numbers

| Graph | $\chi(G)$ |
|-------|-----------|
| $K_n$ | $n$ |
| Bipartite (non-empty) | $2$ |
| Tree (non-trivial) | $2$ |
| $C_n$ (even $n$) | $2$ |
| $C_n$ (odd $n$) | $3$ |
| Planar | $\leq 4$ (Four Color Theorem) |

## Non-Planar Graphs

- $K_5$: 5 vertices, 10 edges — smallest non-planar complete
- $K_{3,3}$: 6 vertices, 9 edges — utility graph

**Kuratowski:** $G$ is planar iff no subdivision of $K_5$ or $K_{3,3}$
