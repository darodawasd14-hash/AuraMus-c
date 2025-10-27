import { AuraApp } from '@/components/aura-app';
import { PlayerProvider } from '@/context/player-context';

export default function Home() {
  return (
    <PlayerProvider>
      <AuraApp />
    </PlayerProvider>
  );
}
