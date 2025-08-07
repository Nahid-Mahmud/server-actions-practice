# Next.js Server Actions Error Handling Practice

This project demonstrates the **best practices for error handling in Next.js Server Actions** and explores different approaches to form error handling in the App Router.

## 🎯 Project Overview

This is a Next.js application that showcases proper error handling techniques when working with Server Actions, specifically focusing on form submissions and user feedback.

## 🚀 Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📋 What This Project Demonstrates

### ✅ Current Implementation: Client Component with `useActionState`

**File:** `src/app/user-registration.tsx`

This approach uses a **client component** with React's `useActionState` hook for comprehensive error handling.

#### Why This is the Best Approach:

1. **Real-time Error Display**: Errors are immediately shown to users without page refresh
2. **Type Safety**: Full TypeScript support for error states
3. **Better UX**: Users see loading states, success messages, and error details
4. **Progressive Enhancement**: Works even if JavaScript is disabled (form still submits)
5. **React Integration**: Seamlessly integrates with React's state management

#### Why the Form Needs to be a Client Component:

```tsx
"use client"; // Required for React hooks

import { useActionState } from "react";

export default function Registration() {
  // ❌ This won't work in Server Components - React hooks are client-side only
  const [state, formAction] = useActionState(addUserWithId, { success: false });

  return (
    <form action={formAction}>
      {/* Error display requires client-side state */}
      {state.error && <div className="error">{state.error}</div>}
      {/* Form fields */}
    </form>
  );
}
```

**Key Reasons for Client Component:**

- **React Hooks**: `useActionState` only works in client components
- **State Management**: Error and success states need to be managed client-side
- **Conditional Rendering**: Showing/hiding error messages requires client-side reactivity
- **User Interaction**: Real-time feedback needs JavaScript

## 🔄 Alternative Approaches (Without Client Components)

### Option 1: Server Component with URL Search Params

```tsx
// ❌ Less user-friendly approach
import { redirect } from "next/navigation";

export async function addUser(formData: FormData) {
  try {
    // ... API call
    redirect("/?success=true");
  } catch (error) {
    redirect("/?error=Failed to add user");
  }
}

// In your page component
export default function Page({ searchParams }) {
  return (
    <div>
      {searchParams.error && <div>{searchParams.error}</div>}
      {searchParams.success && <div>Success!</div>}
      <form action={addUser}>{/* form fields */}</form>
    </div>
  );
}
```

**Drawbacks:**

- ❌ Requires page navigation/refresh
- ❌ Error state in URL (not ideal for UX/security)
- ❌ No loading states
- ❌ Poor user experience

### Option 2: Server Component with Cookies

```tsx
// ❌ Overly complex approach
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function addUser(formData: FormData) {
  try {
    // ... API call
    cookies().set("form-message", "User added successfully");
  } catch (error) {
    cookies().set("form-error", "Failed to add user");
  }
  redirect("/");
}
```

**Drawbacks:**

- ❌ Complex cookie management
- ❌ Still requires page refresh
- ❌ Cookies have size limitations
- ❌ Harder to debug and maintain

### Option 3: Basic Server Action (Current Default)

```tsx
// ❌ Your original implementation - throws unhandled errors
export async function addUser(formData: FormData) {
  try {
    // API call
  } catch (error) {
    throw new Error("Failed to add user"); // ❌ This crashes the app
  }
}
```

**Drawbacks:**

- ❌ Unhandled errors crash the application
- ❌ No user feedback
- ❌ Poor error handling
- ❌ Bad user experience

## 🏆 Why Our Client Component Approach is Superior

### 1. **Better Error Handling**

```tsx
// ✅ Proper error handling with user feedback
const [state, formAction] = useActionState(addUserWithId, { success: false });

return (
  <form action={formAction}>
    {state.error && (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{state.error}</div>
    )}
  </form>
);
```

### 2. **Loading States**

```tsx
// ✅ Users see loading feedback
const { pending } = useFormStatus();
return <button disabled={pending}>{pending ? "Registering..." : "Register User"}</button>;
```

### 3. **Success Feedback**

```tsx
// ✅ Success messages without page refresh
{
  state.success && (
    <div className="bg-green-50 border border-green-200 text-green-700">User registered successfully!</div>
  );
}
```

### 4. **Type Safety**

```tsx
// ✅ Full TypeScript support
type FormState = {
  error?: string;
  success?: boolean;
};

export const addUser = async ({ id }: { id: string }, prevState: FormState, formData: FormData): Promise<FormState> => {
  // Implementation
};
```

## 🔧 Server Action Implementation

**File:** `src/actions/userActions.ts`

Our server action properly handles errors and returns structured data:

```tsx
export const addUser = async ({ id }: { id: string }, prevState: FormState, formData: FormData): Promise<FormState> => {
  try {
    const response = await fetch("http://localhost:5000/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: errorData.message || `Server error: ${response.status}`,
        success: false,
      };
    }

    const data = await response.json();
    revalidatePath("/");

    return { success: true, error: undefined };
  } catch (error) {
    return {
      error: "Failed to add user. Please check your network connection and try again.",
      success: false,
    };
  }
};
```

## 🎨 Key Features

- ✅ **Proper Error Handling**: Network errors, server errors, and validation errors
- ✅ **Loading States**: Visual feedback during form submission
- ✅ **Success Messages**: Confirmation when operations complete
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Progressive Enhancement**: Works without JavaScript
- ✅ **Accessibility**: Proper ARIA labels and semantic HTML
- ✅ **Responsive Design**: Mobile-friendly interface

## 📚 Learn More

- [Next.js Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React useActionState Hook](https://react.dev/reference/react/useActionState)
- [Next.js App Router](https://nextjs.org/docs/app)

## 🏗️ Project Structure

```
src/
├── actions/
│   └── userActions.ts          # Server actions with proper error handling
├── app/
│   ├── user-registration.tsx   # Client component with useActionState
│   ├── UserList.tsx           # Server component for displaying users
│   ├── Button.tsx             # Client component for form submission
│   └── page.tsx               # Main page
└── utils/
    └── wait.ts                # Utility for simulating delays
```

## 🚀 Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
