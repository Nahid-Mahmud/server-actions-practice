import { Suspense } from "react";
import Registration from "./user-registration";
import UserList from "./UserList";
import UserListSkeleton from "./UserListSkeleton";

export default function Home() {
  return (
    <div className="container mx-auto p-4 space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">User Registration</h2>
      <div className="p-6">
        <p className="text-gray-600 mt-1">Create a new account by filling out the form below</p>
      </div>

      <Registration />
      <Suspense fallback={<UserListSkeleton />}>
        <UserList />
      </Suspense>
    </div>
  );
}
