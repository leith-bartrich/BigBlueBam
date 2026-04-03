import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@bigbluebam/shared';
import type { RegisterInput } from '@bigbluebam/shared';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { useAuthStore } from '@/stores/auth.store';

interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', display_name: '', org_name: '' },
  });

  const onSubmit = async (data: RegisterInput) => {
    clearError();
    try {
      await registerUser(data);
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
        id="display_name"
        label="Display Name"
        placeholder="Jane Doe"
        error={errors.display_name?.message}
        {...register('display_name')}
      />
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
        placeholder="Min 12 characters"
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        id="org_name"
        label="Organization Name"
        placeholder="Acme Inc."
        error={errors.org_name?.message}
        {...register('org_name')}
      />
      <Button type="submit" className="w-full" loading={isLoading}>
        Create Account
      </Button>
    </form>
  );
}
