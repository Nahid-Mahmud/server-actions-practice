# Error Boundary Guide 🛡️

## What is an Error Boundary?

An **Error Boundary** is a React component that catches JavaScript errors anywhere in the child component tree, logs those errors, and displays a fallback UI instead of the component tree that crashed.

Think of it like a `try-catch` block, but for React components!

## Why Do We Need Error Boundaries?

Without error boundaries, if any component in your React app throws an error, the entire app crashes and shows a blank white screen. Error boundaries prevent this by:

1. **Catching errors** before they crash the whole app
2. **Displaying a fallback UI** (like "Something went wrong" message)
3. **Logging errors** for debugging
4. **Allowing the rest of the app to continue working**

## How Our Error Boundary Works

### 1. Class Component Structure

```tsx
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Component logic here
}
```

**Why a class component?** Error boundaries must be class components because they use special lifecycle methods that only exist in class components.

### 2. State Management

```tsx
interface ErrorBoundaryState {
  hasError: boolean; // Did an error occur?
  error: Error | null; // What was the error?
}
```

The component tracks:

- `hasError`: Whether an error has occurred
- `error`: The actual error object (for displaying error details)

### 3. Error Catching Methods

#### `getDerivedStateFromError()`

```tsx
static getDerivedStateFromError(error: Error): ErrorBoundaryState {
  return { hasError: true, error };
}
```

- **Purpose**: Updates state when an error occurs
- **When it runs**: During the "render" phase when React is building the component tree
- **What it does**: Sets `hasError` to `true` and stores the error

#### `componentDidCatch()`

```tsx
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error('ErrorBoundary caught an error:', error, errorInfo);
}
```

- **Purpose**: Logs error details for debugging
- **When it runs**: During the "commit" phase when React has finished updating the DOM
- **What it does**: Logs the error and additional info (like component stack trace)

### 4. Rendering Logic

```tsx
render() {
  if (this.state.hasError) {
    // Show error UI
    const FallbackComponent = this.props.fallback || DefaultErrorFallback;
    return <FallbackComponent error={this.state.error!} reset={this.reset} />;
  }

  // Show normal UI
  return this.props.children;
}
```

**The logic:**

- If there's an error → Show fallback UI
- If no error → Show the normal child components

### 5. Reset Functionality

```tsx
reset = () => {
  this.setState({ hasError: false, error: null });
};
```

Allows users to try again by resetting the error state.

## How to Use the Error Boundary

### Basic Usage

```tsx
import ErrorBoundary from "./ErrorBoundary";
import UserList from "./UserList";

function App() {
  return (
    <ErrorBoundary>
      <UserList />
    </ErrorBoundary>
  );
}
```

### With Custom Fallback

```tsx
function CustomErrorFallback({ error, reset }) {
  return (
    <div className="error-container">
      <h2>Oops! Something went wrong</h2>
      <details>
        <summary>Error details</summary>
        <pre>{error.message}</pre>
      </details>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary fallback={CustomErrorFallback}>
      <UserList />
    </ErrorBoundary>
  );
}
```

## What Errors Do Error Boundaries Catch?

### ✅ **Error boundaries catch:**

- Errors in **render methods**
- Errors in **lifecycle methods**
- Errors in **constructors**
- Errors in the **whole component tree below them**

### ❌ **Error boundaries do NOT catch:**

- Errors in **event handlers** (use try-catch instead)
- Errors in **async code** (setTimeout, fetch, etc.)
- Errors during **server-side rendering**
- Errors thrown in the **error boundary itself**

## Real-World Example

Let's say you have a component that might fail:

```tsx
// This component might throw an error
function ProblematicComponent() {
  const data = null;

  // This will throw an error if data is null
  return <div>{data.someProperty}</div>;
}

// Without Error Boundary: Entire app crashes 💥
function App() {
  return <ProblematicComponent />;
}

// With Error Boundary: Shows fallback UI ✅
function App() {
  return (
    <ErrorBoundary>
      <ProblematicComponent />
    </ErrorBoundary>
  );
}
```

## Best Practices

### 1. **Place Error Boundaries Strategically**

```tsx
function App() {
  return (
    <div>
      <Header /> {/* Always works */}
      <ErrorBoundary>
        <UserList /> {/* Might fail */}
      </ErrorBoundary>
      <ErrorBoundary>
        <ProductList /> {/* Might fail independently */}
      </ErrorBoundary>
      <Footer /> {/* Always works */}
    </div>
  );
}
```

### 2. **Don't Wrap Everything**

- Don't put error boundary around the entire app
- Use multiple error boundaries for different sections
- Let some components fail independently

### 3. **Provide Helpful Error Messages**

```tsx
function UserFriendlyErrorFallback({ error, reset }) {
  return (
    <div className="error-message">
      <h3>Unable to load user data</h3>
      <p>Please check your internet connection and try again.</p>
      <button onClick={reset}>Retry</button>

      {/* Only show technical details in development */}
      {process.env.NODE_ENV === "development" && (
        <details>
          <summary>Technical details</summary>
          <pre>{error.message}</pre>
        </details>
      )}
    </div>
  );
}
```

### 4. **Log Errors for Monitoring**

```tsx
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  // Log to console in development
  console.error('ErrorBoundary caught an error:', error, errorInfo);

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to Sentry, LogRocket, etc.
    errorTrackingService.captureException(error, errorInfo);
  }
}
```

## Debugging Tips

### 1. **Check Browser Console**

Error boundaries log detailed error information to the console.

### 2. **Use React DevTools**

The React DevTools extension shows you which component threw the error.

### 3. **Add Error Details**

Include helpful information in your fallback UI during development:

```tsx
function DebugErrorFallback({ error, reset }) {
  return (
    <div style={{ padding: "20px", border: "2px solid red" }}>
      <h2>Component Error</h2>
      <details open>
        <summary>Error Message</summary>
        <pre style={{ color: "red" }}>{error.message}</pre>
      </details>
      <details>
        <summary>Stack Trace</summary>
        <pre style={{ fontSize: "12px" }}>{error.stack}</pre>
      </details>
      <button onClick={reset}>Reset Component</button>
    </div>
  );
}
```

## Summary

Error boundaries are like safety nets for your React components:

1. **They catch errors** that would otherwise crash your app
2. **They show fallback UI** instead of a blank screen
3. **They help with debugging** by logging error details
4. **They improve user experience** by gracefully handling failures

Remember: Error boundaries are for **unexpected errors**, not for handling expected failures (like failed API calls). For those, use regular error handling with try-catch or error states in your components.
