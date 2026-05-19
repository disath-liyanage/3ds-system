import Image from "next/image";

export default function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <Image
        src="/images/3ds-logo.png"
        alt="3D's Distributors (PVT) Ltd."
        width={320}
        height={180}
        priority
        className="h-auto w-full max-w-[320px]"
      />
    </div>
  );
}
