import React, { Suspense } from "react";
import UserList from "./UserList";
import UserListSkeleton from "./UserListSkeleton";

export default function UserListWithSkeleton() {
  return (
    <Suspense fallback={<UserListSkeleton />}>
      <UserList />
    </Suspense>
  );
}
