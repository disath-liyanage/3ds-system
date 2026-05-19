"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

type LoginInput = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = async (values: LoginInput) => {
    setAuthError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      setAuthError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen w-full lg:grid-cols-5">
        <section className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#c9834a] via-[#e2a06a] to-[#f2c08f] px-8 py-12 text-center text-white lg:col-span-3">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/12" />
            <div className="absolute left-16 top-20 h-52 w-52 rounded-full bg-[#b76a34]/20" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#a85d2d]/22" />
            <div className="absolute bottom-10 right-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="absolute right-10 top-10 grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }).map((_, idx) => (
                <span key={idx} className="h-1.5 w-1.5 rounded-full bg-white/70" />
              ))}
            </div>
            <div className="absolute left-10 top-10 h-10 w-10 border border-white/70 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
            <div className="absolute left-20 bottom-20 h-6 w-6 rounded-full border-2 border-white/75" />
            <div className="absolute right-24 top-28 h-5 w-5 rounded-full border-2 border-white/70" />
            <div className="absolute left-1/2 top-1/3 h-10 w-10 -translate-x-1/2 text-4xl leading-none text-white/80">+</div>
            <svg
              className="absolute -left-6 top-4 h-48 w-48 text-white/45"
              viewBox="0 0 200 200"
              fill="none"
              aria-hidden="true"
            >
              <path d="M10 20 C70 0, 120 0, 190 40" stroke="currentColor" strokeWidth="2" />
              <path d="M0 50 C65 20, 120 20, 190 70" stroke="currentColor" strokeWidth="2" />
              <path d="M0 80 C60 50, 120 50, 190 100" stroke="currentColor" strokeWidth="2" />
              <path d="M10 110 C70 80, 130 80, 190 130" stroke="currentColor" strokeWidth="2" />
            </svg>
            <svg
              className="absolute -bottom-10 right-0 h-56 w-56 text-white/50"
              viewBox="0 0 220 220"
              fill="none"
              aria-hidden="true"
            >
              <path d="M10 180 C80 80, 140 230, 210 140" stroke="currentColor" strokeWidth="2" />
              <path d="M0 150 C80 60, 140 210, 220 120" stroke="currentColor" strokeWidth="2" />
              <path d="M0 120 C70 40, 130 180, 220 90" stroke="currentColor" strokeWidth="2" />
              <path d="M20 205 C85 115, 145 250, 220 165" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <Image
            src="/images/3ds-logo.png"
            alt="3D's Distributors (PVT) Ltd."
            width={380}
            height={214}
            priority
            className="relative z-10 h-auto w-full max-w-[675px]"
          />
          <h1 className="relative z-10 mt-6 font-serif text-5xl font-extrabold leading-tight tracking-wide sm:text-6xl">
            Welcome Back!
          </h1>
        </section>

        <Card className="rounded-none border-0 bg-white shadow-none lg:col-span-2">
          <div className="flex h-full flex-col justify-center">
          <CardHeader className="space-y-3 px-6 pb-6 sm:px-12">
            <CardTitle className="text-5xl font-extrabold text-[#666666]">Sign In</CardTitle>
          </CardHeader>
          <CardContent className="px-6 sm:px-12">
            <form onSubmit={handleSubmit(onSubmit)} className="mx-auto w-full max-w-md space-y-5">
              <div className="space-y-1">
                <div className="relative">
                  <User className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a06a46]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@3dsdis.com"
                    className="h-16 rounded-[999px] border-[#e7c9b1] bg-transparent pl-12 pr-5 focus-visible:ring-[#cc7c3f]"
                    {...register("email")}
                  />
                </div>
                {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
              </div>
              <div className="space-y-1">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a06a46]" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your password"
                    className="h-16 rounded-[999px] border-[#e7c9b1] bg-transparent pl-12 pr-5 focus-visible:ring-[#cc7c3f]"
                    {...register("password")}
                  />
                </div>
                {errors.password ? <p className="text-xs text-red-600">{errors.password.message}</p> : null}
              </div>
              {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
              <Button
                type="submit"
                className="mt-5 h-16 w-full rounded-[999px] bg-gradient-to-r from-[#8a4f1f] via-[#b76528] to-[#d67d36] px-6 text-base font-semibold text-white hover:from-[#7f481d] hover:via-[#a95c25] hover:to-[#c97332]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
          </div>
        </Card>
      </div>
    </main>
  );
}
