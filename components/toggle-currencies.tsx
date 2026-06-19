import { useActionHandlers } from '@/lib/hooks/use-action-handlers';
import { ArrowDown } from 'lucide-react';


export function ToggleCurrencies() {
    const { handleToggleCurrencies } = useActionHandlers();
  return (
    <div className="relative z-10 flex h-0 cursor-pointer justify-center" onClick={handleToggleCurrencies}>
       <button className="relative top-[-14px] flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground shadow-sm ring-4 ring-card transition-colors hover:border-primary/25 hover:bg-secondary/50 hover:text-foreground">
        <ArrowDown className="size-5" />
       </button>
    </div>
  )
}
