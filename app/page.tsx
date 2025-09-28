"use client";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function HandsDemo() {
  const router = useRouter();

  return (
    <>
      <div className="h-[100vh] bg-gray-700 flex flex-col justify-between">
        <p className="text-white">Demo1</p>
        <p className="text-white">Demo1</p>
        <p className="text-white">Demo1</p>
        <p className="text-white">Demo1</p>
      </div>
      <div className="h-[100vh] bg-gray-800 text-white">
        <p>Demo2</p>
        <button onClick={() => router.push("/about")}>Click Me</button>
      </div>
      <div className="h-[100vh] bg-gray-900 text-white">
        <p>Demo3</p>
        <button onClick={() => toast.info("Other Clicked")}>Click Me</button>
      </div>
      <div className="h-[100vh] bg-gray-950 text-white">Demo4</div>
    </>
  );
}
