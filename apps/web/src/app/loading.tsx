import Image from "next/image";

export default function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <Image
        src="/images/3ds-logo.svg"
        alt="3D's Distributors (PVT) Ltd."
        width={460}
        height={259}
        priority
        className="h-auto w-full max-w-[700px]"
      />
    </div>
  );
}
