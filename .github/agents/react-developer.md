---
name: react-developer
description: >
  Aplica a cualquier proyecto React con TypeScript. Usar cuando se trabaje
  con proyectos de frontend React independientemente del dominio o stack
  específico.
applyTo: "**/*.{tsx,ts,jsx,js}"
---

# React + TypeScript — Developer Skill (Global)

## Instrucciones para ahorrar tokens

- Piensa antes de actuar. Lee archivos existentes antes de escribir código.
- Sé conciso en la salida pero exhaustivo en el razonamiento.
- Es preferible editar antes que reescribir archivos enteros.
- No vuelvas a leer archivos que ya hayas leído a menos que el archivo haya cambiado.
- Prueba tu código antes de declarar terminado.
- Nada de aperturas aduladoras ni rellenos de cierre.
- Mantén las soluciones simples y directas.
- Las instrucciones del usuario siempre anulan estas instrucciones.

## Descripción

Skill global para el desarrollo de proyectos **React + TypeScript**. Recoge las buenas prácticas, patrones y reglas de calidad comunes a cualquier proyecto React moderno.

> Para contexto específico de proyecto, leer el archivo de instrucciones del repositorio activo (`.github/copilot-instructions.md` o equivalente) si existe.

## Cuándo Aplicar Este Skill

- Proyectos React + TypeScript de cualquier dominio
- Creación o modificación de componentes, hooks, contextos y servicios
- Revisión de código o refactorizaciones en proyectos React
- Implementación de formularios, routing, llamadas a API o estado global

---

## Stack de Referencia

| Tech                    | Versión recomendada | Uso                        |
| ----------------------- | ------------------- | -------------------------- |
| React                   | 18+                 | UI framework               |
| TypeScript              | 5+ (strict)         | Sin `any` en ningún caso   |
| React Router            | v6+                 | Routing                    |
| Vitest / Jest           | Latest              | Testing unitario           |
| React Testing Library   | Latest              | Testing de componentes     |
| ESLint + Prettier       | Latest              | Calidad y formato          |
| Node.js                 | 20+                 | Runtime                    |

> El proyecto puede usar cualquier librería de UI (MUI, Tailwind, Radix, etc.) o de estado (Zustand, Redux, Jotai, Context API). Las reglas de esta skill son agnósticas a esas elecciones.

---

## Reglas de Código

### TypeScript — Obligatorio

- ✅ Tipado estricto (`"strict": true` en `tsconfig.json`) — **NUNCA `any`**
- ✅ `interface` para props de componentes y objetos con estructura fija
- ✅ `type` para unions, intersecciones y aliases
- ✅ `import type` para imports usados únicamente como anotaciones de tipo
- ✅ Tipar siempre el valor de retorno de funciones no triviales
- ❌ No `@ts-ignore` / `@ts-nocheck` — resolver el error de raíz
- ❌ No castings con `as` salvo cuando sea estrictamente necesario y justificado

### Componentes React

- ✅ Componentes funcionales con tipado explícito de props: `const Foo: React.FC<FooProps> = ...` o destructuring tipado
- ✅ Un componente por archivo
- ✅ Máximo ~300 líneas por componente — extraer subcomponentes si crece
- ✅ Separar lógica de presentación: extraer lógica a hooks personalizados
- ❌ No lógica de negocio directamente en el JSX

### Nomenclatura

| Elemento              | Convención             | Ejemplo               |
| --------------------- | ---------------------- | --------------------- |
| Componentes           | **PascalCase**         | `UserProfile`         |
| Hooks personalizados  | prefijo `use`          | `useAuthSession`      |
| Event handlers        | prefijo `handle`       | `handleSubmit`        |
| Funciones / variables | **camelCase**          | `fetchUserData`       |
| Constantes globales   | **UPPER_SNAKE_CASE**   | `MAX_RETRY_COUNT`     |
| Archivos de comp.     | PascalCase             | `UserProfile.tsx`     |
| Archivos de hooks     | camelCase con `use`    | `useAuthSession.ts`   |
| Tipos e interfaces    | PascalCase             | `UserProfileProps`    |

### Calidad de Código

- ❌ No `console.log()` en código de producción — usar `console.error`, `console.warn` o un logger dedicado
- ❌ No `debugger`
- ❌ No `var` — usar `const` o `let`
- ✅ ESLint sin errores ni warnings suprimidos
- ✅ `npx tsc --noEmit` sin errores antes de hacer commit
- ✅ Sin código comentado ni imports sin usar

### Imports

- ✅ Rutas absolutas desde `/src` (configurar `paths` en `tsconfig.json`) — evitar escaladas `../../..`
- ✅ `import type` para tipos puros
- ✅ Agrupar imports: externos → internos → tipos → estilos

---

## Estructura de Carpetas Recomendada

```
src/
  components/        # Componentes reutilizables (UI puro)
  features/          # Módulos por dominio/funcionalidad
    [feature]/
      components/
      hooks/
      services/
      types/
  hooks/             # Hooks globales reutilizables
  services/          # Llamadas a API / integración con backend
  context/           # Contextos globales (Context API)
  types/             # Tipos e interfaces globales
  utils/             # Funciones utilitarias puras
  pages/ (o routes/) # Vistas/páginas raíz del router
```

---

## Patrones de Código Estándar

### Hook de servicio / datos

```typescript
// Encapsular fetching en un hook por dominio
function useUsers() {
  const [data, setData] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    fetchUsers()
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
```

### Mapper: API ↔ Estado de aplicación

```typescript
// Aislar la forma del backend del estado interno
function toUserModel(dto: UserDTO): User { ... }
function toUserDTO(user: User): UserDTO { ... }
```

### Context API (estado global)

```typescript
// Patrón context + hook de acceso tipado
const UserContext = React.createContext<UserContextValue | undefined>(undefined);

function useUserContext(): UserContextValue {
  const ctx = React.useContext(UserContext);
  if (!ctx) throw new Error("useUserContext must be used within UserProvider");
  return ctx;
}
```

### Props de componente

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ label, onClick, variant = "primary", disabled = false }) => (
  <button className={variant} onClick={onClick} disabled={disabled}>
    {label}
  </button>
);
```

---

## Prop Drilling — Detección y Soluciones

### Qué es prop drilling

Ocurre cuando una prop se pasa a través de varios niveles de componentes intermedios que **no la usan**, solo la reenvían hacia abajo. Es una señal de que el dato debería vivir en otro lugar.

```
// ❌ Prop drilling: `user` pasa por Page → Layout → Sidebar → Avatar sin usarse en los intermedios
<Page user={user} />
  └─ <Layout user={user} />       // Layout no usa user, solo lo pasa
       └─ <Sidebar user={user} /> // Sidebar no usa user, solo lo pasa
            └─ <Avatar user={user} /> // aquí sí se usa
```

### Señales de alerta

- Una prop aparece en la firma de un componente pero **no se usa en su JSX**, solo se reenvía
- Una prop atraviesa más de **2 niveles** de componentes intermedios
- Al cambiar la forma del dato hay que modificar **múltiples archivos** que no usan ese dato
- Los tests de componentes intermedios se complican porque hay que pasar datos que no les corresponden

### Regla general

> Si un dato es necesario en más de un lugar del árbol o cruza más de 2 niveles, **no lo pases por props**: usa Context, un hook de acceso directo o un store global.

---

### Solución 1: Context API (datos compartidos por un subárbol)

Ideal para datos que muchos componentes de una misma feature necesitan leer (usuario autenticado, tema, idioma, estado de un formulario multi-paso).

```typescript
// context/UserContext.tsx
interface UserContextValue {
  user: User;
  logout: () => void;
}

const UserContext = React.createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User>(loadUser());
  const logout = () => setUser(null);
  return <UserContext.Provider value={{ user, logout }}>{children}</UserContext.Provider>;
}

// Hook de acceso tipado — nunca usar useContext directamente fuera de este hook
export function useUser(): UserContextValue {
  const ctx = React.useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

// ✅ Cualquier componente del subárbol accede directamente sin intermediarios
function Avatar() {
  const { user } = useUser(); // sin props
  return <img src={user.avatarUrl} alt={user.name} />;
}
```

**Cuándo usar Context:**
- Datos de sesión / autenticación
- Preferencias de UI (tema, idioma)
- Estado compartido de una feature concreta (ej. wizard multi-paso, carrito de compra)
- Callbacks globales (toast/notificaciones, modal manager)

**Cuándo NO usar Context:**
- Estado local que solo necesita un componente → `useState`
- Estado muy frecuentemente mutable (cambia en cada keystroke) → puede causar re-renders masivos; usar store externo o `useReducer` + `memo`

---

### Solución 2: Composición con `children` / render props

Cuando el componente intermedio solo necesita renderizar algo, no conocer el dato. Evita pasar props "de paso" reestructurando el árbol.

```typescript
// ❌ Antes: Layout necesita conocer user solo para dárselo a Header
function Layout({ user }: { user: User }) {
  return (
    <div>
      <Header user={user} />
      <main>...</main>
    </div>
  );
}

// ✅ Después: Layout recibe el Header ya construido como children/prop
function Layout({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      {header}
      <main>{children}</main>
    </div>
  );
}

// El padre que sí conoce user compone todo:
function Page() {
  const { user } = useUser();
  return (
    <Layout header={<Header user={user} />}>
      <Content />
    </Layout>
  );
}
```

**Cuándo usar composición:**
- El componente intermedio es puramente estructural (layout, wrappers, listas)
- Quieres mantener el componente intermedio reutilizable y desacoplado
- La prop solo es necesaria para un hijo directo, no para varios niveles

---

### Solución 3: Store global (Zustand, Redux Toolkit, Jotai…)

Para estado que cruza múltiples features o necesita persistencia, sincronización o acceso desde fuera del árbol React (ej. desde servicios).

```typescript
// store/useAuthStore.ts (ejemplo con Zustand)
interface AuthStore {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  login: async (credentials) => {
    const user = await authService.login(credentials);
    set({ user });
  },
  logout: () => set({ user: null }),
}));

// ✅ Cualquier componente accede sin props ni contexto
function Avatar() {
  const user = useAuthStore((state) => state.user);
  return user ? <img src={user.avatarUrl} alt={user.name} /> : null;
}
```

**Cuándo usar store global:**
- Estado compartido entre features no relacionadas por árbol
- Necesitas acceder al estado desde fuera de componentes (servicios, workers)
- El estado muta con mucha frecuencia y necesitas control fino de re-renders con selectores

---

### Árbol de decisión: ¿qué usar?

```
¿El dato solo lo usa UN componente?
  └─ Sí → useState local
  └─ No → ¿Solo lo comparten componentes de UNA misma feature/subárbol?
              └─ Sí → Context API + hook de acceso tipado
              └─ No → ¿El componente intermedio simplemente envuelve?
                          └─ Sí → Composición con children / slot props
                          └─ No → Store global (Zustand, Redux Toolkit, Jotai)
```

---

### Anti-patrones relacionados que evitar

| Anti-patrón | Por qué es un problema | Alternativa |
| --- | --- | --- |
| Pasar `props` entero hacia abajo (`<Child {...props} />`) | Acopla tipos, oscurece dependencias, dificulta refactors | Pasar solo las props que el hijo necesita explícitamente |
| Context con un objeto enorme que incluye todo el estado app | Re-renderiza todos los consumidores ante cualquier cambio | Dividir en contextos por dominio o usar selectores con `useMemo` |
| Elevar estado innecesariamente al componente raíz | Convierte la raíz en un "god component" y fuerza prop drilling | Colocar el estado en el ancestro común más cercano que lo necesite |
| Props opcionales con `?` para evitar pasar el dato | Oculta dependencias reales, el componente parece independiente pero no lo es | Hacer explícita la dependencia o eliminarla con Context / composición |

---

## Testing

- ✅ Cobertura de lógica crítica con tests unitarios (hooks, utils, mappers)
- ✅ Tests de componentes con React Testing Library — interactuar como el usuario, no con detalles de implementación
- ✅ Usar `screen.getByRole`, `getByLabelText`, `getByText` antes que `getByTestId`
- ❌ No mockear lo que no es necesario — minimizar dependencias artificiales
- ✅ Un archivo de test por módulo (`.test.ts` / `.test.tsx`)

---

## Accesibilidad

- ✅ Todo elemento interactivo debe tener `aria-label` o texto visible
- ✅ Usar elementos semánticos HTML (`<button>`, `<nav>`, `<main>`, `<section>`)
- ✅ Gestionar foco correctamente en modales y diálogos
- ❌ No usar `div` ni `span` clicables sin rol ARIA

---

## Checklist de Verificación

Antes de declarar cualquier tarea completada:

1. `npx tsc --noEmit` — cero errores de TypeScript
2. `npm run lint` — cero errores ESLint
3. `npm test` — todos los tests en verde
4. Sin `console.log()`, sin `any`, sin `var`, sin imports sin usar
5. Sin comentarios innecesarios ni código muerto
6. Componentes con props tipadas, hooks con retorno tipado
7. Si hay texto visible al usuario, debe estar externalizado (i18n o constante)
