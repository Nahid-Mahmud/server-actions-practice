# 🚀 Comprehensive Guide: Reusable Server Actions & Data Operations

## Table of Contents

1. [Current Analysis](#current-analysis)
2. [Reusability Patterns](#reusability-patterns)
3. [Generic Action Factory](#generic-action-factory)
4. [Dynamic Operations (CRUD)](#dynamic-operations-crud)
5. [Type-Safe Patterns](#type-safe-patterns)
6. [Error Handling Strategies](#error-handling-strategies)
7. [Caching & Revalidation](#caching--revalidation)
8. [File Structure Best Practices](#file-structure-best-practices)
9. [Testing Strategies](#testing-strategies)
10. [Performance Optimization](#performance-optimization)
11. [Real-World Examples](#real-world-examples)

---

## Current Analysis

Your current `userActions.ts` has good error handling but lacks reusability. Let's analyze the patterns:

### ✅ What's Good

- Proper error handling with structured return types
- Network error specificity
- Type safety with `FormState`
- Cache revalidation with `revalidatePath`

### ❌ Areas for Improvement

- Hard-coded API endpoints
- Repeated fetch logic
- No generic patterns for different entities
- Limited flexibility for different HTTP methods

---

## Reusability Patterns

### 1. **Base API Client Pattern**

Create a reusable API client that handles common concerns:

```typescript
// src/lib/api-client.ts
type ApiResponse<T> = {
  data?: T;
  error?: string;
  success: boolean;
};

type RequestConfig = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  body?: any;
  tags?: string[];
  headers?: Record<string, string>;
  timeout?: number;
};

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = "http://localhost:5000/api/v1") {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      "Content-Type": "application/json",
    };
  }

  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${config.endpoint}`;

      const fetchConfig: RequestInit = {
        method: config.method,
        headers: { ...this.defaultHeaders, ...config.headers },
        ...(config.body && { body: JSON.stringify(config.body) }),
      };

      // Add Next.js specific options for caching
      if (config.tags) {
        fetchConfig.next = { tags: config.tags };
      }

      const response = await fetch(url, fetchConfig);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          error: errorData.message || `HTTP Error: ${response.status} ${response.statusText}`,
          success: false,
        };
      }

      const data = await response.json();
      return {
        data,
        success: true,
      };
    } catch (error) {
      console.error("API request failed:", error);

      let errorMessage = "Network error occurred";
      if (error instanceof TypeError && error.message.includes("fetch failed")) {
        errorMessage = "Connection failed: Unable to reach the server. Please ensure the server is running.";
      } else if (error instanceof Error) {
        errorMessage = `Network error: ${error.message}`;
      }

      return {
        error: errorMessage,
        success: false,
      };
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
```

### 2. **Generic Form State Pattern**

```typescript
// src/types/form-state.ts
export type BaseFormState<T = any> = {
  error?: string;
  success?: boolean;
  data?: T;
  validationErrors?: Record<string, string>;
};

export type ActionResult<T = any> = Promise<BaseFormState<T>>;

// For different entity types
export type UserFormState = BaseFormState<{ id: string; name: string; email: string }>;
export type ProductFormState = BaseFormState<{ id: string; name: string; price: number }>;
```

---

## Generic Action Factory

### 3. **Action Factory Pattern**

Create a factory that generates reusable actions:

```typescript
// src/lib/action-factory.ts
import { revalidatePath, revalidateTag } from "next/cache";
import { apiClient } from "./api-client";
import type { BaseFormState, ActionResult } from "@/types/form-state";

type EntityConfig = {
  entityName: string;
  endpoint: string;
  revalidationPath?: string;
  revalidationTags?: string[];
};

type ValidationSchema<T> = {
  [K in keyof T]: (value: any) => string | null;
};

export function createEntityActions<T extends Record<string, any>>(
  config: EntityConfig,
  validationSchema?: ValidationSchema<Partial<T>>
) {
  const { entityName, endpoint, revalidationPath, revalidationTags } = config;

  // Enhanced FormData validation helper
  const validateData = (data: FormData | Partial<T>): Record<string, string> | null => {
    if (!validationSchema) return null;

    const errors: Record<string, string> = {};
    let dataObj: Record<string, any>;

    if (data instanceof FormData) {
      // Handle FormData with proper type conversion
      dataObj = {};
      for (const [key, value] of data.entries()) {
        // Handle multiple values for the same key (checkboxes, multi-select)
        if (dataObj[key]) {
          if (Array.isArray(dataObj[key])) {
            dataObj[key].push(value);
          } else {
            dataObj[key] = [dataObj[key], value];
          }
        } else {
          dataObj[key] = value;
        }
      }
    } else {
      dataObj = data;
    }

    for (const [key, validator] of Object.entries(validationSchema)) {
      const error = validator(dataObj[key]);
      if (error) {
        errors[key] = error;
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };

  // FormData processing helper
  const processFormData = (formData: FormData): Record<string, any> => {
    const processed: Record<string, any> = {};

    for (const [key, value] of formData.entries()) {
      // Handle file uploads
      if (value instanceof File) {
        if (value.size > 0) {
          processed[key] = value;
        }
        continue;
      }

      // Handle different data types
      const stringValue = value.toString();

      // Convert boolean strings
      if (stringValue === "true" || stringValue === "false") {
        processed[key] = stringValue === "true";
        continue;
      }

      // Convert numbers
      if (!isNaN(Number(stringValue)) && stringValue !== "") {
        processed[key] = Number(stringValue);
        continue;
      }

      // Handle arrays (for multiple checkboxes or select)
      if (processed[key]) {
        if (Array.isArray(processed[key])) {
          processed[key].push(stringValue);
        } else {
          processed[key] = [processed[key], stringValue];
        }
      } else {
        processed[key] = stringValue;
      }
    }

    return processed;
  };

  // Revalidation helper
  const performRevalidation = () => {
    if (revalidationPath) {
      revalidatePath(revalidationPath);
    }
    if (revalidationTags) {
      revalidationTags.forEach((tag) => revalidateTag(tag));
    }
  };

  return {
    // CREATE
    create: async (context: any, prevState: BaseFormState<T>, formData: FormData): ActionResult<T> => {
      const validationErrors = validateData(formData);
      if (validationErrors) {
        return {
          error: "Validation failed",
          validationErrors,
          success: false,
        };
      }

      const body = processFormData(formData);
      const result = await apiClient.request<T>({
        method: "POST",
        endpoint,
        body,
      });

      if (result.success && result.data) {
        performRevalidation();
        return {
          success: true,
          data: result.data,
        };
      }

      return {
        error: result.error || `Failed to create ${entityName}`,
        success: false,
      };
    },

    // READ (with pagination)
    getAll: async (options?: {
      page?: number;
      limit?: number;
      search?: string;
      sortBy?: keyof T;
      sortOrder?: "asc" | "desc";
    }) => {
      const searchParams = new URLSearchParams();

      if (options?.page) searchParams.set("page", options.page.toString());
      if (options?.limit) searchParams.set("limit", options.limit.toString());
      if (options?.search) searchParams.set("search", options.search);
      if (options?.sortBy) searchParams.set("sortBy", options.sortBy.toString());
      if (options?.sortOrder) searchParams.set("sortOrder", options.sortOrder);

      const queryString = searchParams.toString();
      const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

      return apiClient.request<{
        data: T[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>({
        method: "GET",
        endpoint: fullEndpoint,
        tags: revalidationTags,
      });
    },

    // READ by ID
    getById: async (id: string) => {
      return apiClient.request<T>({
        method: "GET",
        endpoint: `${endpoint}/${id}`,
        tags: revalidationTags,
      });
    },

    // UPDATE
    update: async ({ id }: { id: string }, prevState: BaseFormState<T>, formData: FormData): ActionResult<T> => {
      const validationErrors = validateData(formData);
      if (validationErrors) {
        return {
          error: "Validation failed",
          validationErrors,
          success: false,
        };
      }

      const body = processFormData(formData);
      const result = await apiClient.request<T>({
        method: "PUT",
        endpoint: `${endpoint}/${id}`,
        body,
      });

      if (result.success && result.data) {
        performRevalidation();
        return {
          success: true,
          data: result.data,
        };
      }

      return {
        error: result.error || `Failed to update ${entityName}`,
        success: false,
      };
    },

    // DELETE
    delete: async (id: string): ActionResult<{ id: string }> => {
      const result = await apiClient.request<{ id: string }>({
        method: "DELETE",
        endpoint: `${endpoint}/${id}`,
      });

      if (result.success) {
        performRevalidation();
        return {
          success: true,
          data: { id },
        };
      }

      return {
        error: result.error || `Failed to delete ${entityName}`,
        success: false,
      };
    },

    // BATCH OPERATIONS
    bulkDelete: async (ids: string[]): ActionResult<{ deletedIds: string[] }> => {
      const result = await apiClient.request<{ deletedIds: string[] }>({
        method: "DELETE",
        endpoint: `${endpoint}/bulk`,
        body: { ids },
      });

      if (result.success) {
        performRevalidation();
        return {
          success: true,
          data: result.data,
        };
      }

      return {
        error: result.error || `Failed to delete ${entityName} records`,
        success: false,
      };
    },
  };
}
```

---

## Dynamic Operations (CRUD)

### 4. **Specific Entity Actions**

Now create specific actions for your entities:

```typescript
// src/actions/user-actions.ts
"use server";

import { createEntityActions } from "@/lib/action-factory";
import type { UserFormState } from "@/types/form-state";

// User type definition
export type User = {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

// Validation schema for users
const userValidationSchema = {
  name: (value: any) => {
    if (!value || typeof value !== "string") return "Name is required";
    if (value.length < 2) return "Name must be at least 2 characters";
    if (value.length > 50) return "Name must be less than 50 characters";
    return null;
  },
  email: (value: any) => {
    if (!value || typeof value !== "string") return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Please enter a valid email address";
    return null;
  },
};

// Create user actions using the factory
const userActions = createEntityActions<User>(
  {
    entityName: "user",
    endpoint: "/auth/register", // For create
    revalidationPath: "/",
    revalidationTags: ["users"],
  },
  userValidationSchema
);

// Export individual actions for use in components
export const addUser = userActions.create;
export const getUsers = async () => {
  // Custom implementation for your specific endpoint
  const result = await userActions.getAll();

  if (result.success && result.data) {
    return {
      users: result.data.data || result.data,
      error: null,
    };
  }

  return {
    users: [],
    error: result.error || "Failed to fetch users",
  };
};

export const getUserById = userActions.getById;
export const updateUser = userActions.update;
export const deleteUser = userActions.delete;
export const bulkDeleteUsers = userActions.bulkDelete;

// Custom actions specific to users
export const searchUsers = async (query: string) => {
  return userActions.getAll({ search: query });
};

export const getUsersPaginated = async (page: number = 1, limit: number = 10) => {
  return userActions.getAll({ page, limit });
};
```

### 5. **Product Actions Example**

```typescript
// src/actions/product-actions.ts
"use server";

import { createEntityActions } from "@/lib/action-factory";

export type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  createdAt: string;
  updatedAt: string;
};

const productValidationSchema = {
  name: (value: any) => {
    if (!value || typeof value !== "string") return "Product name is required";
    if (value.length < 3) return "Product name must be at least 3 characters";
    return null;
  },
  price: (value: any) => {
    const price = parseFloat(value);
    if (isNaN(price) || price <= 0) return "Price must be a positive number";
    return null;
  },
  category: (value: any) => {
    if (!value || typeof value !== "string") return "Category is required";
    return null;
  },
};

const productActions = createEntityActions<Product>(
  {
    entityName: "product",
    endpoint: "/products",
    revalidationPath: "/products",
    revalidationTags: ["products"],
  },
  productValidationSchema
);

export const addProduct = productActions.create;
export const getProducts = productActions.getAll;
export const getProductById = productActions.getById;
export const updateProduct = productActions.update;
export const deleteProduct = productActions.delete;

// Product-specific actions
export const getProductsByCategory = async (category: string) => {
  return productActions.getAll({ search: category });
};

export const toggleProductStock = async ({ id }: { id: string }, prevState: any, formData: FormData): Promise<any> => {
  const inStock = formData.get("inStock") === "true";

  // Create a new FormData with just the inStock field
  const updateData = new FormData();
  updateData.append("inStock", inStock.toString());

  return productActions.update({ id }, prevState, updateData);
};
```

---

## Type-Safe Patterns

### 6. **Advanced Type Safety**

```typescript
// src/types/api.ts
export type ApiOperation = "create" | "read" | "update" | "delete";

export type EntityPermissions<T> = {
  [K in ApiOperation]?: (data?: Partial<T>) => boolean;
};

export type EntityHooks<T> = {
  beforeCreate?: (data: Partial<T>) => Promise<Partial<T>>;
  afterCreate?: (data: T) => Promise<void>;
  beforeUpdate?: (id: string, data: Partial<T>) => Promise<Partial<T>>;
  afterUpdate?: (data: T) => Promise<void>;
  beforeDelete?: (id: string) => Promise<boolean>;
  afterDelete?: (id: string) => Promise<void>;
};

// Enhanced action factory with permissions and hooks
export function createSecureEntityActions<T extends Record<string, any>>(
  config: EntityConfig,
  validationSchema?: ValidationSchema<Partial<T>>,
  permissions?: EntityPermissions<T>,
  hooks?: EntityHooks<T>
) {
  // Implementation with permission checks and lifecycle hooks
  // ... (implementation details)
}
```

### 7. **Generic Form Components**

```typescript
// src/components/generic-form.tsx
"use client";

import { useActionState } from "react";
import type { BaseFormState } from "@/types/form-state";

type FormField<T> = {
  name: keyof T;
  label: string;
  type: "text" | "email" | "number" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[]; // For select fields
  validation?: (value: any) => string | null;
};

type GenericFormProps<T> = {
  action: (context: any, prevState: BaseFormState<T>, formData: FormData) => Promise<BaseFormState<T>>;
  fields: FormField<T>[];
  initialState: BaseFormState<T>;
  submitLabel?: string;
  context?: any;
  onSuccess?: (data: T) => void;
};

export function GenericForm<T extends Record<string, any>>({
  action,
  fields,
  initialState,
  submitLabel = "Submit",
  context,
  onSuccess,
}: GenericFormProps<T>) {
  const [state, formAction] = useActionState(context ? action.bind(null, context) : action, initialState);

  // Handle success callback
  if (state.success && state.data && onSuccess) {
    onSuccess(state.data);
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Global error */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{state.error}</div>
      )}

      {/* Success message */}
      {state.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          Operation completed successfully!
        </div>
      )}

      {/* Form fields */}
      {fields.map((field) => (
        <div key={field.name as string} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </label>

          {field.type === "textarea" ? (
            <textarea
              name={field.name as string}
              placeholder={field.placeholder}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : field.type === "select" ? (
            <select
              name={field.name as string}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select {field.label}</option>
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              name={field.name as string}
              placeholder={field.placeholder}
              required={field.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Field-specific validation error */}
          {state.validationErrors?.[field.name as string] && (
            <p className="text-sm text-red-600">{state.validationErrors[field.name as string]}</p>
          )}
        </div>
      ))}

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

---

## Error Handling Strategies

### 8. **Centralized Error Handling**

```typescript
// src/lib/error-handler.ts
export enum ErrorType {
  VALIDATION = "VALIDATION",
  NETWORK = "NETWORK",
  SERVER = "SERVER",
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  NOT_FOUND = "NOT_FOUND",
}

export class AppError extends Error {
  constructor(public type: ErrorType, public message: string, public statusCode?: number, public details?: any) {
    super(message);
    this.name = "AppError";
  }
}

export function handleApiError(error: any, context?: string): BaseFormState {
  console.error(`Error in ${context}:`, error);

  if (error instanceof AppError) {
    return {
      error: error.message,
      success: false,
    };
  }

  if (error.name === "ValidationError") {
    return {
      error: "Validation failed",
      validationErrors: error.details,
      success: false,
    };
  }

  if (error.name === "NetworkError") {
    return {
      error: "Network connection failed. Please check your internet connection.",
      success: false,
    };
  }

  // Default error
  return {
    error: "An unexpected error occurred. Please try again.",
    success: false,
  };
}
```

---

## Caching & Revalidation

### 9. **Smart Caching Strategy**

```typescript
// src/lib/cache-manager.ts
type CacheConfig = {
  entity: string;
  strategies: {
    create?: "revalidate-all" | "revalidate-list" | "optimistic-add";
    update?: "revalidate-all" | "revalidate-item" | "optimistic-update";
    delete?: "revalidate-all" | "revalidate-list" | "optimistic-remove";
  };
  paths?: string[];
  tags?: string[];
};

export class CacheManager {
  static configs: Map<string, CacheConfig> = new Map();

  static register(entity: string, config: CacheConfig) {
    this.configs.set(entity, config);
  }

  static async handleOperation(entity: string, operation: "create" | "update" | "delete", data?: any) {
    const config = this.configs.get(entity);
    if (!config) return;

    const strategy = config.strategies[operation];
    if (!strategy) return;

    switch (strategy) {
      case "revalidate-all":
        config.paths?.forEach((path) => revalidatePath(path));
        config.tags?.forEach((tag) => revalidateTag(tag));
        break;

      case "revalidate-list":
        config.tags?.forEach((tag) => revalidateTag(tag));
        break;

      case "revalidate-item":
        revalidateTag(`${entity}-${data?.id}`);
        break;

      case "optimistic-add":
      case "optimistic-update":
      case "optimistic-remove":
        // Implement optimistic updates
        break;
    }
  }
}

// Register cache strategies
CacheManager.register("users", {
  entity: "users",
  strategies: {
    create: "revalidate-list",
    update: "revalidate-item",
    delete: "revalidate-list",
  },
  paths: ["/"],
  tags: ["users"],
});
```

---

## File Structure Best Practices

### 10. **Recommended Project Structure**

```
src/
├── actions/
│   ├── user-actions.ts          # User-specific actions
│   ├── product-actions.ts       # Product-specific actions
│   └── auth-actions.ts          # Authentication actions
├── lib/
│   ├── api-client.ts           # Reusable API client
│   ├── action-factory.ts       # Action factory pattern
│   ├── cache-manager.ts        # Cache management
│   ├── error-handler.ts        # Error handling utilities
│   └── validators.ts           # Validation schemas
├── types/
│   ├── api.ts                  # API-related types
│   ├── form-state.ts          # Form state types
│   ├── entities/
│   │   ├── user.ts            # User entity types
│   │   └── product.ts         # Product entity types
├── components/
│   ├── forms/
│   │   ├── generic-form.tsx   # Reusable form component
│   │   ├── user-form.tsx      # User-specific form
│   │   └── product-form.tsx   # Product-specific form
│   ├── ui/
│   │   ├── button.tsx         # Reusable button
│   │   ├── input.tsx          # Reusable input
│   │   └── loading.tsx        # Loading components
├── hooks/
│   ├── use-action-state.ts    # Custom action state hooks
│   ├── use-api.ts             # API hooks
│   └── use-cache.ts           # Cache hooks
└── utils/
    ├── constants.ts           # App constants
    ├── formatters.ts          # Data formatters
    └── wait.ts               # Utility functions
```

---

## Testing Strategies

### 11. **Testing Your Actions**

```typescript
// src/__tests__/actions/user-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { addUser, getUsers } from "@/actions/user-actions";

// Mock the API client
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    request: vi.fn(),
  },
}));

describe("User Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addUser", () => {
    it("should create a user successfully", async () => {
      const mockUser = { _id: "1", name: "John Doe", email: "john@example.com" };
      const mockApiResponse = { success: true, data: mockUser };

      vi.mocked(apiClient.request).mockResolvedValue(mockApiResponse);

      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");

      const result = await addUser({}, { success: false }, formData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUser);
      expect(result.error).toBeUndefined();
    });

    it("should handle validation errors", async () => {
      const formData = new FormData();
      formData.append("name", ""); // Invalid name
      formData.append("email", "invalid-email"); // Invalid email

      const result = await addUser({}, { success: false }, formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Validation failed");
      expect(result.validationErrors).toBeDefined();
    });
  });
});
```

---

## Performance Optimization

### 12. **Performance Best Practices**

```typescript
// src/lib/performance-optimized-actions.ts
import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";

// Cache expensive operations
export const getCachedUsers = cache(async () => {
  return getUsers();
});

// Prevent caching for real-time data
export async function getRealTimeData() {
  noStore(); // Opt out of caching
  return await fetch("/api/real-time-data");
}

// Batch operations for better performance
export async function batchUpdateUsers(
  updates: Array<{ id: string; data: Partial<User> }>
): Promise<BaseFormState<{ updated: number }>> {
  try {
    const result = await apiClient.request({
      method: "PATCH",
      endpoint: "/users/batch",
      body: { updates },
    });

    if (result.success) {
      // Revalidate in batch
      revalidateTag("users");
      return {
        success: true,
        data: { updated: updates.length },
      };
    }

    return {
      error: result.error || "Batch update failed",
      success: false,
    };
  } catch (error) {
    return handleApiError(error, "batchUpdateUsers");
  }
}
```

---

## Real-World Examples

### 13. **Complete Implementation Example**

Here's how to use everything together:

```typescript
// src/app/users/page.tsx
import { getUsersPaginated } from "@/actions/user-actions";
import { UserForm } from "@/components/forms/user-form";
import { UserList } from "@/components/user-list";

export default async function UsersPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = parseInt(searchParams.page || "1");
  const users = await getUsersPaginated(page, 10);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {/* Form for adding users */}
      <UserForm />

      {/* List of users with pagination */}
      <UserList initialData={users} currentPage={page} />
    </div>
  );
}
```

```typescript
// src/components/forms/user-form.tsx
"use client";

import { addUser } from "@/actions/user-actions";
import { GenericForm } from "@/components/generic-form";
import type { User } from "@/actions/user-actions";

const userFields = [
  {
    name: "name" as keyof User,
    label: "Full Name",
    type: "text" as const,
    required: true,
    placeholder: "Enter full name",
  },
  {
    name: "email" as keyof User,
    label: "Email Address",
    type: "email" as const,
    required: true,
    placeholder: "Enter email address",
  },
];

export function UserForm() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h2 className="text-lg font-semibold mb-4">Add New User</h2>
      <GenericForm
        action={addUser}
        fields={userFields}
        initialState={{ success: false }}
        submitLabel="Create User"
        onSuccess={(user) => {
          console.log("User created:", user);
          // Could trigger a toast notification, redirect, etc.
        }}
      />
    </div>
  );
}
```

---

## 📋 Implementation Checklist

### Immediate Next Steps:

1. ✅ Create the base API client (`src/lib/api-client.ts`)
2. ✅ Set up the action factory (`src/lib/action-factory.ts`)
3. ✅ Define type-safe form states (`src/types/form-state.ts`)
4. ✅ Refactor existing actions to use the new patterns
5. ✅ Create generic form components
6. ✅ Implement error handling utilities
7. ✅ Set up caching strategies
8. ✅ Add validation schemas
9. ✅ Write tests for your actions
10. ✅ Document your API patterns

### Advanced Features:

- Implement optimistic updates
- Add real-time data synchronization
- Create audit logging
- Add permission-based access control
- Implement data transformation pipelines
- Add retry mechanisms for failed requests

---

## 🎯 Key Takeaways

1. **Reusability**: Use factory patterns to generate similar actions
2. **Type Safety**: Leverage TypeScript for better developer experience
3. **Error Handling**: Centralize and standardize error handling
4. **Performance**: Implement smart caching and batch operations
5. **Testing**: Write comprehensive tests for your actions
6. **Maintainability**: Follow consistent patterns and folder structure

This guide provides a comprehensive foundation for building scalable, reusable server actions in Next.js. Start with the basic patterns and gradually implement the advanced features as your application grows.

---

## Advanced FormData Handling

### 14. **Comprehensive FormData Patterns**

The action factory handles various FormData scenarios:

```typescript
// src/lib/form-data-utils.ts
export type FormDataProcessor = {
  files?: string[]; // Fields that contain files
  arrays?: string[]; // Fields that should be arrays
  booleans?: string[]; // Fields that should be booleans
  numbers?: string[]; // Fields that should be numbers
  dates?: string[]; // Fields that should be dates
};

export function createAdvancedFormDataProcessor(config?: FormDataProcessor) {
  return (formData: FormData): Record<string, any> => {
    const processed: Record<string, any> = {};

    for (const [key, value] of formData.entries()) {
      // Handle file uploads
      if (config?.files?.includes(key) || value instanceof File) {
        if (value instanceof File && value.size > 0) {
          processed[key] = value;
        }
        continue;
      }

      const stringValue = value.toString();

      // Handle arrays (checkboxes, multi-select)
      if (config?.arrays?.includes(key)) {
        if (!processed[key]) {
          processed[key] = [];
        }
        processed[key].push(stringValue);
        continue;
      }

      // Handle booleans
      if (config?.booleans?.includes(key)) {
        processed[key] = stringValue === "true" || stringValue === "on";
        continue;
      }

      // Handle numbers
      if (config?.numbers?.includes(key)) {
        const num = Number(stringValue);
        processed[key] = isNaN(num) ? null : num;
        continue;
      }

      // Handle dates
      if (config?.dates?.includes(key)) {
        processed[key] = stringValue ? new Date(stringValue) : null;
        continue;
      }

      // Handle multiple values for the same key (auto-detect arrays)
      if (processed[key] !== undefined) {
        if (Array.isArray(processed[key])) {
          processed[key].push(stringValue);
        } else {
          processed[key] = [processed[key], stringValue];
        }
      } else {
        processed[key] = stringValue;
      }
    }

    return processed;
  };
}
```

### 15. **Enhanced Action Factory with FormData Config**

```typescript
// Enhanced version with FormData configuration
export function createEntityActionsWithFormData<T extends Record<string, any>>(
  config: EntityConfig & { formDataConfig?: FormDataProcessor },
  validationSchema?: ValidationSchema<Partial<T>>
) {
  const { entityName, endpoint, revalidationPath, revalidationTags, formDataConfig } = config;

  // Create a specialized FormData processor
  const processFormData = createAdvancedFormDataProcessor(formDataConfig);

  return {
    // CREATE with advanced FormData handling
    create: async (context: any, prevState: BaseFormState<T>, formData: FormData): ActionResult<T> => {
      const validationErrors = validateData(formData);
      if (validationErrors) {
        return {
          error: "Validation failed",
          validationErrors,
          success: false,
        };
      }

      const body = processFormData(formData);

      // Handle file uploads by converting to multipart/form-data
      let requestBody: any = body;
      let headers: Record<string, string> = {};

      if (formDataConfig?.files?.some((field) => body[field] instanceof File)) {
        // Keep as FormData for file uploads
        const multipartData = new FormData();
        Object.entries(body).forEach(([key, value]) => {
          if (value instanceof File) {
            multipartData.append(key, value);
          } else if (Array.isArray(value)) {
            value.forEach((item) => multipartData.append(key, item.toString()));
          } else if (value !== null && value !== undefined) {
            multipartData.append(key, value.toString());
          }
        });
        requestBody = multipartData;
        // Don't set Content-Type for FormData, let browser set it with boundary
      }

      const result = await apiClient.request<T>({
        method: "POST",
        endpoint,
        body: requestBody,
        headers,
      });

      if (result.success && result.data) {
        performRevalidation();
        return {
          success: true,
          data: result.data,
        };
      }

      return {
        error: result.error || `Failed to create ${entityName}`,
        success: false,
      };
    },

    // UPDATE with FormData handling
    update: async ({ id }: { id: string }, prevState: BaseFormState<T>, formData: FormData): ActionResult<T> => {
      // Similar implementation to create but for PUT/PATCH
      // ... (implementation follows same pattern)
    },
  };
}
```

### 16. **Real-World FormData Examples**

```typescript
// src/actions/user-actions-with-avatar.ts
"use server";

import { createEntityActionsWithFormData } from "@/lib/action-factory";

export type UserWithAvatar = {
  _id: string;
  name: string;
  email: string;
  avatar?: File;
  preferences: string[]; // Array of preferences
  isActive: boolean;
  age: number;
  birthDate: Date;
};

const userWithAvatarActions = createEntityActionsWithFormData<UserWithAvatar>(
  {
    entityName: "user",
    endpoint: "/users",
    revalidationPath: "/users",
    revalidationTags: ["users"],
    formDataConfig: {
      files: ["avatar"],
      arrays: ["preferences"],
      booleans: ["isActive"],
      numbers: ["age"],
      dates: ["birthDate"],
    },
  },
  {
    name: (value: any) => {
      if (!value || typeof value !== "string") return "Name is required";
      if (value.length < 2) return "Name must be at least 2 characters";
      return null;
    },
    email: (value: any) => {
      if (!value || typeof value !== "string") return "Email is required";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return "Please enter a valid email address";
      return null;
    },
    avatar: (value: any) => {
      if (value instanceof File) {
        if (value.size > 5 * 1024 * 1024) return "File size must be less than 5MB";
        if (!value.type.startsWith("image/")) return "File must be an image";
      }
      return null;
    },
    age: (value: any) => {
      const age = Number(value);
      if (isNaN(age) || age < 0 || age > 120) return "Age must be between 0 and 120";
      return null;
    },
  }
);

export const addUserWithAvatar = userWithAvatarActions.create;
export const updateUserWithAvatar = userWithAvatarActions.update;
```

### 17. **Complex Form Component Example**

```typescript
// src/components/forms/user-avatar-form.tsx
"use client";

import { useActionState, useState } from "react";
import { addUserWithAvatar } from "@/actions/user-actions-with-avatar";

export function UserAvatarForm() {
  const [state, formAction] = useActionState(addUserWithAvatar, { success: false });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <form action={formAction} className="space-y-4">
      {/* Error Display */}
      {state.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{state.error}</div>
      )}

      {/* Success Display */}
      {state.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          User created successfully!
        </div>
      )}

      {/* Name Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          name="name"
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        {state.validationErrors?.name && <p className="text-red-600 text-sm mt-1">{state.validationErrors.name}</p>}
      </div>

      {/* Email Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          name="email"
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        {state.validationErrors?.email && <p className="text-red-600 text-sm mt-1">{state.validationErrors.email}</p>}
      </div>

      {/* Avatar Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Avatar</label>
        <input
          type="file"
          name="avatar"
          accept="image/*"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          className="mt-1 block w-full"
        />
        {selectedFile && (
          <div className="mt-2">
            <img
              src={URL.createObjectURL(selectedFile)}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-full"
            />
          </div>
        )}
        {state.validationErrors?.avatar && <p className="text-red-600 text-sm mt-1">{state.validationErrors.avatar}</p>}
      </div>

      {/* Age Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Age</label>
        <input
          type="number"
          name="age"
          min="0"
          max="120"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        {state.validationErrors?.age && <p className="text-red-600 text-sm mt-1">{state.validationErrors.age}</p>}
      </div>

      {/* Birth Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Birth Date</label>
        <input type="date" name="birthDate" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
      </div>

      {/* Preferences (Multiple Checkboxes) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Preferences</label>
        <div className="space-y-2">
          {["newsletters", "promotions", "updates", "notifications"].map((pref) => (
            <label key={pref} className="flex items-center">
              <input type="checkbox" name="preferences" value={pref} className="mr-2" />
              <span className="capitalize">{pref}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Active Status */}
      <div>
        <label className="flex items-center">
          <input type="checkbox" name="isActive" value="true" className="mr-2" />
          <span className="text-sm font-medium text-gray-700">Active User</span>
        </label>
      </div>

      <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
        Create User
      </button>
    </form>
  );
}
```

### 18. **FormData Debugging Utilities**

```typescript
// src/lib/form-data-debug.ts
export function debugFormData(formData: FormData, label = "FormData"): void {
  console.group(`🔍 ${label} Debug`);

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      console.log(`📁 ${key}:`, {
        name: value.name,
        size: value.size,
        type: value.type,
        lastModified: new Date(value.lastModified),
      });
    } else {
      console.log(`📝 ${key}:`, value);
    }
  }

  console.groupEnd();
}

// Usage in your action
export const debugAddUser = async (
  context: any,
  prevState: BaseFormState<User>,
  formData: FormData
): ActionResult<User> => {
  debugFormData(formData, "User Creation");

  // Your regular action logic...
  return addUser(context, prevState, formData);
};
```

### 19. **FormData Validation Patterns**

```typescript
// Advanced validation for complex FormData
const advancedUserValidation = {
  avatar: (value: any) => {
    if (!value) return null; // Optional field

    if (!(value instanceof File)) return "Invalid file";

    // Size validation (5MB limit)
    if (value.size > 5 * 1024 * 1024) {
      return "File size must be less than 5MB";
    }

    // Type validation
    if (!value.type.startsWith("image/")) {
      return "File must be an image";
    }

    // File extension validation
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const fileExtension = value.name.toLowerCase().substring(value.name.lastIndexOf("."));
    if (!allowedExtensions.includes(fileExtension)) {
      return "File must be JPG, PNG, GIF, or WebP format";
    }

    return null;
  },

  preferences: (value: any) => {
    if (Array.isArray(value) && value.length > 5) {
      return "Maximum 5 preferences allowed";
    }
    return null;
  },

  birthDate: (value: any) => {
    if (!value) return null; // Optional

    const date = new Date(value);
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 120, 0, 1);

    if (date > now) return "Birth date cannot be in the future";
    if (date < minDate) return "Birth date cannot be more than 120 years ago";

    return null;
  },
};
```
