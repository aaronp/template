import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { greet } from '@/lib/utils';

export default function App() {
  const [n, setN] = useState(0);
  return (
    <main className="min-h-screen grid place-content-center gap-4 text-center">
      <h1 className="text-3xl font-semibold">{greet('world')}</h1>
      <Button onClick={() => setN(n + 1)}>Clicked {n} times</Button>
      <a className="text-sm underline" href="project/">Project dashboard and API docs</a>
    </main>
  );
}
