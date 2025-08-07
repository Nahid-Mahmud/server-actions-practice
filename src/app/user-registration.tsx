import { addUser } from "@/actions/userActions";
import Button from "./Button";

export default function Registration() {
  const addUserWithId = addUser.bind(null, { id: "12345" as string });

  return (
    <div className=" bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Registration Form */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="p-6">
            <form action={addUserWithId} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Enter your  name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>

              <Button />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
