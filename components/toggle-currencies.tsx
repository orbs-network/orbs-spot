import { useActionHandlers } from '@/lib/hooks/use-action-handlers';
import { ArrowDown } from 'lucide-react';


export function ToggleCurrencies() {
    const { handleToggleCurrencies } = useActionHandlers();
  return (
    <div className="relative z-10 flex h-0 cursor-pointer justify-center" onClick={handleToggleCurrencies}>
       <button className="relative top-[-14px] flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-xl border-4 border-card bg-secondary text-muted-foreground transition-colors hover:border-primary/20 hover:bg-secondary/50 hover:text-foreground">
        <ArrowDown className="size-5" />
       </button>
    </div>
  )
}
