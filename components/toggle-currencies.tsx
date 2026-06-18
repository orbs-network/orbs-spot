import { useActionHandlers } from '@/lib/hooks/use-action-handlers';
import { ArrowDown } from 'lucide-react';


export function ToggleCurrencies() {
    const { handleToggleCurrencies } = useActionHandlers();
  return (
    <div className="relative z-10 flex h-0 cursor-pointer justify-center" onClick={handleToggleCurrencies}>
       <button className="relative top-[-18px] flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-2xl border-4 border-card bg-secondary text-muted-foreground shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition-colors hover:bg-primary hover:text-primary-foreground">
        <ArrowDown className="size-5" />
       </button>
    </div>
  )
}
