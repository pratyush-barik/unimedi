import Link from "next/link";

export default function Login() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">

      <h1 className="text-3xl font-bold">Unimedi Login</h1>

      <Link
        href="/patient/login"
        className="px-6 py-2 bg-blue-500 text-white rounded"
      >
        Patient Login
      </Link>

      <Link
        href="/doctor/login"
        className="px-6 py-2 bg-green-500 text-white rounded"
      >
        Doctor Login
      </Link>

    </div>
  );
}