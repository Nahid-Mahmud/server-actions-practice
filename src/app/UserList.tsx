import { getUsers } from "@/actions/userActions";
import React from "react";

export default async function UserList() {
  const result = await getUsers();

  return (
    <div className="">
      {/* User List */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            Users
          </h2>
          <p className="text-gray-600 mt-1">List of all registered users</p>
        </div>

        {result.error ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <strong>Error:</strong>
              </div>
              <p className="mt-1">{result.error}</p>
            </div>
          </div>
        ) : result.users?.length > 0 ? (
          <ul className="divide-y divide-gray-200 p-5">
            {result.users.map((user: { _id: string; name: string; email: string }, index: number) => (
              <li key={user._id} className="py-4 flex items-center gap-5">
                <span>{index + 1}</span>{" "}
                <div className="flex items-center space-x-4">
                  <h3 className="text-lg font-medium text-gray-900">{user.name}</h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-6 text-gray-500">No users found.</div>
        )}
      </div>
    </div>
  );
}
