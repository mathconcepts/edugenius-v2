# Graph Theory — GATE Engineering Mathematics

## Introduction

Graph Theory studies networks of vertices (nodes) connected by edges. GATE EM tests core definitions, properties, and standard results. Weightage: ~5–7%.

---

## 1. Basic Definitions

A **graph** $G = (V, E)$ consists of:
- $V$: set of vertices (nodes)
- $E$: set of edges (pairs of vertices)

**Degree of a vertex:** Number of edges incident on it. Denoted $\deg(v)$.

**Handshaking Lemma:** 
$$\sum_{v \in V} \deg(v) = 2|E|$$

Consequence: Number of odd-degree vertices is always even.

### Types of Graphs

| Type | Property |
|------|----------|
| **Simple** | No self-loops, no multiple edges |
| **Complete ($K_n$)** | Every pair of vertices connected |
| **Bipartite** | Vertices split into two sets; edges only between sets |
| **Regular** | All vertices have same degree |
| **Tree** | Connected, acyclic graph |
| **Forest** | Acyclic graph (collection of trees) |

### Complete Graph $K_n$

- $n$ vertices, $\binom{n}{2} = n(n-1)/2$ edges
- Every vertex has degree $n-1$
- $K_3$ = triangle, $K_4$ = tetrahedron

---

## 2. Trees

A **tree** with $n$ vertices has exactly $n-1$ edges.

### Properties of Trees
1. Connected and acyclic
2. Exactly $n-1$ edges for $n$ vertices
3. Unique path between any two vertices
4. Adding any edge creates exactly one cycle
5. Removing any edge disconnects the tree

### Spanning Tree

A spanning tree of $G$ contains all vertices but only $n-1$ edges (minimum to keep it connected).

**Number of spanning trees of $K_n$:** $n^{n-2}$ (Cayley's formula)

### Rooted Trees

Binary tree with $n$ internal nodes has $n+1$ leaves.

---

## 3. Euler and Hamiltonian Paths

### Eulerian Graphs

An **Eulerian circuit** traverses every edge exactly once and returns to start.

**Condition:** Graph is connected and **all vertices have even degree**.

An **Eulerian path** (not circuit) exists iff exactly **2 vertices have odd degree**.

### Hamiltonian Graphs

A **Hamiltonian cycle** visits every vertex exactly once.

No simple necessary and sufficient condition (NP-complete problem).

**Sufficient condition (Dirac's theorem):** If every vertex has $\deg(v) \geq n/2$, then the graph has a Hamiltonian cycle.

---

## 4. Planar Graphs

A graph is **planar** if it can be drawn in a plane without edge crossings.

### Euler's Formula for Planar Graphs

$$V - E + F = 2$$

where $V$ = vertices, $E$ = edges, $F$ = faces (including outer face).

### Consequences

For a connected simple planar graph with $V \geq 3$:
$$E \leq 3V - 6$$

For bipartite planar graphs: $E \leq 2V - 4$

### Kuratowski's Theorem

A graph is planar iff it contains no subdivision of $K_5$ or $K_{3,3}$.

**$K_5$:** 5 vertices, 10 edges — smallest non-planar complete graph

**$K_{3,3}$:** 6 vertices, 9 edges — utility graph (non-planar)

---

## 5. Graph Coloring

**Chromatic number $\chi(G)$:** Minimum colors needed to color vertices so no two adjacent vertices share a color.

- $\chi(K_n) = n$
- $\chi(\text{bipartite}) = 2$ (if non-empty)
- $\chi(\text{tree}) = 2$ (if non-trivial)
- $\chi(C_n) = 2$ if $n$ even, $3$ if $n$ odd

**Four Color Theorem:** Every planar graph can be colored with at most 4 colors.

---

## 6. Adjacency Matrix

For graph $G$ with $n$ vertices, the adjacency matrix $A$ is $n \times n$ where:
$$A_{ij} = \begin{cases} 1 & \text{if edge } (i,j) \in E \\ 0 & \text{otherwise} \end{cases}$$

**Key property:** $(A^k)_{ij}$ = number of walks of length $k$ from $i$ to $j$.

---

## 7. Worked Examples

### Example 1: Handshaking Lemma

A graph has 5 vertices with degrees 3, 3, 3, 3, 2. Verify it's valid.

Sum of degrees = $3+3+3+3+2 = 14 = 2 \times 7$. So $|E| = 7$ edges. Valid (even sum).

### Example 2: Euler's Formula

A planar graph has 8 vertices and 12 edges. Find the number of faces.

$V - E + F = 2 \Rightarrow 8 - 12 + F = 2 \Rightarrow F = 6$ faces.

### Example 3: Tree Property

A tree has 10 vertices. How many edges?

A tree with $n$ vertices always has $n-1 = 9$ edges.

---

## 8. Common GATE Traps

1. **Eulerian vs Hamiltonian:** Eulerian = every EDGE once. Hamiltonian = every VERTEX once. Don't mix them.

2. **Tree edge count:** Always $n-1$ edges for $n$ vertices. Memorize this cold.

3. **Complete graph edges:** $K_n$ has $n(n-1)/2$ edges — use the handshaking lemma: $n$ vertices each with degree $n-1$.

4. **Planar graph formula:** $V - E + F = 2$ applies only to connected planar graphs.

5. **Chromatic number of bipartite graphs:** Always 2 (if the graph has at least one edge).

---

## Summary

| Concept | Key Result |
|---------|------------|
| Handshaking | $\sum \deg = 2|E|$ |
| Tree | $n$ vertices → $n-1$ edges |
| Eulerian circuit | All vertices even degree |
| Euler's formula | $V - E + F = 2$ (planar) |
| $K_n$ edges | $n(n-1)/2$ |
| $\chi(K_n)$ | $n$ |
