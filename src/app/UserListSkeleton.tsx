import React from "react";

export default function UserListSkeleton() {
  return (
    <div className="">
      {/* User List Skeleton */}
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

        {/* Skeleton Content */}
        <div className="divide-y divide-gray-200 p-5">
          {/* Skeleton Items */}
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="py-4 flex items-center gap-5 animate-pulse">
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
              <div className="flex items-center space-x-4 flex-1">
                <div className="h-5 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-48"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
