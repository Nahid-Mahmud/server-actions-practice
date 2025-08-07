"use server";

import wait from "@/utils/wait";
import { revalidatePath } from "next/cache";

// import { revalidateTag } from "next/cache";

type FormState = {
  error?: string;
  success?: boolean;
};

export const addUser = async ({ id }: { id: string }, prevState: FormState, formData: FormData): Promise<FormState> => {
  console.log(formData.get("name"));
  console.log(formData.get("email"));
  console.log(id);

  // simulate 3 seconds delay
  await wait(3000);

  try {
    const response = await fetch("http://localhost:5000/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        error: errorData.message || `Server error: ${response.status}`,
        success: false,
      };
    }

    const data = await response.json();
    console.log(data);
    revalidatePath("/");

    return {
      success: true,
      error: undefined,
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      error: "Failed to add user. Please check your network connection and try again.",
      success: false,
    };
  }
};

export const getUsers = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/v1/auth/test-users", {
      next: {
        tags: ["users"],
      },
    });

    if (!res.ok) {
      console.error(`HTTP Error: ${res.status} ${res.statusText}`);
      return {
        users: [],
        error: `Failed to fetch users: ${res.status} ${res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      users: data.users || data,
      error: null,
    };
  } catch (error) {
    console.error("Network error:", error);
    return {
      users: [],
      error: "Network error: Unable to fetch users. Please check your connection.",
    };
  }
};
