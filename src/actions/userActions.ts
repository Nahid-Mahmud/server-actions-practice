"use server";

import wait from "@/utils/wait";
import { revalidatePath } from "next/cache";

// import { revalidateTag } from "next/cache";

export const addUser = async ({ id }: { id: string }, formData: FormData) => {
  console.log(formData.get("name"));
  console.log(formData.get("email"));
  console.log(id);
  // return;

  // simulate 3 seconds delay
  await wait(3000);

  // http://localhost:5000/api/v1/

  await fetch("http://localhost:5000/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: formData.get("name"),
      email: formData.get("email"),
    }),
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
      //   revalidateTag("users");
      revalidatePath("/");
    })
    .catch((error) => {
      console.error("Error:", error);
    });
};

export const getUsers = async () => {
  const res = await fetch("http://localhost:5000/api/v1/auth/test-users", {
    next: {
      tags: ["users"],
    },
  });
  return res.json();
};
