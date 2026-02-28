# Vector Calculus — GATE Engineering Mathematics

## Introduction

Vector Calculus extends calculus to vector fields. It's essential for engineering applications in fluid mechanics, electromagnetism, and heat transfer. GATE weightage: ~8–10%.

---

## 1. Vector Operations

A vector field $\mathbf{F} = P\hat{i} + Q\hat{j} + R\hat{k}$ assigns a vector to each point in space.

### Gradient (∇f)

For scalar field $f(x,y,z)$:
$$\nabla f = \frac{\partial f}{\partial x}\hat{i} + \frac{\partial f}{\partial y}\hat{j} + \frac{\partial f}{\partial z}\hat{k}$$

- Points in direction of steepest ascent
- Magnitude = rate of steepest ascent

### Divergence (∇·F)

$$\nabla \cdot \mathbf{F} = \frac{\partial P}{\partial x} + \frac{\partial Q}{\partial y} + \frac{\partial R}{\partial z}$$

- Scalar quantity
- Measures "outflow" at a point
- $\nabla \cdot \mathbf{F} = 0$ → solenoidal (incompressible) field

### Curl (∇×F)

$$\nabla \times \mathbf{F} = \begin{vmatrix} \hat{i} & \hat{j} & \hat{k} \\ \partial/\partial x & \partial/\partial y & \partial/\partial z \\ P & Q & R \end{vmatrix}$$

$$= \left(\frac{\partial R}{\partial y} - \frac{\partial Q}{\partial z}\right)\hat{i} - \left(\frac{\partial R}{\partial x} - \frac{\partial P}{\partial z}\right)\hat{j} + \left(\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y}\right)\hat{k}$$

- Vector quantity
- Measures rotation/vorticity
- $\nabla \times \mathbf{F} = 0$ → irrotational field

### Laplacian

$$\nabla^2 f = \frac{\partial^2 f}{\partial x^2} + \frac{\partial^2 f}{\partial y^2} + \frac{\partial^2 f}{\partial z^2}$$

---

## 2. Key Identities

$$\nabla \times (\nabla f) = \mathbf{0} \quad \text{(curl of gradient = 0)}$$
$$\nabla \cdot (\nabla \times \mathbf{F}) = 0 \quad \text{(divergence of curl = 0)}$$
$$\nabla \times (\nabla \times \mathbf{F}) = \nabla(\nabla \cdot \mathbf{F}) - \nabla^2\mathbf{F}$$

---

## 3. Line Integrals

$$\int_C \mathbf{F} \cdot d\mathbf{r} = \int_C (P\,dx + Q\,dy + R\,dz)$$

**Conservative Field:** If $\mathbf{F} = \nabla f$ (for some scalar $f$), then:
$$\int_C \mathbf{F} \cdot d\mathbf{r} = f(B) - f(A)$$

Path-independent! Test: $\nabla \times \mathbf{F} = \mathbf{0}$.

---

## 4. Green's Theorem

Relates line integral around closed curve $C$ to double integral over region $D$:

$$\oint_C (P\,dx + Q\,dy) = \iint_D \left(\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y}\right) dA$$

**Area formula:** $A = \frac{1}{2}\oint_C (x\,dy - y\,dx)$

---

## 5. Stokes' Theorem

Relates surface integral of curl to line integral around boundary:

$$\iint_S (\nabla \times \mathbf{F}) \cdot d\mathbf{S} = \oint_C \mathbf{F} \cdot d\mathbf{r}$$

where $C$ is the boundary of surface $S$.

---

## 6. Gauss's Divergence Theorem

Relates volume integral of divergence to surface integral (flux):

$$\iiint_V (\nabla \cdot \mathbf{F})\,dV = \oiint_S \mathbf{F} \cdot d\mathbf{S}$$

where $S$ is the closed surface bounding volume $V$.

**Mnemonic:** Div → Volume to Surface; Stokes → Surface to Line.

---

## 7. Worked Examples

### Example 1: Divergence

Find $\nabla \cdot \mathbf{F}$ where $\mathbf{F} = x^2\hat{i} + y^2\hat{j} + z^2\hat{k}$ at $(1,1,1)$.

$$\nabla \cdot \mathbf{F} = \frac{\partial(x^2)}{\partial x} + \frac{\partial(y^2)}{\partial y} + \frac{\partial(z^2)}{\partial z} = 2x + 2y + 2z$$

At $(1,1,1)$: $2+2+2 = 6$.

### Example 2: Curl

Find $\nabla \times \mathbf{F}$ where $\mathbf{F} = y\hat{i} - x\hat{j}$.

$$\nabla \times \mathbf{F} = \begin{vmatrix}\hat{i} & \hat{j} & \hat{k} \\ \partial_x & \partial_y & \partial_z \\ y & -x & 0\end{vmatrix} = \hat{k}\left(\frac{\partial(-x)}{\partial x} - \frac{\partial y}{\partial y}\right) = (-1-1)\hat{k} = -2\hat{k}$$

### Example 3: Green's Theorem

Evaluate $\oint_C y\,dx - x\,dy$ where $C$ is the unit circle.

Here $P = y$, $Q = -x$. By Green's: $\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y} = -1 - 1 = -2$.

$$\iint_D (-2)\,dA = -2 \cdot \pi(1)^2 = -2\pi$$

---

## 8. Common GATE Traps

1. **Gradient is a vector, divergence is a scalar.** Don't confuse them.

2. **Conservative fields:** $\mathbf{F}$ is conservative iff $\nabla \times \mathbf{F} = 0$ (in simply connected domain). Then path integral depends only on endpoints.

3. **Direction of normal in Stokes/Divergence:** Right-hand rule for Stokes; outward normal for Gauss.

4. **Green's vs Stokes:** Green's is 2D special case of Stokes.

5. **Divergence theorem:** Volume to surface, NOT surface to volume. The arrow goes from ∇·F inside to flux outside.

---

## Summary

| Operator | Type | Physical Meaning |
|----------|------|-----------------|
| $\nabla f$ | Vector | Steepest ascent direction |
| $\nabla \cdot \mathbf{F}$ | Scalar | Net outflow (source/sink) |
| $\nabla \times \mathbf{F}$ | Vector | Rotation/vorticity |
| $\nabla^2 f$ | Scalar | Laplacian (smoothness) |

| Theorem | Converts |
|---------|---------|
| Green's | Line ↔ Area (2D) |
| Stokes' | Line ↔ Surface (3D) |
| Gauss' | Surface ↔ Volume (3D) |
