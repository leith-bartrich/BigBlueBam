import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bootstrapSchema } from '@bigbluebam/shared';
import type { BootstrapInput } from '@bigbluebam/shared';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { useAuthStore } from '@/stores/auth.store';

const WORDS = [
  'Amber', 'Arrow', 'Atlas', 'Birch', 'Blade', 'Blaze', 'Cedar', 'Cliff',
  'Cloud', 'Cobra', 'Comet', 'Coral', 'Crane', 'Creek', 'Crown', 'Delta',
  'Drake', 'Drift', 'Eagle', 'Ember', 'Falcon', 'Fern', 'Flint', 'Forge',
  'Frost', 'Glade', 'Globe', 'Grove', 'Haven', 'Heron', 'Ivory', 'Jade',
  'Lance', 'Lark', 'Maple', 'Mars', 'Mesa', 'Mist', 'Noble', 'North',
  'Oak', 'Onyx', 'Orbit', 'Pearl', 'Phoenix', 'Pine', 'Prism', 'Quartz',
  'Raven', 'Reef', 'Ridge', 'River', 'Robin', 'Sage', 'Scout', 'Shale',
  'Sierra', 'Slate', 'Solar', 'Spark', 'Steel', 'Stone', 'Storm', 'Summit',
  'Swift', 'Terra', 'Thorn', 'Tiger', 'Trail', 'Vapor', 'Vista', 'Wolf',
];
const SYMBOLS = '!@#$%&*?';

function secureRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % max;
}

function generatePassword(): string {
  const pick = <T,>(arr: T[]): T => arr[secureRandomInt(arr.length)]!;
  const digits = String(10 + secureRandomInt(90));
  return `${pick(WORDS)}-${pick(WORDS)}-${pick(WORDS)}-${pick(WORDS)}${digits}${SYMBOLS[secureRandomInt(SYMBOLS.length)]}`;
}

interface BootstrapFormProps {
  onSuccess?: () => void;
}

export function BootstrapForm({ onSuccess }: BootstrapFormProps) {
  const { bootstrap, isLoading, error, clearError } = useAuthStore();
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BootstrapInput>({
    resolver: zodResolver(bootstrapSchema),
    defaultValues: {
      email: '',
      password: '',
      display_name: 'Admin',
      org_name: 'My Organization',
    },
  });

  const onSubmit = async (data: BootstrapInput) => {
    clearError();
    try {
      await bootstrap(data);
      onSuccess?.();
    } catch {
      // error is set in the store
    }
  };

  const handleGenerate = () => {
    const pw = generatePassword();
    setValue('password', pw, { shouldValidate: true });
    setRevealedPassword(pw);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <div className="font-medium">{error.message}</div>
          {error.cause && (
            <div className="mt-1 font-mono text-xs text-red-600/80 break-all">
              {error.cause}
            </div>
          )}
          {error.requestId && (
            <div className="mt-1 text-xs text-red-600/60">
              Request ID: <span className="font-mono">{error.requestId}</span>
            </div>
          )}
        </div>
      )}
      <Input
        id="display_name"
        label="Your name"
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
      <div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              id="password"
              label="Password"
              type="text"
              placeholder="Min 12 characters"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>
          <Button type="button" variant="ghost" onClick={handleGenerate} className="mb-0.5">
            Generate
          </Button>
        </div>
        {revealedPassword && (
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <div className="font-medium">Copy this password now. It will not be shown again after you submit.</div>
            <div className="mt-1 font-mono text-xs break-all">{revealedPassword}</div>
          </div>
        )}
      </div>
      <Input
        id="org_name"
        label="Organization name"
        placeholder="Acme Inc."
        error={errors.org_name?.message}
        {...register('org_name')}
      />
      <Button type="submit" className="w-full" loading={isLoading}>
        Create SuperUser and sign in
      </Button>
    </form>
  );
}
