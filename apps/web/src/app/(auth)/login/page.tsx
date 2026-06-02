"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

type LoginInput = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="relative min-h-screen w-full overflow-hidden bg-[url('/images/background-image.jpg')] bg-cover bg-center bg-no-repeat">
      <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_78%_72%,rgba(255,255,255,0.12),transparent_30%)]" />
        <div className="absolute inset-0 bg-black/15" />

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="relative z-10 w-[90%] max-w-sm rounded-2xl border border-white/20 bg-white/10 px-10 py-12 shadow-2xl backdrop-blur-xl"
        >
          <h1 className="mb-6 text-center text-2xl font-semibold text-white">Login</h1>

          <div className="relative mb-4">
            <input
              id="email"
              type="email"
              placeholder="Email"
              className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 pr-10 text-white outline-none transition placeholder:text-white/50 focus:border-white/50"
              {...register("email")}
            />
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
          </div>
          {errors.email ? <p className="-mt-2 mb-4 text-xs text-red-300">{errors.email.message}</p> : null}

          <div className="relative mb-4">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 pr-16 text-white outline-none transition placeholder:text-white/50 focus:border-white/50"
              {...register("password")}
            />
            <Lock className="pointer-events-none absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-white/60 transition hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="-mt-2 mb-4 text-xs text-red-300">{errors.password.message}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#4C5C8A] py-3 font-medium text-white transition hover:bg-[#3a4a78] disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Login"}
          </button>

          {authError ? <p className="mt-3 text-center text-sm text-red-300">{authError}</p> : null}
        </form>
      </div>
    </main>
  );
}
