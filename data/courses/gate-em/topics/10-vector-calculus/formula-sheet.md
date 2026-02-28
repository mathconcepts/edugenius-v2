# Vector Calculus — Formula Sheet

## Operators

**Gradient:** $\nabla f = \dfrac{\partial f}{\partial x}\hat{i} + \dfrac{\partial f}{\partial y}\hat{j} + \dfrac{\partial f}{\partial z}\hat{k}$ (vector)

**Divergence:** $\nabla \cdot \mathbf{F} = \dfrac{\partial P}{\partial x} + \dfrac{\partial Q}{\partial y} + \dfrac{\partial R}{\partial z}$ (scalar)

**Curl:** $\nabla \times \mathbf{F} = \begin{vmatrix}\hat{i}&\hat{j}&\hat{k}\\\partial_x&\partial_y&\partial_z\\P&Q&R\end{vmatrix}$ (vector)

**Laplacian:** $\nabla^2 f = \dfrac{\partial^2 f}{\partial x^2} + \dfrac{\partial^2 f}{\partial y^2} + \dfrac{\partial^2 f}{\partial z^2}$

## Key Identities

- $\nabla \times (\nabla f) = \mathbf{0}$ (curl of gradient = 0)
- $\nabla \cdot (\nabla \times \mathbf{F}) = 0$ (divergence of curl = 0)
- Solenoidal: $\nabla \cdot \mathbf{F} = 0$
- Irrotational: $\nabla \times \mathbf{F} = \mathbf{0}$

## Integral Theorems

**Green's Theorem (2D):**
$$\oint_C P\,dx + Q\,dy = \iint_D\left(\frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y}\right)dA$$

**Stokes' Theorem:**
$$\oint_C \mathbf{F}\cdot d\mathbf{r} = \iint_S (\nabla\times\mathbf{F})\cdot d\mathbf{S}$$

**Gauss Divergence Theorem:**
$$\oiint_S \mathbf{F}\cdot d\mathbf{S} = \iiint_V (\nabla\cdot\mathbf{F})\,dV$$

## Conservative Fields

$\mathbf{F}$ is conservative iff $\nabla \times \mathbf{F} = \mathbf{0}$

Then $\mathbf{F} = \nabla\phi$ and $\int_C \mathbf{F}\cdot d\mathbf{r} = \phi(B) - \phi(A)$ (path independent)
