import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@bigbluebam/shared';
import type { LoginInput } from '@bigbluebam/shared';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { useAuthStore } from '@/stores/auth.store';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    clearError();
    try {
      await login(data.email, data.password);
      onSuccess?.();
    } catch {
      // error is set in the store
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Input
        id="email"
        label="Email"
        type="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        id="password"
        label="Password"
        type="password"
        placeholder="Enter your password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" className="w-full" loading={isLoading}>
        Sign in
      </Button>
    </form>
  );
}
